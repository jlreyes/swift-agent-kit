"use client";

import "./resize-observer-compat.ts";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Tree,
  TreeItem,
  TreeItemContent,
  type Key,
  type Selection,
} from "react-aria-components";
import { Group, Panel, Separator } from "react-resizable-panels";

import { DisclosureIndicator } from "./disclosure-indicator.tsx";
import "./styles/tokens.css";
import "./styles/navigation.css";

export type MacNavigationColumnSizing = {
  /** Minimum width. Numbers are pixels; CSS length strings are also accepted. */
  readonly minSize?: number | string;
  /** Initial width. Numbers are pixels; CSS length strings are also accepted. */
  readonly defaultSize?: number | string;
  /** Maximum width. Numbers are pixels; CSS length strings are also accepted. */
  readonly maxSize?: number | string;
};

export type MacNavigationSplitViewProps = {
  readonly sidebar: ReactNode;
  /** Omit for the common two-column sidebar/detail layout. */
  readonly content?: ReactNode;
  readonly detail: ReactNode;
  readonly sidebarVisible?: boolean;
  readonly sidebarLabel?: string;
  readonly contentLabel?: string;
  readonly detailLabel?: string;
  readonly sidebarSizing?: MacNavigationColumnSizing;
  readonly contentSizing?: MacNavigationColumnSizing;
  readonly detailSizing?: MacNavigationColumnSizing;
  readonly className?: string;
  /** Stable prefix for panel ids. A React-generated id is used when omitted. */
  readonly id?: string;
};

const defaultSidebarSizing = {
  minSize: 160,
  defaultSize: 220,
  maxSize: 320,
} satisfies Required<MacNavigationColumnSizing>;

const defaultContentSizing = {
  minSize: 220,
  defaultSize: 280,
  maxSize: 420,
} satisfies Required<MacNavigationColumnSizing>;

const defaultDetailSizing = {
  minSize: 280,
  defaultSize: 520,
  maxSize: "100%",
} satisfies Required<MacNavigationColumnSizing>;

const panelStyle: CSSProperties = { display: "flex", overflow: "hidden" };

function panelSizing(
  sizing: MacNavigationColumnSizing | undefined,
  defaults: Required<MacNavigationColumnSizing>,
): Required<MacNavigationColumnSizing> {
  return {
    minSize: sizing?.minSize ?? defaults.minSize,
    defaultSize: sizing?.defaultSize ?? defaults.defaultSize,
    maxSize: sizing?.maxSize ?? defaults.maxSize,
  };
}

