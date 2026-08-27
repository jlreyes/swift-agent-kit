"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode } from "react";

import { SystemSymbol } from "./system-symbol.tsx";
import type { MacWindowThumbnail } from "./window-transition.ts";
import "./styles/tokens.css";
import "./styles/dock.css";

/** Canonical Dock icon input: either prepared artwork or a generated tile. */
export type DockIcon =
  | {
      readonly kind: "asset";
      readonly src: string;
    }
  | {
      readonly kind: "symbol";
      readonly symbol: ReactNode;
      readonly background?: string;
      readonly foreground?: string;
    };

/** String and ReactNode inputs remain supported as asset/symbol shorthand. */
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

export interface MacDockAppIconProps {
  readonly icon: DockIconSource;
  /** Supply only when the icon is not labelled by surrounding UI. */
  readonly label?: string;
}

function isDockIcon(icon: DockIconSource): icon is DockIcon {
  if (typeof icon !== "object" || icon === null || !("kind" in icon)) return false;
  if (icon.kind === "asset") return "src" in icon && typeof icon.src === "string";
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
      : { kind: "symbol", symbol: icon };
  const variant = normalizedIcon.kind === "asset" ? "asset" : "tile";
  const tileStyle: CSSProperties = normalizedIcon.kind === "symbol"
    ? {
        width: appIconGeometry.tile,
        height: appIconGeometry.tile,
        backgroundColor: normalizedIcon.background,
        color: normalizedIcon.foreground,
      }
    : { width: appIconGeometry.canvas, height: appIconGeometry.canvas };

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
          ? <img className="p0-app-icon-image" src={normalizedIcon.src} alt="" draggable={false} />
          : (
              <span
                className="p0-app-icon-glyph"
                style={{
                  width: appIconGeometry.glyphFrameWidth,
                  height: appIconGeometry.glyphFrameHeight,
                }}
              >
                {normalizedIcon.symbol}
              </span>
            )}
      </span>
    </span>
  );
}

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Prefer a typed DockIcon; URL and ReactNode shorthands remain supported. */
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
    icon: { kind: "symbol", symbol: <SystemSymbol name="face.smiling" />, background: "#0a84ff" },
    running: true,
    group: "apps",
  },
  {
    id: "app-store",
    label: "App Store",
    icon: { kind: "symbol", symbol: <SystemSymbol name="app.gift.fill" />, background: "#1597f4" },
    group: "apps",
  },
  {
    id: "chrome",
    label: "Google Chrome",
    icon: { kind: "symbol", symbol: <SystemSymbol name="globe" />, background: "#4385f5" },
    group: "apps",
  },
  {
    id: "downloads",
    label: "Downloads",
    icon: { kind: "symbol", symbol: <SystemSymbol name="folder.fill" />, background: "#58baf5" },
    group: "places",
  },
  {
    id: "trash",
    label: "Trash",
    icon: { kind: "symbol", symbol: <SystemSymbol name="trash.fill" />, background: "#8e969e" },
    group: "places",
  },
];

export function MacDock({ items = defaultDockItems, label = "Dock" }: {
  readonly items?: readonly DockItem[];
  readonly label?: string;
}) {
  return (
    <nav className="p0-mac-dock" aria-label={label}>
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
              className={`p0-dock-item${item.running ? " is-running" : ""}${item.windowThumbnail ? " is-window-thumbnail" : ""}${draggable ? " can-drag" : ""}`}
              type="button"
              aria-label={item.label}
              data-hover-effect="lift"
              draggable={draggable}
              onClick={item.onActivate}
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
              <span className="p0-dock-tooltip" role="tooltip">{item.label}</span>
              <span className="p0-dock-running-dot" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </nav>
  );
}
