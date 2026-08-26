"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Group, Panel, Separator, type PanelSize } from "react-resizable-panels";

import { useModalFocusTrap } from "./modal-focus";
import { MacWindowStatusBar } from "./presentation.tsx";
import {
  MacSourceList,
  type MacSourceListSection,
} from "./navigation.tsx";
import { SystemSymbol } from "./system-symbol";
import { MacToolbar, ToolbarButton, ToolbarCapsule, ToolbarSearchBubble } from "./toolbar";
import { TrafficLights, WindowChrome, type WindowFrame } from "./window";
import "./styles/tokens.css";
import "./styles/finder.css";

/* Default geometry (macOS Finder-ish proportions on the 1200px canvas). */
const finderDefaultSize = { width: 940, height: 580 } as const;
const finderMinSize = { width: 660, height: 380 } as const;

export type FinderEntry = {
  readonly id: string;
  readonly name: string;
  // Free-form; "folder" gains the open affordance hints (title, aria-keyshortcuts).
  readonly kind: string;
  readonly icon: ReactNode;
  readonly modified?: string;
  readonly size?: string;
  readonly badge?: string;
  readonly draggable?: boolean;
};

export type SidebarItem = {
  readonly id: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly badge?: ReactNode;
  readonly indent?: boolean;
  readonly selected?: boolean;
  readonly onSelect: () => void;
};

export type SidebarSection = {
  readonly id: string;
  // An untitled section renders as a plain leading block: no header, no divider.
  readonly title?: string;
  readonly collapsible?: boolean;
  readonly count?: number;
  readonly selected?: boolean;
  readonly onTitleSelect?: () => void;
  readonly action?: ReactNode;
  /** Extra class on the section's lead row (e.g. a product's bottom-anchored section). */
  readonly className?: string;
  readonly items: readonly SidebarItem[];
};

export type FinderViewMode = "icons" | "list";

export type FinderSelection = {
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
};

export type FinderSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

/* Finder's callback-per-row compatibility model adapts into MacSourceList's
   collection-level controlled selection. Prefix both kinds so consumer ids
   can safely overlap between sections and items. */
function finderSidebarSectionId(id: string): string {
  return `finder-section:${id}`;
}

function finderSidebarItemId(sectionId: string, itemId: string): string {
  return `finder-item:${sectionId}:${itemId}`;
}

function selectedFinderSidebarId(sections: readonly SidebarSection[]): string | null {
  for (const section of sections) {
    if (section.title !== undefined && section.selected) return finderSidebarSectionId(section.id);
    const selectedItem = section.items.find((item) => item.selected);
    if (selectedItem !== undefined) return finderSidebarItemId(section.id, selectedItem.id);
  }
  return null;
}

const sidebarWidth = 224;
const contentMinWidth = 210;
const previewMinWidth = 220;
const previewMaxWidth = 350;
const previewDefaultWidth = 270;
/* react-resizable-panels collapses a collapsible panel when a drag crosses
   (collapsedSize + minSize) / 2 — (80 + 220) / 2 = 150, the house collapse
   threshold. The collapsed panel never renders at 80px: the resize callback
   hides the preview (and returns focus to the toolbar toggle) immediately. */
const previewCollapseWidth = 150;
const previewCollapsedSize = 2 * previewCollapseWidth - previewMinWidth;

/* Panels are flex containers; the surface element inside stretches to fill. */
const paneStyle: CSSProperties = { display: "flex", overflow: "hidden" };

// Pure arrow-key selection math. Returns the next entry index, or null for no
// movement. Contract: vertical movement is by `columns` and stays in-column at
// the boundaries (a partial last row blocks descent); horizontal movement is
// linear and clamped; nothing ever wraps modulo the grid. `columns === 1`
// (list mode) makes Left/Right inert. An index outside the list selects the
// first entry.
export function finderKeyTarget(key: string, index: number, columns: number, count: number): number | null {
  if (count === 0) return null;
  if (index < 0 || index >= count) {
    return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" ? 0 : null;
  }
  switch (key) {
    case "ArrowLeft":
      return columns > 1 && index > 0 ? index - 1 : null;
    case "ArrowRight":
      return columns > 1 && index < count - 1 ? index + 1 : null;
    case "ArrowUp":
      return index - columns >= 0 ? index - columns : null;
    case "ArrowDown":
      return index + columns < count ? index + columns : null;
    default:
      return null;
  }
}

