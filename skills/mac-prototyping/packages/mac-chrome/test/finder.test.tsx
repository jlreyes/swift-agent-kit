import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinderWindow, finderKeyTarget, type FinderEntry, type FinderViewMode } from "../finder";

afterEach(cleanup);

const entries: readonly FinderEntry[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `e${n}`,
  name: `Report ${n}`,
  kind: n === 1 ? "folder" : "pdf",
  icon: <span data-testid={`icon-${n}`} />,
  modified: `Aug ${n}`,
  size: `${n} KB`,
}));

function Harness({
  onOpen = () => undefined,
  initialSelection = "e1",
  iconColumns = 3,
  withPreview = false,
}: {
  readonly onOpen?: (entry: FinderEntry) => void;
  readonly initialSelection?: string | null;
  readonly iconColumns?: number;
  readonly withPreview?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection);
  const [mode, setMode] = useState<FinderViewMode>("icons");
  const [query, setQuery] = useState("");
  return (
    <FinderWindow
      title="Vault"
      sidebar={[
        {
          id: "favorites",
          title: "Favorites",
          collapsible: true,
          items: [{ id: "all", label: "All Files", selected: true, onSelect: () => undefined }],
        },
      ]}
      entries={entries}
      mode={mode}
      onModeChange={setMode}
      search={{ value: query, onChange: setQuery }}
      selection={{ selectedId, onSelect: setSelectedId }}
      onOpen={onOpen}
      preview={withPreview ? (entry) => <span>{entry?.name ?? "No selection"}</span> : undefined}
      iconColumns={iconColumns}
    />
  );
}

function ControlledPreviewHarness({
  onChange,
  onPreviewMount,
}: {
  readonly onChange: (visible: boolean) => void;
  readonly onPreviewMount?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  function handleVisibleChange(nextVisible: boolean) {
    onChange(nextVisible);
    setVisible(nextVisible);
  }

  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle Preview from View menu
      </button>
      <FinderWindow
        title="Vault"
        sidebar={[]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: "e1", onSelect: () => undefined }}
        onOpen={() => undefined}
        preview={(entry) => onPreviewMount === undefined
          ? <span>{entry?.name ?? "No selection"}</span>
          : <PreviewMountProbe onMount={onPreviewMount} />}
        previewVisible={visible}
        onPreviewVisibleChange={handleVisibleChange}
        iconColumns={3}
      />
    </>
  );
}

function ControlledSidebarHarness({ onChange }: { readonly onChange: (visible: boolean) => void }) {
  const [visible, setVisible] = useState(true);

  function handleVisibleChange(nextVisible: boolean) {
    onChange(nextVisible);
    setVisible(nextVisible);
  }

  return (
    <>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle Sidebar from View menu
      </button>
      <FinderWindow
        title="Vault"
        sidebar={[
          {
            id: "favorites",
            title: "Favorites",
            items: [{ id: "all", label: "All Files", selected: true, onSelect: () => undefined }],
          },
        ]}
        sidebarVisible={visible}
        onSidebarVisibleChange={handleVisibleChange}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: "e1", onSelect: () => undefined }}
        onOpen={() => undefined}
        iconColumns={3}
      />
    </>
  );
}

function selectedOption(): HTMLElement | undefined {
  return screen.getAllByRole("option").find((option) => option.getAttribute("aria-selected") === "true");
}

