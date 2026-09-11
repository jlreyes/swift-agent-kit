"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";

import { getElementScale, getVisibleDesktopBounds, useDesktopSpace, viewportPointToLocal } from "./desktop-space.tsx";
import { SystemSymbol, type SystemSymbolName } from "./system-symbol.tsx";
import type { MacWindowThumbnail } from "./window-transition.ts";
import "./styles/tokens.css";
import "./styles/dock.css";

/** Canonical Dock icon input: prepared artwork or a normalized generated tile. */
export type DockIcon =
  | {
      readonly kind: "asset";
      readonly src: string;
    }
  | {
      readonly kind: "systemSymbol";
      readonly name: SystemSymbolName;
      readonly background?: string;
      readonly foreground?: string;
    }
  | {
      /** Advanced escape hatch for generated artwork that is not a system symbol. */
      readonly kind: "artwork";
      readonly artwork: ReactNode;
      readonly background?: string;
      readonly foreground?: string;
    }
  | {
      /** @deprecated Use `systemSymbol` for SF Symbols or `artwork` for custom artwork. */
      readonly kind: "symbol";
      readonly symbol: ReactNode;
      readonly background?: string;
      readonly foreground?: string;
    };

/** String and ReactNode inputs remain supported as legacy shorthands. */
export type DockIconSource = DockIcon | ReactNode | string;

const appIconGeometry = {
  canvas: 50,
  tile: 42,
  glyphFrameWidth: 34,
  glyphFrameHeight: 30,
} as const;

const windowThumbnailGeometry = {
  maxWidth: 48,
  maxHeight: 44,
} as const;

const dockTooltipViewportInset = 8;

interface DockTooltipPosition {
  readonly itemId: string;
  readonly left: number;
  readonly top: number;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly visible: boolean;
}

