import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
}: {
  readonly onOpen?: (entry: FinderEntry) => void;
  readonly initialSelection?: string | null;
  readonly iconColumns?: number;
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
      iconColumns={iconColumns}
    />
  );
}

function selectedOption(): HTMLElement | undefined {
  return screen.getAllByRole("option").find((option) => option.getAttribute("aria-selected") === "true");
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