function PreviewMountProbe({ onMount }: { readonly onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <span>Preview state</span>;
}

function pressOnGrid(key: string, init: Record<string, unknown> = {}) {
  fireEvent.keyDown(screen.getByRole("listbox"), { key, ...init });
}

describe("finderKeyTarget", () => {
  it("moves vertically by the column count and horizontally by one", () => {
    expect(finderKeyTarget("ArrowDown", 0, 3, 6)).toBe(3);
    expect(finderKeyTarget("ArrowUp", 3, 3, 6)).toBe(0);
    expect(finderKeyTarget("ArrowRight", 0, 3, 6)).toBe(1);
    expect(finderKeyTarget("ArrowLeft", 1, 3, 6)).toBe(0);
  });

  it("stays in-column at vertical boundaries with no modulo wrap", () => {
    expect(finderKeyTarget("ArrowUp", 1, 3, 6)).toBeNull();
    expect(finderKeyTarget("ArrowDown", 4, 3, 6)).toBeNull();
    // Partial last row: 6 entries in 4 columns — column 3 has no second row.
    expect(finderKeyTarget("ArrowDown", 2, 4, 6)).toBeNull();
    expect(finderKeyTarget("ArrowDown", 1, 4, 6)).toBe(5);
  });

  it("clamps horizontal movement at the ends", () => {
    expect(finderKeyTarget("ArrowLeft", 0, 3, 6)).toBeNull();
    expect(finderKeyTarget("ArrowRight", 5, 3, 6)).toBeNull();
    expect(finderKeyTarget("ArrowRight", 2, 3, 6)).toBe(3);
  });

  it("is linear-vertical in list mode and inert horizontally", () => {
    expect(finderKeyTarget("ArrowDown", 2, 1, 6)).toBe(3);
    expect(finderKeyTarget("ArrowUp", 2, 1, 6)).toBe(1);
    expect(finderKeyTarget("ArrowLeft", 2, 1, 6)).toBeNull();
    expect(finderKeyTarget("ArrowRight", 2, 1, 6)).toBeNull();
  });

  it("selects the first entry when nothing is selected", () => {
    expect(finderKeyTarget("ArrowDown", -1, 3, 6)).toBe(0);
    expect(finderKeyTarget("ArrowRight", -1, 3, 6)).toBe(0);
    expect(finderKeyTarget("ArrowDown", -1, 3, 0)).toBeNull();
  });
});

describe("FinderWindow sidebar source list", () => {
  it("renders the quiet header with a trailing disclosure that collapses the section", () => {
    render(<Harness />);
    // The header is a tree row; its label is quiet text (never a nested
    // button/tab stop), and the trailing disclosure is the only control.
    const header = screen.getByRole("row", { name: /Favorites/ });
    expect(header.className).toContain("mc-sidebar-section-header");
    const label = header.querySelector(".mc-sidebar-section-label");
    expect(label?.tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: "Favorites" })).toBeNull();
    // react-aria chains the row label into the chevron's name — match on prefix.
    const disclosure = screen.getByRole("button", { name: /Collapse Favorites/ });
    // Expansion state lives on the row (ARIA tree pattern).
    expect(header.getAttribute("aria-expanded")).toBe("true");
    // Trailing position: the disclosure follows the label in the header row.
    expect(label && label.compareDocumentPosition(disclosure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByRole("row", { name: "All Files" })).toBeDefined();
    fireEvent.click(disclosure);
    expect(screen.queryByRole("row", { name: "All Files" })).toBeNull();
    expect(header.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Expand Favorites/ }));
    expect(screen.getByRole("row", { name: "All Files" })).toBeDefined();
  });

  it("keeps arrow-key navigation and selection on the tree rows", () => {
    const onSelect = vi.fn();
    render(
      <FinderWindow
        title="Vault"
        sidebar={[
          {
            id: "favorites",
            title: "Favorites",
            collapsible: true,
            items: [
              { id: "all", label: "All Files", selected: true, onSelect: () => undefined },
              { id: "shared", label: "Shared", onSelect },
            ],
          },
        ]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: null, onSelect: () => undefined }}
        onOpen={() => undefined}
        iconColumns={3}
      />,
    );
    const selected = screen.getByRole("row", { name: "All Files" });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    // Arrow down from the selected row reaches the next item row...
    act(() => selected.focus());
    fireEvent.keyDown(selected, { key: "ArrowDown" });
    const shared = screen.getByRole("row", { name: "Shared" });
    expect(document.activeElement).toBe(shared);
    // ...and selection follows keyboard focus (source-list behavior), driving
    // the item's onSelect callback.
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("preserves selectable section titles independently from disclosure", () => {
    const onLibrarySelect = vi.fn();
    const onFavoritesSelect = vi.fn();
    render(
      <FinderWindow
        title="Vault"
        sidebar={[
          {
            id: "library",
            title: "Library",
            selected: true,
            onTitleSelect: onLibrarySelect,
            items: [],
          },
          {
            id: "favorites",
            title: "Favorites",
            collapsible: true,
            onTitleSelect: onFavoritesSelect,
            items: [{ id: "all", label: "All Files", onSelect: () => undefined }],
          },
        ]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: null, onSelect: () => undefined }}
        onOpen={() => undefined}
        iconColumns={3}
      />,
    );

    const library = screen.getByRole("row", { name: "Library" });
    expect(library.getAttribute("aria-selected")).toBe("true");
    expect(library.className).toContain("mc-selected");

    const favorites = screen.getByRole("row", { name: /Favorites/ });
    fireEvent.click(favorites);
    expect(onFavoritesSelect).toHaveBeenCalledTimes(1);
    expect(onLibrarySelect).not.toHaveBeenCalled();
    expect(favorites.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Collapse Favorites/ }));
    expect(favorites.getAttribute("aria-expanded")).toBe("false");
    expect(onFavoritesSelect).toHaveBeenCalledTimes(1);
  });

  it("passes SidebarSection.className through to the section root", () => {
    const { container } = render(
      <FinderWindow
        title="Vault"
        sidebar={[{ id: "s", title: "Tags", className: "demo-anchored", items: [] }]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: null, onSelect: () => undefined }}
        onOpen={() => undefined}
        iconColumns={3}
      />,
    );
    expect(container.querySelector(".mc-sidebar-section.demo-anchored")).toBeTruthy();
  });

  it("routes adversarial section and item ids without composite-key collisions", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container } = render(
      <FinderWindow
        title="Vault"
        sidebar={[
          { id: "a:b", title: "First", items: [{ id: "c", label: "First item", onSelect: first }] },
          { id: "a", title: "Second", items: [{ id: "b:c", label: "Second item", onSelect: second }] },
        ]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: null, onSelect: () => undefined }}
        onOpen={() => undefined}
        iconColumns={3}
      />,
    );

    const keys = Array.from(container.querySelectorAll<HTMLElement>("[data-key]"), (row) => row.dataset["key"]);
    expect(new Set(keys).size).toBe(keys.length);
    fireEvent.click(screen.getByRole("row", { name: "Second item" }));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

