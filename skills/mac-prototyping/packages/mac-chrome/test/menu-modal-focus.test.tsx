// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useMenuModalFocusReturn } from "../menu-modal-focus.ts";

afterEach(cleanup);

function Harness({ open }: { readonly open: boolean }) {
  const focusReturn = useMenuModalFocusReturn(open);
  return (
    <>
      <div className="menu-left" onPointerDownCapture={focusReturn.onPointerDownCapture} onFocusCapture={focusReturn.onFocusCapture}>
        <button>File</button><button>Edit</button>
      </div>
      <div className="mac-window" data-testid="owner">
        <section role="dialog" aria-modal="true" data-testid="dialog">
          <input aria-label="Name" />
          <input aria-label="Notes" />
        </section>
      </div>
      <div className="mac-window"><input aria-label="Other window" /></div>
    </>
  );
}

function setup(openImmediately = true) {
  const view = render(<Harness open={false} />);
  const control = screen.getByRole("textbox", { name: "Name" });
  const trigger = screen.getByRole("button", { name: "File" });
  control.focus();
  if (openImmediately) {
    fireEvent.pointerDown(trigger);
    view.rerender(<Harness open />);
  }
  trigger.focus();
  return { control, trigger, rerender: (props: { readonly open: boolean }) => view.rerender(<Harness {...props} />) };
}

it("returns to the remembered modal control only after the entire menu session closes", () => {
  const hook = setup();
  hook.rerender({ open: true });
  expect(document.activeElement).toBe(hook.trigger);
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(hook.control);
});

it.each(["hidden", "inert", "aria-hidden"])("does not refocus a retained owner with %s", (attribute) => {
  const hook = setup();
  screen.getByTestId("owner").setAttribute(attribute, attribute === "aria-hidden" ? "true" : "");
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(hook.trigger);
});

it("does not refocus a sheet removed while its menu is open", () => {
  const hook = setup();
  screen.getByTestId("dialog").remove();
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(hook.trigger);
});

it("uses an eligible control when the remembered modal control becomes disabled", () => {
  const hook = setup();
  hook.control.setAttribute("disabled", "");
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Notes" }));
});

it("preserves a deliberate focus move within the originating modal", () => {
  const hook = setup();
  const notes = screen.getByRole("textbox", { name: "Notes" });
  notes.focus();
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(notes);
});

it("preserves a deliberate focus move to another window", () => {
  const hook = setup();
  const other = screen.getByRole("textbox", { name: "Other window" });
  other.focus();
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(other);
});


it("replaces a pending modal origin when a closed-menu visit is abandoned", () => {
  const hook = setup(false);
  const other = screen.getByRole("textbox", { name: "Other window" });
  other.focus();
  fireEvent.pointerDown(hook.trigger);
  hook.rerender({ open: true });
  hook.trigger.focus();
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(hook.trigger);
});

it.each([false, true])("preserves a pending modal origin within a closed menubar (move between titles: %s)", (moveBetweenTitles) => {
  const hook = setup(false);
  if (moveBetweenTitles) {
    screen.getByRole("button", { name: "Edit" }).focus();
    hook.trigger.focus();
  }
  fireEvent.pointerDown(hook.trigger);
  hook.rerender({ open: true });
  hook.rerender({ open: false });
  expect(document.activeElement).toBe(hook.control);
});
