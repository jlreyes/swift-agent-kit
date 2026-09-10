import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MacSheet } from "../presentation.tsx";

const animations: Array<{ onfinish: (() => void) | null; oncancel: (() => void) | null; cancel: () => void }> = [];
let reduced = false;
let motionChanged: (() => void) | undefined;
beforeEach(() => {
  animations.length = 0;
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => { motionChanged = fn; }, removeEventListener() {} }));
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: vi.fn(() => {
    const animation = { onfinish: null, oncancel: null, cancel: vi.fn() };
    animations.push(animation);
    return animation;
  }) });
});
afterEach(() => { cleanup(); delete (Element.prototype as { animate?: unknown }).animate; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const finish = async () => { await act(async () => { animations.at(-1)?.onfinish?.(); }); };
function View({ name, open = true, onCancel = () => {} }: { name: string; open?: boolean; onCancel?: () => void }) {
  return <div className="mac-window"><div data-testid="underlay"><button>Opener</button></div>
    <MacSheet open={open} presentationKey={name} title={open ? name : ""} onClose={() => {}}
      actions={open ? [{ id: "cancel", label: "Cancel", role: "cancel", onPress: onCancel }, { id: "apply", label: "Apply", isDefault: true, onPress: onCancel }] : []}>
      {open ? <input aria-label={`${name} draft`} defaultValue="draft" /> : null}
    </MacSheet></div>;
}

describe("sheet motion lifecycle", () => {
  it("starts an interrupted entrance's exit at its current transform", async () => {
    const view = render(<View name="A" />);
    const original = window.getComputedStyle.bind(window);
    const partialTransform = "matrix(1, 0, 0, 1, 0, -83)";
    let entranceCancelled = false;
    animations[0]!.cancel = vi.fn(() => { entranceCancelled = true; });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = original(element);
      if (element.matches(".mc-sheet")) Object.defineProperty(style, "transform", { configurable: true, value: entranceCancelled ? "none" : partialTransform });
      return style;
    });
    view.rerender(<View name="B" />);
    const exitFrames = vi.mocked(Element.prototype.animate).mock.calls.at(-1)?.[0] as Keyframe[];
    expect(exitFrames[0]?.transform).toBe(partialTransform);
    await finish(); await finish();
    expect(screen.getByRole("dialog", { name: "B" })).toBeTruthy();
  });

  it("retains the last open content through exit and releases isolation only after completion", async () => {
    const view = render(<View name="A" />); await finish();
    view.rerender(<View name="A" open={false} />);
    expect(screen.getByRole("dialog", { name: "A" })).toBeTruthy();
    expect(screen.getByLabelText("A draft")).toBeTruthy();
    expect(screen.getByTestId("underlay").hasAttribute("inert")).toBe(true);
    await finish();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("underlay").hasAttribute("inert")).toBe(false);
  });

  it("finishes outgoing before entering only the latest replacement and preserves prior local state", async () => {
    const view = render(<View name="A" />); await finish();
    const input = screen.getByLabelText<HTMLInputElement>("A draft");
    fireEvent.change(input, { target: { value: "retained edit" } });
    view.rerender(<View name="B" />);
    expect(screen.getByRole("dialog", { name: "A" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "B" })).toBeNull();
    view.rerender(<View name="C" />);
    await finish();
    expect(screen.getAllByRole("dialog").map((el) => el.textContent)).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "C" })).toBeTruthy();
    expect(screen.queryByLabelText("B draft")).toBeNull();
    expect(screen.getByTestId("underlay").hasAttribute("inert")).toBe(true);
    await finish();
    view.rerender(<View name="A" />); await finish(); await finish();
    expect(screen.getByLabelText("A draft")).toBe(input);
    expect(input.value).toBe("retained edit");
  });

  it("blocks outgoing actions, cancels the latest request once, and ignores stale animation completions", async () => {
    const oldCancel = vi.fn(); const newCancel = vi.fn();
    const view = render(<View name="A" onCancel={oldCancel} />); await finish();
    view.rerender(<View name="B" onCancel={newCancel} />);
    const stale = animations.at(-1)?.onfinish;
    const outgoing = screen.getByRole("dialog", { name: "A" });
    fireEvent.click(outgoing.querySelector("button")!);
    fireEvent.keyDown(outgoing, { key: "Enter" });
    fireEvent.keyDown(outgoing, { key: "Escape" });
    fireEvent.keyDown(outgoing, { key: "Escape", repeat: true });
    expect(oldCancel).not.toHaveBeenCalled(); expect(newCancel).toHaveBeenCalledTimes(1);
    await finish(); await finish();
    await act(async () => { stale?.(); });
    expect(screen.getByRole("dialog", { name: "B" })).toBeTruthy();
  });

  it("completes a close followed by a rapid reopen without dropping the modal layer", async () => {
    const view = render(<View name="A" />); await finish();
    const layer = document.querySelector(".mc-window-modal-layer");
    view.rerender(<View name="A" open={false} />);
    view.rerender(<View name="A" />);
    await finish(); await finish();
    expect(document.querySelector(".mc-window-modal-layer")).toBe(layer);
    expect(screen.getByRole("dialog", { name: "A" })).toBeTruthy();
  });

  it("skips transforms with Reduce Motion, including a preference change during motion", async () => {
    reduced = true;
    const view = render(<View name="A" />);
    expect(animations).toHaveLength(0);
    view.rerender(<View name="B" />);
    expect(screen.getByRole("dialog", { name: "B" })).toBeTruthy();
    expect(animations).toHaveLength(0);
    reduced = false;
    view.rerender(<View name="C" />);
    expect(animations.length).toBeGreaterThan(0);
    await act(async () => { reduced = true; motionChanged?.(); });
    expect(screen.getByRole("dialog", { name: "C" })).toBeTruthy();
    expect(document.querySelector("[data-motion-phase]")?.getAttribute("data-motion-phase")).toBe("open");
  });

  it("settles motion while its owning window is hidden and cleans up on unmount", async () => {
    const view = render(<View name="A" />); await finish();
    view.rerender(<View name="B" />);
    await act(async () => { document.querySelector<HTMLElement>(".mac-window")!.hidden = true; });
    expect(document.querySelector("[data-motion-phase]")?.getAttribute("data-motion-phase")).toBe("open");
    expect(document.querySelector('[data-presentation-key="B"]')).toBeTruthy();
    view.unmount();
    expect(document.querySelector(".mc-window-modal-layer")).toBeNull();
  });

  it("retains explicit return focus when closing props are cleared", async () => {
    const target = document.createElement("button"); target.textContent = "Stable target"; document.body.append(target);
    const fallback = { current: target };
    const view = render(<div className="mac-window"><MacSheet open title="Task" fallbackFocusRef={fallback} onClose={() => {}} actions={[]}><input /></MacSheet></div>);
    await finish();
    view.rerender(<div className="mac-window"><MacSheet open={false} title="" onClose={() => {}} actions={[]}>{null}</MacSheet></div>);
    await finish();
    await waitFor(() => expect(document.activeElement).toBe(target));
    target.remove();
  });

  it("restores the sheet's focused control when its owner becomes visible again", async () => {
    render(<View name="A" />); await finish();
    const input = screen.getByLabelText<HTMLInputElement>("A draft");
    await act(async () => { input.focus(); });
    const owner = document.querySelector<HTMLElement>(".mac-window")!;
    await act(async () => { owner.hidden = true; input.blur(); });
    await act(async () => { owner.hidden = false; });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement?.closest('[aria-modal="true"]')).toBeTruthy();
  });

  it("restores invoking focus after animated close, and contains focus while moving", async () => {
    function Harness() {
      const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null);
      return <div className="mac-window"><div><button ref={trigger} onClick={() => setOpen(true)}>Show</button></div>
        <MacSheet open={open} title="Task" fallbackFocusRef={trigger} onClose={() => setOpen(false)} actions={[{ id: "cancel", label: "Cancel", role: "cancel" }]}><input aria-label="Name" /></MacSheet></div>;
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Show" }); trigger.focus(); fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog")));
    await finish();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy(); await finish();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
