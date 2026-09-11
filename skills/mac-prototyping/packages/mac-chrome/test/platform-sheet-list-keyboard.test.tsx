// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacList } from "../collections.tsx";
import { MacButton, MacSearchField } from "../controls.tsx";
import { MacSheet } from "../presentation.tsx";

afterEach(cleanup);

function TemplateList({ onSelect, escapeKeyBehavior }: {
  readonly onSelect: (id: string | null) => void;
  readonly escapeKeyBehavior?: ComponentProps<typeof MacList>["escapeKeyBehavior"];
}) {
  const [selectedId, setSelectedId] = useState<string | null>("letter");
  return <MacList ariaLabel="Templates" selectedId={selectedId} escapeKeyBehavior={escapeKeyBehavior} onSelectionChange={(id) => { setSelectedId(id); onSelect(id); }}
    sections={[{ id: "templates", items: [{ id: "letter", label: "Letter" }, { id: "report", label: "Report" }] }]} />;
}

function SheetHarness({ onCancel, onSelect, size = "compact" }: {
  readonly onCancel: () => void;
  readonly onSelect: (id: string | null) => void;
  readonly size?: ComponentProps<typeof MacSheet>["size"];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const openerRef = useRef<HTMLButtonElement>(null);
  return <section className="mac-window" aria-label="Template window">
    <MacButton ref={openerRef} onPress={() => setOpen(true)}>Browse templates</MacButton>
    <MacSheet size={size} open={open} title="Choose a Template" fallbackFocusRef={openerRef} onClose={() => setOpen(false)}
      headerAccessory={<MacSearchField ariaLabel="Search templates" value={query} onChange={setQuery} />}
      initialFocusSelector='input[type="search"]'
      actions={[{ id: "cancel", label: "Cancel", role: "cancel", onPress: onCancel }, { id: "choose", label: "Choose", isDefault: true }]}>
      <TemplateList onSelect={onSelect} escapeKeyBehavior="none" />
    </MacSheet>
  </section>;
}

function NestedSheets({ onOuterCancel, onInnerCancel }: {
  readonly onOuterCancel: () => void;
  readonly onInnerCancel: () => void;
}) {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(false);
  return <section className="mac-window" aria-label="Nested template window">
    <MacSheet open={outerOpen} title="Outer sheet" onClose={() => setOuterOpen(false)} actions={[{ id: "cancel", label: "Cancel outer", role: "cancel", onPress: onOuterCancel }]}>
      <MacButton onPress={() => setInnerOpen(true)}>Open inner sheet</MacButton>
      <MacSheet open={innerOpen} title="Inner sheet" onClose={() => setInnerOpen(false)} actions={[{ id: "cancel", label: "Cancel inner", role: "cancel", onPress: onInnerCancel }]}>
        <TemplateList onSelect={() => undefined} escapeKeyBehavior="none" />
      </MacSheet>
    </MacSheet>
  </section>;
}

describe("search and list keyboard behavior inside sheets", () => {
  it("cancels only the inner portalled sheet when its list has focus", async () => {
    const onOuterCancel = vi.fn();
    const onInnerCancel = vi.fn();
    render(<NestedSheets onOuterCancel={onOuterCancel} onInnerCancel={onInnerCancel} />);
    const opener = screen.getByRole("button", { name: "Open inner sheet" });
    act(() => opener.focus());
    fireEvent.click(opener);
    const inner = screen.getByRole("dialog", { name: "Inner sheet" });
    const selected = within(inner).getByRole("option", { name: "Letter" });
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "Escape" });
    expect(onInnerCancel).toHaveBeenCalledOnce();
    expect(onOuterCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Inner sheet" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Outer sheet" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("names the header search independently and clears before cancelling on the next Escape", async () => {
    const onCancel = vi.fn();
    render(<SheetHarness onCancel={onCancel} onSelect={() => undefined} />);
    const opener = screen.getByRole("button", { name: "Browse templates" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Choose a Template" });
    const search = within(dialog).getByRole<HTMLInputElement>("searchbox", { name: "Search templates" });
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(search.closest("header")).toBe(within(dialog).getByRole("heading").closest("header"));
    fireEvent.change(search, { target: { value: "report" } });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search.value).toBe("");
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Choose a Template" })).toBe(dialog);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it.each(["compact", "wide", "large"] as const)("preserves list selection while Escape cancels a %s sheet", async (size) => {
    const onCancel = vi.fn();
    const onSelect = vi.fn();
    render(<SheetHarness onCancel={onCancel} onSelect={onSelect} size={size} />);
    const opener = screen.getByRole("button", { name: "Browse templates" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Choose a Template" });
    expect(dialog.classList.contains(`mc-sheet-${size}`)).toBe(true);
    const selected = within(dialog).getByRole("option", { name: "Letter" });
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith("report");
    onSelect.mockClear();
    fireEvent.keyDown(within(dialog).getByRole("option", { name: "Report" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("keeps standalone Escape selection clearing as the default", () => {
    const onSelect = vi.fn();
    render(<TemplateList onSelect={onSelect} />);
    const selected = screen.getByRole("option", { name: "Letter" });
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "Escape" });
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(selected.getAttribute("aria-selected")).toBe("false");
  });
});