export function QuickLook({
  entry,
  detail,
  onClose,
}: {
  readonly entry: FinderEntry;
  readonly detail?: ReactNode;
  readonly onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  // Modal contract: focus moves into the panel (close button) on open, Tab is
  // trapped inside, Escape cancels, and focus restores to the opener on close.
  const handleModalKeyDown = useModalFocusTrap({ dialogRef: panelRef, onCancel: onClose });

  const meta = [entry.modified, entry.size].filter((part) => part !== undefined).join(" · ");
  return (
    <div
      className="mc-quicklook-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="mc-quicklook-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Quick Look ${entry.name}`}
        onKeyDown={handleModalKeyDown}
      >
        <header>
          <button type="button" onClick={onClose} aria-label="Close Quick Look">
            <SystemSymbol name="xmark" />
          </button>
          <strong>{entry.name}</strong>
          <span />
        </header>
        <div>
          <span className="mc-quicklook-icon" aria-hidden="true">{entry.icon}</span>
          <h2>{entry.name}</h2>
          {detail}
          {meta ? <small>{meta}</small> : null}
        </div>
      </section>
    </div>
  );
}

export function FinderWindow({
  sidebar,
  sidebarHeader,
  sidebarVisible,
  onSidebarVisibleChange,
  entries,
  mode,
  onModeChange,
  search,
  selection,
  onOpen,
  onDrop,
  preview,
  previewVisible,
  onPreviewVisibleChange,
  statusBar,
  toolbarExtras,
  title,
  label,
  frame,
  onClose,
  onMinimize,
  onZoom,
  iconColumns,
}: {
  readonly sidebar: readonly SidebarSection[];
  // Rendered flat at the top of the sidebar column, above all sections.
  readonly sidebarHeader?: ReactNode;
  /** Controlled sidebar visibility. Omit to keep the default-visible internal state. */
  readonly sidebarVisible?: boolean;
  readonly onSidebarVisibleChange?: (visible: boolean) => void;
  readonly entries: readonly FinderEntry[];
  readonly mode: FinderViewMode;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly search: FinderSearch;
  readonly selection: FinderSelection;
  readonly onOpen: (entry: FinderEntry) => void;
  readonly onDrop?: (transfer: DataTransfer) => void;
  readonly preview?: (selection: FinderEntry | null) => ReactNode;
  /** Controlled preview-pane visibility. Omit to keep the default-visible internal state. */
  readonly previewVisible?: boolean;
  readonly onPreviewVisibleChange?: (visible: boolean) => void;
  readonly statusBar?: ReactNode;
  readonly toolbarExtras?: ReactNode;
  readonly title?: string;
  readonly label?: string;
  /** Placement/size override; defaults to ~940x580, centered. */
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
  // Layout override for the icon-grid column count; by default the rendered
  // grid is measured. Also the deterministic seam for non-layout test DOMs.
  readonly iconColumns?: number;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [uncontrolledSidebarVisible, setUncontrolledSidebarVisible] = useState(true);
  const isSidebarVisible = sidebarVisible ?? uncontrolledSidebarVisible;
  const [uncontrolledPreviewVisible, setUncontrolledPreviewVisible] = useState(true);
  const isPreviewVisible = previewVisible ?? uncontrolledPreviewVisible;
  // Bumped on every re-show so the remounted preview panel gets a fresh id —
  // the panel group must not restore the collapsed layout it hid at.
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const previousPreviewVisible = useRef(isPreviewVisible);
  const [quickLookId, setQuickLookId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewToggleRef = useRef<HTMLButtonElement>(null);
  // "entry id" focuses that entry's option; "content" re-anchors keyboard focus
  // on the grid after an open replaces the entries.
  const keyboardFocusPending = useRef<string | null>(null);

  const selectedEntry = entries.find((entry) => entry.id === selection.selectedId) ?? null;
  const quickLookEntry = quickLookId === null ? null : entries.find((entry) => entry.id === quickLookId) ?? null;
  const previewOpen = preview !== undefined && isPreviewVisible;
  const sourceListSections: readonly MacSourceListSection[] = sidebar.map((section) => ({
    id: finderSidebarSectionId(section.id),
    title: section.title,
    collapsible: section.collapsible,
    count: section.count,
    action: section.action,
    className: section.className,
    items: section.items.map((item) => ({
      id: finderSidebarItemId(section.id, item.id),
      icon: item.icon,
      label: item.label,
      badge: item.badge,
      indent: item.indent,
    })),
  }));
  const sourceListSelectedId = selectedFinderSidebarId(sidebar);
  // Roving tabindex: the grid is one tab stop (the selected entry, else the
  // first); arrow keys rove within it.
  const tabStopId = selectedEntry !== null ? selectedEntry.id : entries[0]?.id;

  useEffect(() => {
    const pending = keyboardFocusPending.current;
    if (pending === null) return;
    keyboardFocusPending.current = null;
    const grid = contentRef.current;
    if (!grid) return;
    if (pending === " content") {
      grid.focus();
      return;
    }
    for (const option of grid.querySelectorAll<HTMLElement>("[data-mc-entry-id]")) {
      if (option.dataset["mcEntryId"] === pending) {
        option.focus();
        return;
      }
    }
    grid.focus();
  });

  useEffect(() => {
    const wasVisible = previousPreviewVisible.current;
    previousPreviewVisible.current = isPreviewVisible;
    // A controlled parent can show the preview without going through the
    // toolbar callback. Give that externally driven re-show the same fresh
    // panel identity as the built-in toggle so a collapsed width is not
    // restored by react-resizable-panels.
    if (isPreviewVisible && !wasVisible) {
      setPreviewGeneration((generation) => generation + 1);
    }
  }, [isPreviewVisible]);

  function columnsForNavigation(): number {
    if (mode === "list") return 1;
    if (iconColumns !== undefined && iconColumns >= 1) return Math.floor(iconColumns);
    const grid = contentRef.current;
    if (!grid) return 1;
    const template = window.getComputedStyle(grid).gridTemplateColumns;
    const tracks = template.split(" ").filter((track) => track !== "" && track !== "none");
    if (tracks.length > 0) return tracks.length;
    // Layout fallback: count entries sharing the first row's offset.
    const options = grid.querySelectorAll<HTMLElement>("[data-mc-entry-id]");
    const first = options[0];
    if (!first) return 1;
    let columns = 0;
    for (const option of options) {
      if (option.offsetTop !== first.offsetTop) break;
      columns += 1;
    }
    return Math.max(columns, 1);
  }

  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const index = entries.findIndex((entry) => entry.id === selection.selectedId);
    const selected = index >= 0 ? entries[index] : undefined;

    if (event.metaKey && event.key === "ArrowDown") {
      if (selected) {
        event.preventDefault();
        // Anchor focus on the grid now (the focused option may disappear when
        // the consumer swaps entries) and re-assert it after that re-render.
        keyboardFocusPending.current = " content";
        contentRef.current?.focus();
        onOpen(selected);
      }
      return;
    }
    if (event.key === " ") {
      if (selected) {
        event.preventDefault();
        setQuickLookId(selected.id);
      }
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const next = finderKeyTarget(event.key, index, columnsForNavigation(), entries.length);
    if (next === null) return;
    const entry = entries[next];
    if (!entry) return;
    keyboardFocusPending.current = entry.id;
    selection.onSelect(entry.id);
  }

  function setPreviewVisibility(visible: boolean) {
    if (previewVisible === undefined) setUncontrolledPreviewVisible(visible);
    onPreviewVisibleChange?.(visible);
  }

  function setSidebarVisibility(visible: boolean) {
    if (sidebarVisible === undefined) setUncontrolledSidebarVisible(visible);
    onSidebarVisibleChange?.(visible);
  }

  function toggleSidebar() {
    setSidebarVisibility(!isSidebarVisible);
  }

  function togglePreview() {
    setPreviewVisibility(!isPreviewVisible);
  }

  function handlePreviewResize(size: PanelSize, _id: string | number | undefined, previous: PanelSize | undefined) {
    if (previous === undefined) return;
    // Crossing the collapse threshold (drag past it, or the separator's Enter
    // collapse) hides the preview and returns focus to the toolbar toggle.
    if (size.inPixels < previewCollapseWidth && previous.inPixels >= previewCollapseWidth) {
      previewToggleRef.current?.focus();
      setPreviewVisibility(false);
    }
  }

  function handleDragEnter(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    event.preventDefault();
    setDropActive(true);
  }

  function handleDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  }

  function handleDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false);
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (!onDrop) return;
    event.preventDefault();
    setDropActive(false);
    onDrop(event.dataTransfer);
  }

  function handleSourceListSelection(id: string) {
    for (const section of sidebar) {
      if (id === finderSidebarSectionId(section.id)) {
        section.onTitleSelect?.();
        return;
      }
      for (const item of section.items) {
        if (id === finderSidebarItemId(section.id, item.id)) {
          item.onSelect();
          return;
        }
      }
    }
  }

  return (
    <WindowChrome
      className="mc-finder-window"
      label={label ?? title ?? "Finder"}
      frame={frame}
      defaultSize={finderDefaultSize}
      minSize={finderMinSize}
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
    >
      {/* Three-pane split (NavigationSplitView) on react-resizable-panels:
          fixed sidebar, flexible content, clamped collapsible preview with an
          ARIA window-splitter separator. Nothing persists. */}
      <Group className="mc-finder-split">
        {isSidebarVisible ? (
          <Panel id="sidebar" disabled defaultSize={sidebarWidth} groupResizeBehavior="preserve-pixel-size" style={paneStyle}>
            <aside className="mc-finder-sidebar">
              <div className="mc-finder-sidebar-top" data-window-drag-handle="">
                <TrafficLights />
              </div>
              {sidebarHeader !== undefined ? <div className="mc-finder-sidebar-header">{sidebarHeader}</div> : null}
              <nav aria-label="Sidebar">
                <MacSourceList
                  sections={sourceListSections}
                  selectedId={sourceListSelectedId}
                  onSelectionChange={handleSourceListSelection}
                />
              </nav>
            </aside>
          </Panel>
        ) : null}
        <Panel id="content" minSize={contentMinWidth} style={paneStyle}>
          <main className="mc-finder-main">
            {/* macOS 27 Finder anatomy: title left-aligned in the leading area,
                capsule controls trailing. Slot mode = the parity look for free. */}
            <MacToolbar
              className="mc-finder-toolbar"
              leading={(
                <>
                  {!isSidebarVisible ? <TrafficLights /> : null}
                  <ToolbarButton
                    label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                    pressed={isSidebarVisible}
                    onClick={toggleSidebar}
                  >
                    <SystemSymbol name="sidebar.left" />
                  </ToolbarButton>
                </>
              )}
              title={title}
              trailing={
                <>
                  {toolbarExtras}
                  <ToolbarCapsule className="mc-finder-view-control" divided role="group" label="View">
                    <ToolbarButton
                      label="Icon view"
                      pressed={mode === "icons"}
                      selected={mode === "icons"}
                      onClick={() => onModeChange("icons")}
                    >
                      <SystemSymbol name="square.grid.2x2" />
                    </ToolbarButton>
                    <ToolbarButton
                      label="List view"
                      pressed={mode === "list"}
                      selected={mode === "list"}
                      onClick={() => onModeChange("list")}
                    >
                      <SystemSymbol name="list.bullet" />
                    </ToolbarButton>
                  </ToolbarCapsule>
                  {preview !== undefined ? (
                    <ToolbarButton
                      ref={previewToggleRef}
                      className="mc-finder-preview-toggle"
                      label={isPreviewVisible ? "Hide Preview" : "Show Preview"}
                      title={`${isPreviewVisible ? "Hide" : "Show"} Preview`}
                      pressed={isPreviewVisible}
                      selected={isPreviewVisible}
                      onClick={togglePreview}
                    >
                      <SystemSymbol name="sidebar.trailing" />
                    </ToolbarButton>
                  ) : null}
                  <ToolbarSearchBubble
                    open={searchOpen}
                    value={search.value}
                    label="Search"
                    placeholder="Search"
                    onOpenChange={(open) => {
                      setSearchOpen(open);
                      if (!open) search.onChange("");
                    }}
                    onChange={search.onChange}
                  />
                </>
              }
            />
            {mode === "list" ? (
              <div className="mc-finder-list-head" aria-hidden="true">
                <span />
                <span>Name</span>
                <span>Modified</span>
                <span>Size</span>
              </div>
            ) : null}
            <div
              ref={contentRef}
              role="listbox"
              aria-label={title ?? "Files"}
              tabIndex={-1}
              className={`mc-finder-content mc-${mode}${dropActive ? " mc-drop-active" : ""}`}
              onKeyDown={handleContentKeyDown}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {entries.map((entry) => {
                const isSelected = selection.selectedId === entry.id;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={entry.id === tabStopId ? 0 : -1}
                    className={`mc-finder-entry${isSelected ? " mc-selected" : ""}`}
                    data-mc-entry-id={entry.id}
                    key={entry.id}
                    draggable={entry.draggable === true ? true : undefined}
                    onDragStart={
                      entry.draggable === true
                        ? (event) => {
                            event.dataTransfer.setData("text/plain", entry.id);
                            event.dataTransfer.effectAllowed = "copyMove";
                          }
                        : undefined
                    }
                    onClick={() => selection.onSelect(entry.id)}
                    onDoubleClick={() => onOpen(entry)}
                    title={entry.kind === "folder" ? "Double-click to open" : undefined}
                    aria-keyshortcuts={entry.kind === "folder" ? "Meta+ArrowDown" : undefined}
                  >
                    <span className="mc-finder-entry-icon" aria-hidden="true">{entry.icon}</span>
                    <span className="mc-finder-name">
                      {entry.name}
                      {entry.badge !== undefined ? <i className="mc-finder-badge">{entry.badge}</i> : null}
                    </span>
                    <span className="mc-finder-modified">{entry.modified ?? ""}</span>
                    <span className="mc-finder-size">{entry.size ?? ""}</span>
                  </button>
                );
              })}
            </div>
            {statusBar !== undefined ? <MacWindowStatusBar className="mc-finder-status">{statusBar}</MacWindowStatusBar> : null}
          </main>
        </Panel>
        {previewOpen ? (
          <>
            <Separator className="mc-preview-resize-handle" aria-label="Resize Preview pane" />
            <Panel
              id={`preview-${previewGeneration}`}
              collapsible
              collapsedSize={previewCollapsedSize}
              minSize={previewMinWidth}
              maxSize={previewMaxWidth}
              defaultSize={previewDefaultWidth}
              groupResizeBehavior="preserve-pixel-size"
              onResize={handlePreviewResize}
              style={paneStyle}
            >
              <aside className="mc-finder-preview" aria-label="Preview">
                <div className="mc-finder-preview-body">{preview(selectedEntry)}</div>
              </aside>
            </Panel>
          </>
        ) : null}
      </Group>
      {quickLookEntry ? <QuickLook entry={quickLookEntry} onClose={() => setQuickLookId(null)} /> : null}
    </WindowChrome>
  );
}