describe("FinderWindow toolbar", () => {
  it("renders view modes as a divided, exclusive segmented control", () => {
    const { container } = render(<Harness withPreview />);
    const window = container.querySelector<HTMLElement>(".mac-window.mc-finder-window");
    expect(window).toBeTruthy();
    expect(window?.querySelector(".mc-finder-sidebar-top[data-window-drag-handle]")).toBeTruthy();
    expect(window?.querySelectorAll(".traffic-lights button")).toHaveLength(3);
    expect(window?.querySelectorAll("[data-window-resize-handle]")).toHaveLength(8);
    const viewGroup = screen.getByRole("group", { name: "View" });
    expect(viewGroup.classList.contains("mc-capsule")).toBe(true);
    expect(viewGroup.hasAttribute("data-divided")).toBe(true);

    const viewButtons = Array.from(viewGroup.querySelectorAll("button"));
    expect(viewButtons).toHaveLength(2);
    expect(viewButtons.filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("button", { name: "List view" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Icon view" }).getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll(".mc-capsule[data-divided]")).toHaveLength(1);
    expect(container.querySelector(".mc-finder-toolbar .mc-toolbar-actions")?.lastElementChild?.classList.contains("mc-search-bubble")).toBe(true);
  });

  it("keeps preview visibility internally when it is uncontrolled", () => {
    render(<Harness withPreview />);
    expect(screen.getByRole("complementary", { name: "Preview" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Hide Preview" }));
    expect(screen.queryByRole("complementary", { name: "Preview" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show Preview" }));
    expect(screen.getByRole("complementary", { name: "Preview" })).toBeDefined();
  });

  it("mounts preview children once per uncontrolled re-show", () => {
    const onMount = vi.fn();
    render(
      <FinderWindow
        title="Vault"
        sidebar={[]}
        entries={entries}
        mode="icons"
        onModeChange={() => undefined}
        search={{ value: "", onChange: () => undefined }}
        selection={{ selectedId: "e1", onSelect: () => undefined }}
        onOpen={() => undefined}
        preview={() => <PreviewMountProbe onMount={onMount} />}
        iconColumns={3}
      />,
    );
    expect(onMount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Preview" }));

    expect(screen.getByText("Preview state")).toBeDefined();
    expect(onMount).toHaveBeenCalledTimes(2);
  });

  it("mounts preview children once per controlled re-show", () => {
    const onMount = vi.fn();
    render(<ControlledPreviewHarness onChange={() => undefined} onPreviewMount={onMount} />);
    expect(onMount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview from View menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview from View menu" }));

    expect(screen.getByText("Preview state")).toBeDefined();
    expect(onMount).toHaveBeenCalledTimes(2);
  });

  it("keeps sidebar visibility internally when it is uncontrolled", () => {
    render(<Harness />);
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide sidebar" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show sidebar" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeDefined();
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);
  });

  it("preserves collapsed source-list sections across uncontrolled sidebar hide/show", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Collapse Favorites/ }));
    expect(screen.queryByRole("row", { name: "All Files" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));

    const header = screen.getByRole("row", { name: /Favorites/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("row", { name: "All Files" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Expand Favorites/ }));
    expect(screen.getByRole("row", { name: "All Files" })).toBeDefined();
  });

  it("shares controlled sidebar visibility between external commands and the toolbar", () => {
    const onChange = vi.fn();
    render(<ControlledSidebarHarness onChange={onChange} />);
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar from View menu" }));
    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show sidebar" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar from View menu" }));
    expect(screen.getByRole("navigation", { name: "Sidebar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide sidebar" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
  });

  it("shares controlled preview visibility between external commands and the toolbar", () => {
    const onChange = vi.fn();
    render(<ControlledPreviewHarness onChange={onChange} />);
    expect(screen.getByRole("complementary", { name: "Preview" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview from View menu" }));
    expect(screen.queryByRole("complementary", { name: "Preview" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show Preview" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview from View menu" }));
    expect(screen.getByRole("complementary", { name: "Preview" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Hide Preview" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide Preview" }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("complementary", { name: "Preview" })).toBeNull();
  });
});

describe("FinderWindow keyboard selection", () => {
  it("walks the icon grid with 3 columns and 6 entries without wrapping", () => {
    render(<Harness />);
    expect(selectedOption()).toHaveProperty("textContent", expect.stringContaining("Report 1"));

    pressOnGrid("ArrowDown"); // 0 -> 3
    expect(selectedOption()?.textContent).toContain("Report 4");

    pressOnGrid("ArrowDown"); // 3 + 3 = 6 out of range -> stay
    expect(selectedOption()?.textContent).toContain("Report 4");

    pressOnGrid("ArrowRight"); // 3 -> 4
    expect(selectedOption()?.textContent).toContain("Report 5");

    pressOnGrid("ArrowUp"); // 4 -> 1
    expect(selectedOption()?.textContent).toContain("Report 2");

    pressOnGrid("ArrowUp"); // 1 - 3 < 0 -> stay
    expect(selectedOption()?.textContent).toContain("Report 2");

    pressOnGrid("ArrowLeft"); // 1 -> 0
    expect(selectedOption()?.textContent).toContain("Report 1");

    pressOnGrid("ArrowLeft"); // clamp at 0
    expect(selectedOption()?.textContent).toContain("Report 1");
  });

  it("moves focus with the selection", () => {
    render(<Harness />);
    pressOnGrid("ArrowRight");
    const option = selectedOption();
    expect(option?.textContent).toContain("Report 2");
    expect(document.activeElement).toBe(option);
  });

  it("selects the first entry from an empty selection", () => {
    render(<Harness initialSelection={null} />);
    expect(selectedOption()).toBeUndefined();
    pressOnGrid("ArrowDown");
    expect(selectedOption()?.textContent).toContain("Report 1");
  });

  it("opens with Meta+ArrowDown and keeps keyboard focus in the grid", () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    pressOnGrid("ArrowDown", { metaKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ id: "e1", kind: "folder" });
    // Selection did not move: meta-arrow is open, not navigation.
    expect(selectedOption()?.textContent).toContain("Report 1");
    expect(document.activeElement).toBe(screen.getByRole("listbox"));
  });

  it("opens on double-click", () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    const option = screen.getAllByRole("option")[1];
    expect(option).toBeDefined();
    if (!option) return;
    fireEvent.dblClick(option);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ id: "e2" });
  });
});

describe("FinderWindow content grid tab order", () => {
  it("is a single tab stop: the selected entry roves, the rest are tabindex -1", () => {
    render(<Harness initialSelection="e2" />);
    const options = screen.getAllByRole("option");
    const stops = options.filter((option) => option.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]?.textContent).toContain("Report 2");
    expect(options.filter((option) => option.getAttribute("tabindex") === "-1")).toHaveLength(options.length - 1);
  });

  it("falls back to the first entry as the tab stop when nothing is selected", () => {
    render(<Harness initialSelection={null} />);
    const options = screen.getAllByRole("option");
    expect(options[0]?.getAttribute("tabindex")).toBe("0");
    expect(options.filter((option) => option.getAttribute("tabindex") === "0")).toHaveLength(1);
  });
});

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("QuickLook focus management", () => {
  it("moves focus into the dialog, traps Tab, and restores the opener on close", async () => {
    render(<Harness />);
    const option = screen.getAllByRole("option")[0];
    expect(option).toBeDefined();
    if (!option) return;
    act(() => option.focus());
    fireEvent.keyDown(option, { key: " " });
    const dialog = screen.getByRole("dialog");
    await flushAnimationFrame();
    const close = screen.getByRole("button", { name: "Close Quick Look" });
    // Focus moved into the dialog (its first control).
    expect(document.activeElement).toBe(close);
    // Tab is trapped: with one control, focus wraps onto itself.
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    // Escape closes and focus returns to the invoking grid option.
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dialog.isConnected).toBe(false);
    await flushAnimationFrame();
    expect(document.activeElement).toBe(option);
  });
});
