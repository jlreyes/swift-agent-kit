// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useModalFocusTrap } from "../modal-focus.ts";

afterEach(cleanup);

function FocusBoundaryHarness() {
  const dialogRef = useRef<HTMLElement>(null);
  const handleKeyDown = useModalFocusTrap({ dialogRef, onCancel: () => {} });
  return (
    <section ref={dialogRef} role="dialog" aria-label="Boundary test" tabIndex={-1} onKeyDown={handleKeyDown}>
      <div hidden><button type="button">Hidden attribute</button></div>
      <div style={{ display: "none" }}><button type="button">Display none ancestor</button></div>
      <button type="button" tabIndex={-2}>Negative two before</button>
      <button type="button" tabIndex={-1}>Negative one before</button>
      <button type="button" disabled>Disabled before</button>
      <div inert><button type="button">Inert ancestor</button></div>
      <div aria-hidden="true"><button type="button">Aria hidden ancestor</button></div>
      <div style={{ visibility: "hidden" }}><button type="button">Visibility hidden ancestor</button></div>
      <button type="button">First true boundary</button>
      <button type="button">Last true boundary</button>
      <input aria-label="Hidden input" type="hidden" />
      <button type="button" aria-disabled="true">Aria disabled after</button>
      <button type="button" tabIndex={-2}>Negative two after</button>
      <button type="button" tabIndex={-1}>Negative one after</button>
      <button type="button" disabled>Disabled after</button>
    </section>
  );
}

describe("modal focus boundaries", () => {
  it("skips non-tabbable and hidden candidates when containing Tab and Shift+Tab", async () => {
    render(<FocusBoundaryHarness />);
    const dialog = screen.getByRole("dialog", { name: "Boundary test" });
    const first = screen.getByRole("button", { name: "First true boundary" });
    const last = screen.getByRole("button", { name: "Last true boundary" });

    await waitFor(() => expect(document.activeElement).toBe(first));

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