function layoutWeight(size: number | string): number {
  const parsed = typeof size === "number" ? size : Number.parseFloat(size);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizedLayout(entries: readonly (readonly [string, number | string])[]): Readonly<Record<string, number>> {
  const weights = entries.map(([id, size]) => [id, layoutWeight(size)] as const);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  return Object.fromEntries(weights.map(([id, weight]) => [id, (weight / total) * 100]));
}

/**
 * A macOS navigation split view: sidebar + detail, or sidebar + content +
 * detail. The optional middle column represents a selection hierarchy, while
 * supplementary controls belong in a separate MacInspector.
 */
export function MacNavigationSplitView({
  sidebar,
  content,
  detail,
  sidebarVisible = true,
  sidebarLabel = "Sidebar",
  contentLabel = "Content",
  detailLabel = "Detail",
  sidebarSizing,
  contentSizing,
  detailSizing,
  className = "",
  id,
}: MacNavigationSplitViewProps) {
  const generatedId = useId().replaceAll(":", "");
  const idPrefix = id ?? `mc-navigation-${generatedId}`;
  const resolvedSidebarSizing = panelSizing(sidebarSizing, defaultSidebarSizing);
  const resolvedContentSizing = panelSizing(contentSizing, defaultContentSizing);
  const resolvedDetailSizing = panelSizing(detailSizing, defaultDetailSizing);
  const hasContent = content !== undefined;
  const defaultLayout = useMemo(
    () =>
      normalizedLayout([
        ...(sidebarVisible ? [[`${idPrefix}-sidebar`, resolvedSidebarSizing.defaultSize] as const] : []),
        ...(hasContent ? [[`${idPrefix}-content`, resolvedContentSizing.defaultSize] as const] : []),
        [`${idPrefix}-detail`, resolvedDetailSizing.defaultSize] as const,
      ]),
    [
      hasContent,
      idPrefix,
      resolvedContentSizing.defaultSize,
      resolvedDetailSizing.defaultSize,
      resolvedSidebarSizing.defaultSize,
      sidebarVisible,
    ],
  );

  const leadingColumns: ReactNode[] = [];
  if (sidebarVisible) {
    leadingColumns.push(
      <Panel
        key="sidebar"
        id={`${idPrefix}-sidebar`}
        className="mc-navigation-panel"
        minSize={resolvedSidebarSizing.minSize}
        defaultSize={resolvedSidebarSizing.defaultSize}
        maxSize={resolvedSidebarSizing.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        style={panelStyle}
      >
        <aside className="mc-navigation-column mc-navigation-sidebar" aria-label={sidebarLabel}>
          {sidebar}
        </aside>
      </Panel>,
      <Separator
        key="sidebar-separator"
        className="mc-navigation-separator"
        aria-label={`Resize ${sidebarLabel}`}
      />,
    );
  }

  if (content !== undefined) {
    leadingColumns.push(
      <Panel
        key="content"
        id={`${idPrefix}-content`}
        className="mc-navigation-panel"
        minSize={resolvedContentSizing.minSize}
        defaultSize={resolvedContentSizing.defaultSize}
        maxSize={resolvedContentSizing.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        style={panelStyle}
      >
        <section className="mc-navigation-column mc-navigation-content" aria-label={contentLabel}>
          {content}
        </section>
      </Panel>,
      <Separator
        key="content-separator"
        className="mc-navigation-separator"
        aria-label={`Resize ${contentLabel}`}
      />,
    );
  }
  return (
    <Group
      id={`${idPrefix}-group`}
      className={`mc-navigation-split-view ${className}`.trim()}
      defaultLayout={defaultLayout}
      orientation="horizontal"
    >
      {leadingColumns}
      <Panel
        id={`${idPrefix}-detail`}
        className="mc-navigation-panel"
        minSize={resolvedDetailSizing.minSize}
        defaultSize={resolvedDetailSizing.defaultSize}
        maxSize={resolvedDetailSizing.maxSize}
        style={panelStyle}
      >
        <section className="mc-navigation-column mc-navigation-detail" aria-label={detailLabel}>
          {detail}
        </section>
      </Panel>
    </Group>
  );
}

export type MacInspectorProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label?: string;
  /** Controlled visibility. Prefer keeping the toolbar toggle in the owner. */
  readonly visible?: boolean;
  /** Controlled width. Numbers are pixels; strings pass through as CSS. */
  readonly width?: number | string;
  /** Initial width for uncontrolled use. */
  readonly defaultWidth?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  /** Called with the clamped pixel width during pointer or keyboard resizing. */
  readonly onWidthChange?: (width: number) => void;
};

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function clampedWidth(width: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(width, minimum), maximum);
}

function pixelWidth(width: number | string, fallback: number): number {
  if (typeof width === "number") return width;
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(width.trim());
  return match?.[1] === undefined ? fallback : Number(match[1]);
}

type InspectorDrag = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startWidth: number;
};

/**
 * A resizable supplementary trailing pane; it is not a third navigation
 * column. Pass `width` for controlled use, or `defaultWidth` to let the pane
 * own its width. The application continues to own visibility.
 */
