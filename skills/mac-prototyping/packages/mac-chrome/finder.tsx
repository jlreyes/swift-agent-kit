import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { SystemSymbol } from "./system-symbol";
import { MacToolbar, ToolbarButton, ToolbarCapsule, ToolbarSearchBubble } from "./toolbar";
import { TrafficLights, WindowChrome } from "./window";
import "./styles/tokens.css";
import "./styles/finder.css";

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
  readonly badge?: string | number;
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

const previewMinWidth = 220;
const previewMaxWidth = 350;
const previewCollapseWidth = 150;
const previewDefaultWidth = 270;
const previewKeyboardStep = 16;
const sidebarWidth = 224;

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
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const meta = [entry.modified, entry.size].filter((part) => part !== undefined).join(" · ");
  return (
    <div
      className="mc-quicklook-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="mc-quicklook-panel" role="dialog" aria-modal="true" aria-label={`Quick Look ${entry.name}`}>
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

function FinderSidebarSection({ section }: { readonly section: SidebarSection }) {
  const [expanded, setExpanded] = useState(true);
  const items = (
    <div className="mc-sidebar-items">
      {section.items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`mc-sidebar-item${item.selected ? " mc-selected" : ""}${item.indent ? " mc-indent" : ""}`}
          aria-current={item.selected ? "true" : undefined}
          onClick={item.onSelect}
        >
          {item.icon !== undefined ? <span className="mc-sidebar-item-icon" aria-hidden="true">{item.icon}</span> : null}
          <span className="mc-sidebar-item-label">{item.label}</span>
          {item.badge !== undefined ? <small className="mc-sidebar-item-badge">{item.badge}</small> : null}
        </button>
      ))}
    </div>
  );

  if (section.title === undefined) {
    return <section className="mc-sidebar-section mc-plain">{items}</section>;
  }

  const collapsible = section.collapsible ?? false;
  return (
    <section className="mc-sidebar-section">
      <div
        className={`mc-sidebar-section-header${section.selected ? " mc-selected" : ""}${section.action !== undefined ? " mc-has-action" : ""}`}
      >
        {collapsible ? (
          <button
            type="button"
            className="mc-sidebar-disclosure-button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${section.title}`}
            onClick={() => setExpanded((current) => !current)}
          >
            <span className={`mc-sidebar-disclosure${expanded ? " mc-open" : ""}`}>
              <SystemSymbol name="chevron.right" />
            </span>
          </button>
        ) : (
          <span className="mc-sidebar-disclosure-spacer" />
        )}
        <button
          type="button"
          className="mc-sidebar-section-label"
          aria-expanded={collapsible ? expanded : undefined}
          onClick={section.onTitleSelect}
        >
          <strong>{section.title}</strong>
          {section.count !== undefined ? <small>{section.count}</small> : null}
        </button>
        {section.action}
      </div>
      {expanded ? items : null}
    </section>
  );
}