function containedThumbnailSize(thumbnail: MacWindowThumbnail) {
  const sourceWidth = Number.isFinite(thumbnail.width) && thumbnail.width > 0 ? thumbnail.width : 720;
  const sourceHeight = Number.isFinite(thumbnail.height) && thumbnail.height > 0 ? thumbnail.height : 480;
  const scale = Math.min(
    windowThumbnailGeometry.maxWidth / sourceWidth,
    windowThumbnailGeometry.maxHeight / sourceHeight,
  );
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

function dockItemsLayoutKey(items: readonly DockItem[]) {
  return JSON.stringify(items.map((item) => [item.id, item.label, item.group ?? null]));
}

export interface MacDockAppIconProps {
  readonly icon: DockIconSource;
  /** Supply only when the icon is not labelled by surrounding UI. */
  readonly label?: string;
}

function isDockIcon(icon: DockIconSource): icon is DockIcon {
  if (typeof icon !== "object" || icon === null || !("kind" in icon)) return false;
  if (icon.kind === "asset") return "src" in icon && typeof icon.src === "string";
  if (icon.kind === "systemSymbol") return "name" in icon && typeof icon.name === "string";
  if (icon.kind === "artwork") return "artwork" in icon;
  return icon.kind === "symbol" && "symbol" in icon;
}

/**
 * A normalized 50px app-icon canvas. Asset artwork keeps its intrinsic safe
 * area; generated icons use a 42px tile and a stable 34×30px glyph frame.
 */
export function MacDockAppIcon({ icon, label }: MacDockAppIconProps) {
  const normalizedIcon: DockIcon = typeof icon === "string"
    ? { kind: "asset", src: icon }
    : isDockIcon(icon)
      ? icon
      : { kind: "artwork", artwork: icon };
  const variant = normalizedIcon.kind === "asset" ? "asset" : "tile";
  const glyphVariant = normalizedIcon.kind === "systemSymbol" ? "system-symbol" : "artwork";
  const tileStyle: CSSProperties = normalizedIcon.kind === "asset"
    ? { width: appIconGeometry.canvas, height: appIconGeometry.canvas }
    : {
        width: appIconGeometry.tile,
        height: appIconGeometry.tile,
        backgroundColor: normalizedIcon.background,
        color: normalizedIcon.foreground,
      };

  return (
    <span
      className={`p0-app-icon p0-app-icon--${variant}`}
      style={{ width: appIconGeometry.canvas, height: appIconGeometry.canvas }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="p0-app-icon-artwork" style={tileStyle}>
        {normalizedIcon.kind === "asset"
          ? <img className="p0-app-icon-image" src={normalizedIcon.src} alt="" draggable={false} loading="lazy" fetchPriority="low" decoding="async" />
          : (
              <span
                className={`p0-app-icon-glyph p0-app-icon-glyph--${glyphVariant}`}
                style={{
                  width: appIconGeometry.glyphFrameWidth,
                  height: appIconGeometry.glyphFrameHeight,
                }}
              >
                {normalizedIcon.kind === "systemSymbol"
                  ? <SystemSymbol name={normalizedIcon.name} size={20} />
                  : normalizedIcon.kind === "artwork"
                    ? normalizedIcon.artwork
                    : normalizedIcon.symbol}
              </span>
            )}
      </span>
    </span>
  );
}

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Prefer a typed DockIcon; URL and ReactNode shorthands remain supported for compatibility. */
  readonly icon: DockIconSource;
  /** A minimized window renders as a real preview, not another app icon. */
  readonly windowThumbnail?: MacWindowThumbnail;
  /** Shared identity used for native-style minimize/restore View Transitions. */
  readonly viewTransitionName?: string;
  readonly running?: boolean;
  /** Adjacent items with different group values get a divider between them. */
  readonly group?: string;
  readonly onActivate?: () => void;
  /** MIME type → payload. Presence makes the tile draggable (effectAllowed: copy). */
  readonly draggablePayload?: Readonly<Record<string, string>>;
}

export const defaultDockItems: readonly DockItem[] = [
  {
    id: "finder",
    label: "Finder",
    icon: { kind: "systemSymbol", name: "face.smiling", background: "#0a84ff" },
    running: true,
    group: "apps",
  },
  {
    id: "app-store",
    label: "App Store",
    icon: { kind: "systemSymbol", name: "app.gift.fill", background: "#1597f4" },
    group: "apps",
  },
  {
    id: "chrome",
    label: "Google Chrome",
    icon: { kind: "systemSymbol", name: "globe", background: "#4385f5" },
    group: "apps",
  },
  {
    id: "downloads",
    label: "Downloads",
    icon: { kind: "systemSymbol", name: "folder.fill", background: "#58baf5" },
    group: "places",
  },
  {
    id: "trash",
    label: "Trash",
    icon: { kind: "systemSymbol", name: "trash.fill", background: "#8e969e" },
    group: "places",
  },
];

export function MacDock({ items = defaultDockItems, label = "Dock" }: {
  readonly items?: readonly DockItem[];
  readonly label?: string;
}) {
  const desktopSpace = useDesktopSpace();
  const dockRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const hoveredItemIdRef = useRef<string | null>(null);
  const focusedItemIdRef = useRef<string | null>(null);
  const tooltipId = useId();
  const [activeTooltipItemId, setActiveTooltipItemId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<DockTooltipPosition | null>(null);
  const activeTooltipItem = activeTooltipItemId === null
    ? undefined
    : items.find((item) => item.id === activeTooltipItemId);
  const itemsLayoutKey = dockItemsLayoutKey(items);

  const positionTooltip = useCallback((itemId: string) => {
    const dock = dockRef.current;
    const scrollport = scrollRef.current;
    const tooltip = tooltipRef.current;
    const item = itemRefs.current.get(itemId);
    if (dock === null || scrollport === null || tooltip === null || item === undefined) return;

    const dockRect = dock.getBoundingClientRect();
    const scrollportRect = scrollport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const visible = itemRect.right > scrollportRect.left && itemRect.left < scrollportRect.right;
    const measuredScale = getElementScale(dock);
    const scale = measuredScale.x;
    const canvas = desktopSpace?.canvas;
    const viewport = window.visualViewport;
    let boundaryLeft = viewport?.offsetLeft ?? 0;
    let boundaryRight = boundaryLeft + (viewport?.width ?? window.innerWidth);
    let boundaryTop = viewport?.offsetTop ?? 0;
    let boundaryBottom = boundaryTop + (viewport?.height ?? window.innerHeight);
    if (canvas) {
      const bounds = getVisibleDesktopBounds(canvas);
      const canvasRect = canvas.getBoundingClientRect();
      const canvasScale = getElementScale(canvas);
      boundaryLeft = canvasRect.left + bounds.left * canvasScale.x;
      boundaryRight = canvasRect.left + bounds.right * canvasScale.x;
      boundaryTop = canvasRect.top + bounds.top * canvasScale.y;
      boundaryBottom = canvasRect.top + bounds.bottom * canvasScale.y;
    }
    const inset = dockTooltipViewportInset * scale;
    const availableWidth = Math.max(0, boundaryRight - boundaryLeft - inset * 2);
    const tooltipWidth = Math.min(tooltipRect.width, availableWidth);
    const minimumCenter = boundaryLeft + inset + tooltipWidth / 2;
    const maximumCenter = boundaryRight - inset - tooltipWidth / 2;
    const itemCenter = (itemRect.left + itemRect.right) / 2;
    const viewportCenter = minimumCenter <= maximumCenter
      ? Math.min(Math.max(itemCenter, minimumCenter), maximumCenter)
      : (boundaryLeft + boundaryRight) / 2;
    const verticalInset = dockTooltipViewportInset * measuredScale.y;
    const availableHeight = Math.max(0, boundaryBottom - boundaryTop - verticalInset * 2);
    const tooltipHeight = Math.min(tooltipRect.height, availableHeight);
    const minimumTop = boundaryTop + verticalInset;
    const maximumTop = boundaryBottom - verticalInset - tooltipHeight;
    const aboveDock = dockRect.top - 2 * measuredScale.y - tooltipHeight;
    const preferredTop = aboveDock >= minimumTop ? aboveDock : dockRect.bottom + 2 * measuredScale.y;
    const viewportTop = Math.min(Math.max(preferredTop, minimumTop), Math.max(minimumTop, maximumTop));
    const localPosition = viewportPointToLocal(dock, { x: viewportCenter, y: viewportTop });
    const dockStyle = getComputedStyle(dock);
    const borderLeft = dockStyle.borderLeftStyle === "none"
      ? 0
      : Number.parseFloat(dockStyle.borderLeftWidth) || 0;
    const borderTop = dockStyle.borderTopStyle === "none"
      ? 0
      : Number.parseFloat(dockStyle.borderTopWidth) || 0;
    const nextPosition = {
      itemId,
      left: localPosition.x - borderLeft,
      top: localPosition.y - borderTop,
      maxWidth: availableWidth / scale,
      maxHeight: availableHeight / measuredScale.y,
      visible,
    } satisfies DockTooltipPosition;

    setTooltipPosition((current) => (
      current?.itemId === nextPosition.itemId
        && current.left === nextPosition.left
        && current.top === nextPosition.top
        && current.maxHeight === nextPosition.maxHeight
        && current.maxWidth === nextPosition.maxWidth
        && current.visible === nextPosition.visible
        ? current
        : nextPosition
    ));
  }, [desktopSpace]);

  useLayoutEffect(() => {
    if (activeTooltipItemId === null || activeTooltipItem !== undefined) return;
    hoveredItemIdRef.current = null;
    focusedItemIdRef.current = null;
    setActiveTooltipItemId(null);
    setTooltipPosition(null);
  }, [activeTooltipItem, activeTooltipItemId]);

  useLayoutEffect(() => {
    if (activeTooltipItemId === null || activeTooltipItem === undefined) return;
    const scrollport = scrollRef.current;
    if (scrollport === null) return;

    const reposition = () => positionTooltip(activeTooltipItemId);
    reposition();
    scrollport.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", reposition);
    viewport?.addEventListener("scroll", reposition);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reposition);
    for (const element of [dockRef.current, tooltipRef.current, desktopSpace?.canvas]) {
      if (element) observer?.observe(element);
    }
    return () => {
      observer?.disconnect();
      scrollport.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
      viewport?.removeEventListener("resize", reposition);
      viewport?.removeEventListener("scroll", reposition);
    };
  }, [activeTooltipItem, activeTooltipItemId, desktopSpace?.canvas, itemsLayoutKey, positionTooltip]);

  function activateTooltip(itemId: string) {
    setActiveTooltipItemId(itemId);
  }

  function stopHovering(itemId: string) {
    if (hoveredItemIdRef.current === itemId) hoveredItemIdRef.current = null;
    setActiveTooltipItemId(focusedItemIdRef.current);
  }

  function stopFocusing(itemId: string) {
    if (focusedItemIdRef.current === itemId) focusedItemIdRef.current = null;
    setActiveTooltipItemId(hoveredItemIdRef.current);
  }

  const hasPositionedActiveTooltip = tooltipPosition?.itemId === activeTooltipItemId;

  return (
    <nav ref={dockRef} className="p0-mac-dock" aria-label={label}>
      <span ref={scrollRef} className="p0-dock-scroll">
        {items.map((item, index) => {
          const previousItem = items[index - 1];
          const startsGroup = previousItem !== undefined && previousItem.group !== item.group;
          const payload = item.draggablePayload;
          const draggable = payload !== undefined && Object.keys(payload).length > 0;
          const thumbnailSize = item.windowThumbnail === undefined
            ? undefined
            : containedThumbnailSize(item.windowThumbnail);
          return (
            <span className="p0-dock-item-wrap" key={item.id}>
              {startsGroup ? <i className="p0-dock-divider" aria-hidden="true" /> : null}
              <button
                ref={(element) => {
                  if (element === null) itemRefs.current.delete(item.id);
                  else itemRefs.current.set(item.id, element);
                }}
                className={`p0-dock-item${item.running ? " is-running" : ""}${item.windowThumbnail ? " is-window-thumbnail" : ""}${draggable ? " can-drag" : ""}`}
                type="button"
                aria-label={item.label}
                aria-describedby={activeTooltipItemId === item.id ? tooltipId : undefined}
                data-hover-effect="lift"
                draggable={draggable}
                onClick={item.onActivate}
                onPointerEnter={() => {
                  hoveredItemIdRef.current = item.id;
                  activateTooltip(item.id);
                }}
                onPointerLeave={() => stopHovering(item.id)}
                onFocus={() => {
                  focusedItemIdRef.current = item.id;
                  activateTooltip(item.id);
                }}
                onBlur={() => stopFocusing(item.id)}
                onDragStart={(event: ReactDragEvent<HTMLButtonElement>) => {
                  if (!payload) return;
                  for (const [type, data] of Object.entries(payload)) {
                    event.dataTransfer.setData(type, data);
                  }
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                {item.windowThumbnail && thumbnailSize ? (
                  <span className="p0-window-thumbnail-slot">
                    <span
                      className="p0-window-thumbnail"
                      style={{
                        width: thumbnailSize.width,
                        height: thumbnailSize.height,
                        viewTransitionName: item.viewTransitionName,
                      }}
                    >
                      {item.windowThumbnail.src ? (
                        <img src={item.windowThumbnail.src} alt="" draggable={false} />
                      ) : (
                        <span className="p0-window-thumbnail-fallback"><MacDockAppIcon icon={item.icon} /></span>
                      )}
                    </span>
                  </span>
                ) : <MacDockAppIcon icon={item.icon} />}
                <span className="p0-dock-running-dot" aria-hidden="true" />
              </button>
            </span>
          );
        })}
      </span>
      {activeTooltipItem === undefined ? null : (
        <span
          ref={tooltipRef}
          id={tooltipId}
          className="p0-dock-tooltip"
          role="tooltip"
          data-visible={hasPositionedActiveTooltip && tooltipPosition.visible ? "true" : "false"}
          style={{
            left: hasPositionedActiveTooltip ? tooltipPosition.left : undefined,
            top: hasPositionedActiveTooltip ? tooltipPosition.top : undefined,
            bottom: hasPositionedActiveTooltip ? "auto" : undefined,
            maxHeight: hasPositionedActiveTooltip ? tooltipPosition.maxHeight : undefined,
            maxWidth: hasPositionedActiveTooltip ? tooltipPosition.maxWidth : undefined,
          }}
        >
          {activeTooltipItem.label}
        </span>
      )}
    </nav>
  );
}