export function MacInspector({
  children,
  className = "",
  label = "Inspector",
  visible = true,
  width,
  defaultWidth = 260,
  minWidth = 220,
  maxWidth = 360,
  onWidthChange,
}: MacInspectorProps) {
  const normalizedMinimum = Math.min(minWidth, maxWidth);
  const normalizedMaximum = Math.max(minWidth, maxWidth);
  const [uncontrolledWidth, setUncontrolledWidth] = useState(() =>
    clampedWidth(defaultWidth, normalizedMinimum, normalizedMaximum),
  );
  const inspectorRef = useRef<HTMLElement>(null);
  const dragRef = useRef<InspectorDrag | null>(null);
  const generatedId = useId().replaceAll(":", "");
  const inspectorId = `mc-inspector-${generatedId}`;
  const renderedWidth = width ?? uncontrolledWidth;
  const reportedWidth = clampedWidth(
    pixelWidth(renderedWidth, uncontrolledWidth),
    normalizedMinimum,
    normalizedMaximum,
  );

  function currentWidth(): number {
    const measuredWidth = inspectorRef.current?.getBoundingClientRect().width ?? 0;
    return measuredWidth > 0 ? measuredWidth : reportedWidth;
  }

  function resizeTo(nextWidth: number) {
    const next = clampedWidth(nextWidth, normalizedMinimum, normalizedMaximum);
    if (width === undefined) setUncontrolledWidth(next);
    onWidthChange?.(next);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: currentWidth(),
    };
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    // The inspector trails the content, so moving its leading edge left grows it.
    resizeTo(drag.startWidth + drag.startX - event.clientX);
  }

  function finishPointerResize(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === "function" &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSeparatorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    let nextWidth: number | undefined;
    switch (event.key) {
      case "ArrowLeft":
        nextWidth = currentWidth() + 10;
        break;
      case "ArrowRight":
        nextWidth = currentWidth() - 10;
        break;
      case "Home":
        nextWidth = normalizedMinimum;
        break;
      case "End":
        nextWidth = normalizedMaximum;
        break;
      default:
        return;
    }
    event.preventDefault();
    resizeTo(nextWidth);
  }

  if (!visible) return null;
  return (
    <>
      <div
        role="separator"
        aria-controls={inspectorId}
        aria-label={`Resize ${label}`}
        aria-orientation="vertical"
        aria-valuemin={normalizedMinimum}
        aria-valuemax={normalizedMaximum}
        aria-valuenow={reportedWidth}
        className="mc-navigation-separator mc-inspector-separator"
        tabIndex={0}
        onKeyDown={handleSeparatorKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerResize}
        onPointerCancel={finishPointerResize}
      />
      <aside
        ref={inspectorRef}
        id={inspectorId}
        className={`mc-inspector ${className}`.trim()}
        aria-label={label}
        style={{
          width: cssLength(renderedWidth),
          minWidth: cssLength(normalizedMinimum),
          maxWidth: cssLength(normalizedMaximum),
        }}
      >
        {children}
      </aside>
    </>
  );
}

export type MacSourceListItem = {
  readonly id: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly badge?: ReactNode;
  readonly indent?: boolean;
};

export type MacSourceListSection = {
  readonly id: string;
  /** An untitled section renders as a plain leading block. */
  readonly title?: string;
  readonly collapsible?: boolean;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly items: readonly MacSourceListItem[];
};

export type MacSourceListProps = {
  readonly sections: readonly MacSourceListSection[];
  readonly label?: string;
  readonly className?: string;
  /** Selected item id. Section headings are focusable disclosure controls, not app selections. */
  readonly selectedId: string | null;
  readonly onSelectionChange: (id: string) => void;
  /** Controlled expanded section ids. Omit to start every section expanded. */
  readonly expandedSectionIds?: ReadonlySet<string>;
  readonly onExpandedSectionIdsChange?: (ids: ReadonlySet<string>) => void;
};

function sectionKey(id: string): string {
  return `section:${id}`;
}

function itemKey(id: string): string {
  return `item:${id}`;
}

/**
 * A List(.sidebar)-style source list built on React Aria Tree. The library
 * supplies roving focus, arrow navigation, typeahead, selection, and disclosure
 * semantics; the component supplies native Mac source-list anatomy.
 */