export function FinderWindow({
  sidebar,
  entries,
  mode,
  onModeChange,
  search,
  selection,
  onOpen,
  onDrop,
  preview,
  statusBar,
  toolbarExtras,
  title,
  label,
  iconColumns,
}: {
  readonly sidebar: readonly SidebarSection[];
  readonly entries: readonly FinderEntry[];
  readonly mode: FinderViewMode;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly search: FinderSearch;
  readonly selection: FinderSelection;
  readonly onOpen: (entry: FinderEntry) => void;
  readonly onDrop?: (transfer: DataTransfer) => void;
  readonly preview?: (selection: FinderEntry | null) => ReactNode;
  readonly statusBar?: ReactNode;
  readonly toolbarExtras?: ReactNode;
  readonly title?: string;
  readonly label?: string;
  // Layout override for the icon-grid column count; by default the rendered
  // grid is measured. Also the deterministic seam for non-layout test DOMs.
  readonly iconColumns?: number;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(previewDefaultWidth);
  const [quickLookId, setQuickLookId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previewToggleRef = useRef<HTMLButtonElement>(null);
  const previewResizeRef = useRef<{
    readonly pointerId: number;
    readonly startX: number;
    readonly startWidth: number;
  } | null>(null);
  // "entry id" focuses that entry's option; "content" re-anchors keyboard focus
  // on the grid after an open replaces the entries.
  const keyboardFocusPending = useRef<string | null>(null);

  const selectedEntry = entries.find((entry) => entry.id === selection.selectedId) ?? null;
  const quickLookEntry = quickLookId === null ? null : entries.find((entry) => entry.id === quickLookId) ?? null;
  const previewOpen = preview !== undefined && previewVisible;
  const windowStyle = previewOpen
    ? { gridTemplateColumns: `${sidebarWidth}px minmax(210px, 1fr) ${previewWidth}px` }
    : undefined;

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

  function beginPreviewResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    previewResizeRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: previewWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizePreview(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = previewResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const nextWidth = resize.startWidth + resize.startX - event.clientX;
    if (nextWidth < previewCollapseWidth) {
      previewResizeRef.current = null;
      previewToggleRef.current?.focus();
      setPreviewVisible(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    setPreviewWidth(Math.min(Math.max(nextWidth, previewMinWidth), previewMaxWidth));
  }

  function finishPreviewResize(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = previewResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    previewResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resizePreviewWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPreviewWidth((current) => Math.min(current + previewKeyboardStep, previewMaxWidth));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (previewWidth <= previewMinWidth) {
        previewToggleRef.current?.focus();
        setPreviewVisible(false);
      } else {
        setPreviewWidth((current) => Math.max(current - previewKeyboardStep, previewMinWidth));
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      previewToggleRef.current?.focus();
      setPreviewVisible(false);
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

  return (
    <WindowChrome
      className={`mc-finder-window${previewOpen ? "" : " mc-preview-hidden"}`}
      label={label ?? title ?? "Finder"}
      style={windowStyle}
    >
      <aside className="mc-finder-sidebar">
        <div className="mc-finder-sidebar-top">
          <TrafficLights />
        </div>
        <nav aria-label="Sidebar">
          {sidebar.map((section) => (
            <FinderSidebarSection key={section.id} section={section} />
          ))}
        </nav>
      </aside>
      <main className="mc-finder-main">
        <MacToolbar className="mc-finder-toolbar">
          <span className="mc-finder-toolbar-lead" />
          <h1 className="mc-finder-title">{title}</h1>
          <div className="mc-finder-actions">
            {toolbarExtras}
            <ToolbarCapsule className="mc-finder-view-control" label="View">
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
            {preview !== undefined ? (
              <ToolbarButton
                ref={previewToggleRef}
                className="mc-finder-preview-toggle"
                label={previewVisible ? "Hide Preview" : "Show Preview"}
                title={`${previewVisible ? "Hide" : "Show"} Preview`}
                pressed={previewVisible}
                selected={previewVisible}
                onClick={() => setPreviewVisible((current) => !current)}
              >
                <SystemSymbol name="sidebar.trailing" />
              </ToolbarButton>
            ) : null}
          </div>
        </MacToolbar>
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
        {statusBar !== undefined ? <footer className="mc-finder-status">{statusBar}</footer> : null}
      </main>
      {previewOpen ? (
        <aside className="mc-finder-preview" aria-label="Preview">
          <div
            className="mc-preview-resize-handle"
            role="separator"
            aria-label="Resize Preview pane"
            aria-orientation="vertical"
            aria-valuemin={previewMinWidth}
            aria-valuemax={previewMaxWidth}
            aria-valuenow={previewWidth}
            tabIndex={0}
            onPointerDown={beginPreviewResize}
            onPointerMove={resizePreview}
            onPointerUp={finishPreviewResize}
            onPointerCancel={finishPreviewResize}
            onKeyDown={resizePreviewWithKeyboard}
          />
          <div className="mc-finder-preview-body">{preview(selectedEntry)}</div>
        </aside>
      ) : null}
      {quickLookEntry ? <QuickLook entry={quickLookEntry} onClose={() => setQuickLookId(null)} /> : null}
    </WindowChrome>
  );
}
