import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MacInspector,
  MacNavigationSplitView,
  MacSourceList,
  type MacSourceListSection,
} from "../navigation.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MacNavigationSplitView", () => {
  it("server-renders the final normalized panel ratios instead of correcting them after hydration", () => {
    const html = renderToStaticMarkup(
      <MacNavigationSplitView
        id="stable-layout"
        sidebar={<div>Sidebar</div>}
        sidebarSizing={{ defaultSize: 224 }}
        detail={<div>Detail</div>}
        detailSizing={{ defaultSize: 620 }}
      />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const sidebar = container.querySelector<HTMLElement>("#stable-layout-sidebar");
    const detail = container.querySelector<HTMLElement>("#stable-layout-detail");

    expect(Number(sidebar?.style.flexGrow)).toBeCloseTo(224 / 844 * 100);
    expect(Number(detail?.style.flexGrow)).toBeCloseTo(620 / 844 * 100);
    expect(sidebar?.style.flexBasis).toBe("0px");
    expect(detail?.style.flexBasis).toBe("0px");
  });

  it("preserves unlike CSS units instead of normalizing their numeric prefixes", () => {
    const html = renderToStaticMarkup(
      <MacNavigationSplitView
        id="mixed-units"
        sidebar={<div>Sidebar</div>}
        sidebarSizing={{ defaultSize: "50%" }}
        detail={<div>Detail</div>}
        detailSizing={{ defaultSize: "500px" }}
      />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const sidebar = container.querySelector<HTMLElement>("#mixed-units-sidebar");
    const detail = container.querySelector<HTMLElement>("#mixed-units-detail");

    expect(sidebar?.style.flexBasis).toBe("50%");
    expect(detail?.style.flexBasis).toBe("500px");
    expect(sidebar?.style.flexGrow).toBe("");
    expect(detail?.style.flexGrow).toBe("");
  });

  it("composes a resizable two-column sidebar and detail layout", () => {
    const { container } = render(
      <MacNavigationSplitView
        id="library"
        sidebar={<div>Library navigation</div>}
        detail={<div>Selected component</div>}
      />,
    );

    expect(screen.getByRole("complementary", { name: "Sidebar" }).textContent).toContain("Library navigation");
    expect(screen.getByRole("region", { name: "Detail" }).textContent).toContain("Selected component");
    expect(screen.queryByRole("region", { name: "Content" })).toBeNull();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(container.querySelectorAll("[data-panel]")).toHaveLength(2);
    expect(screen.getByTestId("library-sidebar")).toBeTruthy();
    expect(screen.getByTestId("library-detail")).toBeTruthy();
  });

  it("adds the optional middle navigation column and obeys controlled sidebar visibility", () => {
    const { container, rerender } = render(
      <MacNavigationSplitView
        id="catalog"
        sidebar={<div>Categories</div>}
        content={<div>Components</div>}
        detail={<div>Preview</div>}
      />,
    );

    expect(screen.getByRole("region", { name: "Content" }).textContent).toContain("Components");
    expect(container.querySelectorAll("[data-panel]")).toHaveLength(3);
    expect(screen.getAllByRole("separator")).toHaveLength(2);

    rerender(
      <MacNavigationSplitView
        id="catalog"
        sidebar={<div>Categories</div>}
        sidebarVisible={false}
        content={<div>Components</div>}
        detail={<div>Preview</div>}
      />,
    );

    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
    expect(container.querySelectorAll("[data-panel]")).toHaveLength(2);
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });
});

const sourceSections: readonly MacSourceListSection[] = [
  {
    id: "library",
    title: "Library",
    collapsible: true,
    items: [
      { id: "all", label: "All Components" },
      { id: "shared", label: "Shared" },
    ],
  },
  {
    id: "recent",
    title: "Recent",
    items: [{ id: "menus", label: "Menus" }],
  },
];

function SourceListHarness({ onSelection }: { readonly onSelection: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>("all");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(["library"]));

  return (
    <MacSourceList
      label="Components"
      sections={sourceSections}
      selectedId={selectedId}
      onSelectionChange={(id) => {
        onSelection(id);
        setSelectedId(id);
      }}
      expandedSectionIds={expandedIds}
      onExpandedSectionIdsChange={setExpandedIds}
    />
  );
}

describe("MacSourceList", () => {
  it("selects only explicitly selectable section headings without conflating disclosure", () => {
    const onItemSelection = vi.fn();
    const onSectionSelection = vi.fn();
    render(
      <MacSourceList
        label="Components"
        sections={[{
          id: "library",
          title: "Library",
          collapsible: true,
          selectable: true,
          items: [
            { id: "all", label: "All Components" },
            { id: "shared", label: "Shared" },
          ],
        }]}
        selectedId="all"
        selectedSectionId={null}
        onSelectionChange={onItemSelection}
        onSectionSelectionChange={onSectionSelection}
      />,
    );
    const library = screen.getByRole("row", { name: /Library/ });

    fireEvent.click(screen.getByRole("button", { name: /Collapse Library/ }));
    expect(onSectionSelection).not.toHaveBeenCalled();

    fireEvent.click(library);
    expect(onSectionSelection).toHaveBeenCalledWith("library");
    expect(onItemSelection).not.toHaveBeenCalled();
  });

  it("drives collection-level controlled selection with arrow navigation", () => {
    const onSelection = vi.fn();
    render(<SourceListHarness onSelection={onSelection} />);

    const all = screen.getByRole("row", { name: "All Components" });
    expect(all.getAttribute("aria-selected")).toBe("true");
    act(() => all.focus());
    fireEvent.keyDown(all, { key: "ArrowDown" });

    const shared = screen.getByRole("row", { name: "Shared" });
    expect(document.activeElement).toBe(shared);
    expect(shared.getAttribute("aria-selected")).toBe("true");
    expect(onSelection).toHaveBeenLastCalledWith("shared");
  });

  it("moves focus to the pointer-selected row", () => {
    const onSelection = vi.fn();
    render(<SourceListHarness onSelection={onSelection} />);
    const all = screen.getByRole("row", { name: "All Components" });
    const shared = screen.getByRole("row", { name: "Shared" });
    act(() => all.focus());
    expect(document.activeElement).toBe(all);

    fireEvent.click(shared);

    expect(shared.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(shared);
    expect(onSelection).toHaveBeenLastCalledWith("shared");
  });

  it("uses item text values for source-list typeahead", () => {
    const onSelection = vi.fn();
    render(<SourceListHarness onSelection={onSelection} />);
    const all = screen.getByRole("row", { name: "All Components" });
    act(() => all.focus());

    fireEvent.keyDown(all, { key: "s" });

    expect(document.activeElement).toBe(screen.getByRole("row", { name: "Shared" }));
    expect(onSelection).not.toHaveBeenCalled();
  });

  it("exposes controlled section disclosure through the tree pattern", () => {
    const onSelection = vi.fn();
    render(<SourceListHarness onSelection={onSelection} />);
    const library = screen.getByRole("row", { name: /Library/ });
    expect(library.getAttribute("aria-expanded")).toBe("true");
    expect(library.getAttribute("aria-selected")).not.toBe("true");
    expect(screen.getByRole("row", { name: "Shared" })).toBeTruthy();
    expect(
      library.querySelector(".mc-sidebar-disclosure .mc-system-symbol")?.getAttribute("data-system-symbol"),
    ).toBe("chevron.down");

    fireEvent.click(library);
    expect(document.activeElement).toBe(library);
    expect(onSelection).not.toHaveBeenCalled();
    expect(screen.getByRole("row", { name: "All Components" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Collapse Library/ }));

    expect(library.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("row", { name: "Shared" })).toBeNull();
    const expandButton = screen.getByRole("button", { name: /Expand Library/ });
    expect(
      expandButton.querySelector(".mc-sidebar-disclosure .mc-system-symbol")?.getAttribute("data-system-symbol"),
    ).toBe("chevron.right");
  });
});

describe("MacInspector", () => {
  it("measures a controlled CSS width for ARIA and follows rendered geometry changes", () => {
    let renderedWidth = 315;
    let notifyResize: () => void = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      return this.classList.contains("mc-inspector")
        ? new DOMRect(0, 0, renderedWidth, 500)
        : new DOMRect();
    });
    render(
      <MacInspector label="Details Inspector" width="50%">
        Metadata
      </MacInspector>,
    );
    const separator = screen.getByRole("separator", { name: "Resize Details Inspector" });
    const inspector = screen.getByRole("complementary", { name: "Details Inspector" });

    expect(inspector.style.width).toBe("50%");
    expect(separator.getAttribute("aria-valuenow")).toBe("315");

    renderedWidth = 340;
    act(() => notifyResize());
    expect(separator.getAttribute("aria-valuenow")).toBe("340");
  });

  it("stays a separately controlled supplementary pane", () => {
    const { rerender } = render(
      <MacInspector label="Details Inspector" width={288}>
        Metadata
      </MacInspector>,
    );
    const inspector = screen.getByRole("complementary", { name: "Details Inspector" });
    expect(inspector.textContent).toContain("Metadata");
    expect(inspector.style.width).toBe("288px");

    rerender(
      <MacInspector label="Details Inspector" visible={false}>
        Metadata
      </MacInspector>,
    );
    expect(screen.queryByRole("complementary", { name: "Details Inspector" })).toBeNull();
    expect(screen.queryByRole("separator", { name: "Resize Details Inspector" })).toBeNull();
  });

  it("resizes from its leading edge with a pointer and reports controlled width", () => {
    function ControlledInspector() {
      const [width, setWidth] = useState(260);
      return (
        <MacInspector label="Details Inspector" width={width} onWidthChange={setWidth}>
          Metadata
        </MacInspector>
      );
    }

    render(<ControlledInspector />);
    const separator = screen.getByRole("separator", { name: "Resize Details Inspector" });
    const inspector = screen.getByRole("complementary", { name: "Details Inspector" });
    expect(separator.getAttribute("aria-controls")).toBe(inspector.id);
    expect(separator.getAttribute("aria-valuenow")).toBe("260");

    // jsdom has no PointerEvent constructor. MouseEvent still carries the
    // pointer coordinate contract when dispatched under pointer event names.
    fireEvent(separator, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 500 }));
    fireEvent(separator, new MouseEvent("pointermove", { bubbles: true, clientX: 460 }));
    fireEvent(separator, new MouseEvent("pointerup", { bubbles: true, clientX: 460 }));

    expect(inspector.style.width).toBe("300px");
    expect(separator.getAttribute("aria-valuenow")).toBe("300");
  });

  it("supports clamped keyboard resizing in uncontrolled use", () => {
    const onWidthChange = vi.fn();
    render(
      <MacInspector
        label="Details Inspector"
        defaultWidth={250}
        minWidth={230}
        maxWidth={270}
        onWidthChange={onWidthChange}
      >
        Metadata
      </MacInspector>,
    );
    const separator = screen.getByRole("separator", { name: "Resize Details Inspector" });
    const inspector = screen.getByRole("complementary", { name: "Details Inspector" });

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(inspector.style.width).toBe("260px");
    expect(onWidthChange).toHaveBeenLastCalledWith(260);

    fireEvent.keyDown(separator, { key: "End" });
    expect(inspector.style.width).toBe("270px");
    expect(separator.getAttribute("aria-valuenow")).toBe("270");

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(inspector.style.width).toBe("270px");
    expect(onWidthChange).toHaveBeenLastCalledWith(270);

    fireEvent.keyDown(separator, { key: "Home" });
    expect(inspector.style.width).toBe("230px");
    expect(separator.getAttribute("aria-valuenow")).toBe("230");
  });
});