export function MacSourceList({
  sections,
  label = "Sidebar",
  className = "",
  selectedId,
  onSelectionChange,
  expandedSectionIds,
  onExpandedSectionIdsChange,
}: MacSourceListProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());
  const collapsibleIds = sections
    .filter((section) => section.title !== undefined && (section.collapsible ?? false))
    .map((section) => section.id);
  const controlledExpandedIds = expandedSectionIds === undefined ? undefined : new Set(expandedSectionIds);
  const expandedIds = collapsibleIds.filter((id) =>
    controlledExpandedIds === undefined ? !collapsedIds.has(id) : controlledExpandedIds.has(id),
  );
  const expandedKeys = expandedIds.map(sectionKey);

  let selectedKey: Key | undefined;
  for (const section of sections) {
    const selectedItem = section.items.find((item) => item.id === selectedId);
    if (selectedItem !== undefined) {
      selectedKey = itemKey(selectedItem.id);
      break;
    }
  }

  function handleSelectionChange(selection: Selection) {
    if (selection === "all") return;
    const key = [...selection][0];
    for (const section of sections) {
      for (const item of section.items) {
        if (key === itemKey(item.id)) {
          onSelectionChange(item.id);
          return;
        }
      }
    }
  }

  function handleExpandedChange(keys: Set<Key>) {
    const nextExpandedIds = new Set(
      collapsibleIds.filter((id) => keys.has(sectionKey(id))),
    );
    if (expandedSectionIds === undefined) {
      setCollapsedIds(new Set(collapsibleIds.filter((id) => !nextExpandedIds.has(id))));
    }
    onExpandedSectionIdsChange?.(nextExpandedIds);
  }

  function itemRows(section: MacSourceListSection): readonly ReactNode[] {
    return section.items.map((item, index) => {
      const leadClass =
        section.title === undefined && index === 0
          ? `mc-sidebar-section${section.className !== undefined ? ` ${section.className}` : ""} `
          : "";
      return (
        <TreeItem
          key={item.id}
          id={itemKey(item.id)}
          textValue={item.label}
          className={`${leadClass}mc-sidebar-item${selectedId === item.id ? " mc-selected" : ""}${item.indent ? " mc-indent" : ""}`}
          onPress={(event) => {
            if (event.pointerType !== "keyboard" && event.target instanceof HTMLElement) {
              event.target.focus();
            }
          }}
        >
          <TreeItemContent>
            {item.icon !== undefined ? (
              <span className="mc-sidebar-item-icon" aria-hidden="true">{item.icon}</span>
            ) : null}
            <span className="mc-sidebar-item-label">{item.label}</span>
            {item.badge !== undefined ? <small className="mc-sidebar-item-badge">{item.badge}</small> : null}
          </TreeItemContent>
        </TreeItem>
      );
    });
  }

  return (
    <Tree
      aria-label={label}
      className={`mc-sidebar-tree ${className}`.trim()}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={selectedKey === undefined ? [] : [selectedKey]}
      onSelectionChange={handleSelectionChange}
      expandedKeys={expandedKeys}
      onExpandedChange={handleExpandedChange}
    >
      {sections.flatMap((section) => {
        if (section.title === undefined) return itemRows(section);
        const title = section.title;
        const collapsible = section.collapsible ?? false;
        const expanded = expandedIds.includes(section.id);
        const extraClass = section.className !== undefined ? ` ${section.className}` : "";
        const header = (
          <TreeItem
            key={`section-${section.id}`}
            id={sectionKey(section.id)}
            textValue={title}
            className={`mc-sidebar-section mc-sidebar-section-header${extraClass}`}
            onPress={(event) => {
              if (event.pointerType !== "keyboard" && event.target instanceof HTMLElement) {
                event.target.focus();
              }
            }}
          >
            <TreeItemContent>
              <span className="mc-sidebar-section-label">
                <strong>{title}</strong>
                {section.count !== undefined ? <small>{section.count}</small> : null}
              </span>
              {section.action}
              {collapsible ? (
                <Button
                  slot="chevron"
                  className="mc-sidebar-disclosure-button"
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
                >
                  <DisclosureIndicator className="mc-sidebar-disclosure" expanded={expanded} />
                </Button>
              ) : null}
            </TreeItemContent>
            {collapsible ? itemRows(section) : null}
          </TreeItem>
        );
        return collapsible ? [header] : [header, ...itemRows(section)];
      })}
    </Tree>
  );
}
