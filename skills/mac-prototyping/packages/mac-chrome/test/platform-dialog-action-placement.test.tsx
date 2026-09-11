// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacAlert, MacSheet, type MacDialogAction } from "../presentation.tsx";
import { MacTextField } from "../controls.tsx";

afterEach(cleanup);

function renderSheet(actions: readonly MacDialogAction[], onClose = () => undefined, bodyScroll?: ComponentProps<typeof MacSheet>["bodyScroll"]) {
  return render(<section className="mac-window" aria-label="Project window">
    <MacSheet open title="Project setup" actions={actions} bodyScroll={bodyScroll} onClose={onClose}>
      <MacTextField ariaLabel="Project name" value="Project" onChange={() => undefined} />
    </MacSheet>
  </section>);
}

describe("dialog action placement", () => {
  it("removes body insets without changing the owned header and footer regions", () => {
    render(<section className="mac-window" aria-label="Template window">
      <MacSheet open title="Choose a Template" actions={[{ id: "done", label: "Done" }]} contentInset="none" bodyScroll="contained" onClose={() => undefined}>
        <p>Template browser</p>
      </MacSheet>
    </section>);
    const dialog = screen.getByRole("dialog", { name: "Choose a Template" });
    const body = dialog.querySelector(".mc-sheet-body");
    expect(body?.classList.contains("mc-sheet-body-flush")).toBe(true);
    expect(body?.classList.contains("mc-sheet-body-contained")).toBe(true);
    expect(body?.contains(within(dialog).getByRole("heading"))).toBe(false);
    expect(body?.contains(within(dialog).getByRole("button", { name: "Done" }))).toBe(false);
  });

  it.each([undefined, "automatic", "contained"] as const)("opts into contained body scrolling only when requested (%s)", (bodyScroll) => {
    renderSheet([{ id: "done", label: "Done", isDefault: true }], () => undefined, bodyScroll);
    const dialog = screen.getByRole("dialog", { name: "Project setup" });
    const body = within(dialog).getByRole("textbox", { name: "Project name" }).closest(".mc-sheet-body");
    expect(body?.classList.contains("mc-sheet-body-contained")).toBe(bodyScroll === "contained");
    expect(body?.contains(within(dialog).getByRole("button", { name: "Done" }))).toBe(false);
  });

  it("retains direct button children and semantic ordering without leading actions", () => {
    renderSheet([
      { id: "continue", label: "Continue", isDefault: true },
      { id: "cancel", label: "Cancel", role: "cancel", placement: "trailing" },
      { id: "discard", label: "Discard", role: "destructive" },
    ]);
    const dialog = screen.getByRole("dialog", { name: "Project setup" });
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Discard", "Cancel", "Continue"]);
    const row = dialog.querySelector(".mc-dialog-actions");
    expect(row?.classList.contains("mc-dialog-actions-separated")).toBe(false);
    expect(Array.from(row?.children ?? [])).toEqual(buttons);
  });

  it("preserves supplied leading order and sorts the trailing group by role and default", () => {
    renderSheet([
      { id: "continue", label: "Continue", isDefault: true },
      { id: "discard", label: "Discard", role: "cancel", placement: "leading" },
      { id: "save", label: "Save Draft", placement: "leading" },
      { id: "cancel", label: "Cancel", role: "cancel" },
      { id: "back", label: "Back", placement: "trailing" },
    ]);
    const dialog = screen.getByRole("dialog", { name: "Project setup" });
    expect(within(dialog).getAllByRole("button").map((button) => button.textContent)).toEqual(["Discard", "Save Draft", "Back", "Cancel", "Continue"]);
    const leading = dialog.querySelector(".mc-dialog-actions-leading");
    const trailing = dialog.querySelector(".mc-dialog-actions-trailing");
    expect(leading?.textContent).toBe("DiscardSave Draft");
    expect(trailing?.textContent).toBe("BackCancelContinue");
    expect(leading?.parentElement?.classList.contains("mc-dialog-actions-separated")).toBe(true);
    expect(trailing?.parentElement).toBe(leading?.parentElement);
  });

  it.each(["leading", "trailing"] as const)("keeps default and cancel keyboard behavior in the %s group", async (placement) => {
    const onDefault = vi.fn();
    const onCancel = vi.fn();
    const onClose = vi.fn();
    renderSheet([
      { id: "disabled-default", label: "Unavailable", isDefault: true, disabled: true, placement },
      { id: "default", label: "Continue", isDefault: true, placement, onPress: onDefault },
      { id: "disabled-cancel", label: "Unavailable cancel", role: "cancel", disabled: true, placement },
      { id: "cancel", label: "Discard", role: "cancel", placement, onPress: onCancel },
      { id: "save", label: "Save Draft", placement: "leading" },
    ], onClose);
    const dialog = screen.getByRole("dialog", { name: "Project setup" });
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Continue" })));
    const input = within(dialog).getByRole("textbox", { name: "Project name" });
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDefault).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("supports placement in the shared alert action model", async () => {
    const save = vi.fn();
    const onClose = vi.fn();
    render(<MacAlert open presentationScope="desktop" title="Unsaved project" message="Save your work before closing." onClose={onClose} actions={[
      { id: "save", label: "Save Draft", placement: "leading", onPress: save },
      { id: "cancel", label: "Cancel", role: "cancel" },
      { id: "close", label: "Close", isDefault: true },
    ]} />);
    const dialog = screen.getByRole("alertdialog", { name: "Unsaved project" });
    const saveButton = within(dialog).getByRole("button", { name: "Save Draft" });
    expect(saveButton.parentElement?.classList.contains("mc-dialog-actions-leading")).toBe(true);
    fireEvent.click(saveButton);
    expect(save).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
