// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrafficLights, WindowChrome } from "../window";
import { FinderWindow } from "../finder";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

function renderFinder() {
  return render(
    <FinderWindow
      title="Vault"
      sidebar={[{ id: "s", title: "Favorites", collapsible: true, items: [{ id: "a", label: "All", onSelect: () => undefined }] }]}
      entries={[]}
      mode="icons"
      onModeChange={() => undefined}
      search={{ value: "", onChange: () => undefined }}
      selection={{ selectedId: null, onSelect: () => undefined }}
      onOpen={() => undefined}
      iconColumns={3}
    />,
  );
}

/* jsdom has no PointerEvent; hand-build a pointer-ish MouseEvent that carries
   the fields useWindowDrag reads (React copies them onto the synthetic event). */
function firePointer(target: Element, type: string, init: { clientX: number; clientY: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, "pointerId", { value: 7 });
  Object.defineProperty(event, "isPrimary", { value: true });
  act(() => {
    target.dispatchEvent(event);
  });
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("WindowChrome geometry", () => {
  it("applies the generic default frame, centered", () => {
    const { container } = render(
      <WindowChrome label="Plain">
        <p>Body</p>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    expect(windowElement?.style.height).toBe("480px");
    // Centered placement (jsdom normalizes the calc arithmetic, so match parts).
    expect(windowElement?.style.left).toMatch(/^calc\(50% - .*720px.*\)$/);
  });

  it("gives FinderWindow its ~940x580 default geometry", () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("940px");
    expect(windowElement?.style.height).toBe("580px");
  });

  it("honors a partial frame override over the defaults", () => {
    const { container } = render(
      <WindowChrome label="Framed" frame={{ top: 60, left: 40, width: 500 }}>
        <p>Body</p>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.top).toBe("60px");
    expect(windowElement?.style.left).toBe("40px");
    expect(windowElement?.style.width).toBe("500px");
    expect(windowElement?.style.height).toBe("480px");
  });
});

describe("traffic lights", () => {
  it("renders three functional buttons with reveal glyphs inside WindowChrome", () => {
    const { container, getByRole } = render(
      <WindowChrome label="Controls">
        <TrafficLights />
      </WindowChrome>,
    );
    const cluster = container.querySelector(".traffic-lights");
    expect(cluster?.querySelectorAll("button")).toHaveLength(3);
    // Every control carries its glyph; CSS reveals all three on cluster hover.
    expect(cluster?.querySelectorAll("button > svg")).toHaveLength(3);
    expect(getByRole("button", { name: "Close window" })).toBeTruthy();
    expect(getByRole("button", { name: "Minimize window" })).toBeTruthy();
    expect(getByRole("button", { name: "Zoom window" })).toBeTruthy();
  });

  it("renders inert solid-gray dots when disabled", () => {
    const { container } = render(<TrafficLights disabled />);
    const cluster = container.querySelector(".traffic-lights");
    expect(cluster?.classList.contains("mc-disabled")).toBe(true);
    expect(cluster?.querySelectorAll("button")).toHaveLength(0);
    expect(cluster?.querySelectorAll("svg")).toHaveLength(0);
  });

  it("close hides the window and still calls onClose", () => {
    const onClose = vi.fn();
    const { container, getByRole } = render(
      <WindowChrome label="Closable" onClose={onClose}>
        <TrafficLights />
      </WindowChrome>,
    );
    fireEvent.click(getByRole("button", { name: "Close window" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".mac-window")).toBeNull();
  });

  it("minimize transitions out, then hides the window", () => {
    vi.useFakeTimers();
    try {
      const onMinimize = vi.fn();
      const { container, getByRole } = render(
        <WindowChrome label="Minimizable" onMinimize={onMinimize}>
          <TrafficLights />
        </WindowChrome>,
      );
      fireEvent.click(getByRole("button", { name: "Minimize window" }));
      expect(onMinimize).toHaveBeenCalledTimes(1);
      const windowElement = container.querySelector<HTMLElement>(".mac-window");
      expect(windowElement?.classList.contains("mc-minimizing")).toBe(true);
      expect(windowElement?.style.opacity).toBe("0");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(container.querySelector(".mac-window")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("zoom toggles between the frame size and the larger canvas size", () => {
    const onZoom = vi.fn();
    const { container, getByRole } = render(
      <WindowChrome label="Zoomable" onZoom={onZoom}>
        <TrafficLights />
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(windowElement?.classList.contains("mc-zoomed")).toBe(true);
    expect(windowElement?.style.width).toBe("calc(100% - 48px)");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement?.classList.contains("mc-zoomed")).toBe(false);
    expect(windowElement?.style.width).toBe("720px");
  });

  it("an explicit onClose prop overrides the internal default (window stays)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WindowChrome label="Externally closed">
        <TrafficLights onClose={onClose} />
      </WindowChrome>,
    );
    const closeButton = container.querySelector<HTMLButtonElement>("button[aria-label='Close window']");
    expect(closeButton).toBeTruthy();
    if (closeButton) fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".mac-window")).toBeTruthy();
  });
});

describe("window dragging", () => {
  it("FinderWindow exposes its toolbar and titlebar row as drag handles", () => {
    const { container } = renderFinder();
    expect(container.querySelector(".mc-toolbar[data-window-drag-handle]")).toBeTruthy();
    expect(container.querySelector(".mc-finder-sidebar-top[data-window-drag-handle]")).toBeTruthy();
  });

  it("dragging the toolbar moves the window by default", async () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>(".mc-toolbar[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (!windowElement || !handle) return;

    expect(windowElement.style.transform).toBe("translate3d(0px, 0px, 0)");
    firePointer(handle, "pointerdown", { clientX: 300, clientY: 40 });
    firePointer(windowElement, "pointermove", { clientX: 380, clientY: 90 });
    await flushAnimationFrame();
    expect(windowElement.style.transform).toContain("translate3d(");
    expect(windowElement.style.transform).not.toBe("translate3d(0px, 0px, 0)");
    firePointer(windowElement, "pointerup", { clientX: 380, clientY: 90 });
  });

  it("a pointerdown on an interactive toolbar control never starts a drag", async () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const control = container.querySelector<HTMLElement>(".mc-toolbar button");
    expect(windowElement).toBeTruthy();
    expect(control).toBeTruthy();
    if (!windowElement || !control) return;

    firePointer(control, "pointerdown", { clientX: 300, clientY: 40 });
    firePointer(windowElement, "pointermove", { clientX: 380, clientY: 90 });
    await flushAnimationFrame();
    expect(windowElement.style.transform).toBe("translate3d(0px, 0px, 0)");
  });
});
