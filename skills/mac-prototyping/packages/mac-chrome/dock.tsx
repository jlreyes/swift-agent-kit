"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, ReactNode } from "react";

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
  glyph: 26,
} as const;

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
 * area; generated icons use a 42px tile and a 26px glyph box.
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
                style={{ width: appIconGeometry.glyph, height: appIconGeometry.glyph }}
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
  { id: "finder", label: "Finder", icon: "/mac-assets/dock/finder.png", running: true, group: "apps" },
  { id: "app-store", label: "App Store", icon: "/mac-assets/dock/app-store.png", group: "apps" },
  { id: "chrome", label: "Google Chrome", icon: "/mac-assets/dock/chrome.png", group: "apps" },
  { id: "downloads", label: "Downloads", icon: "/mac-assets/dock/downloads.png", group: "places" },
  { id: "trash", label: "Trash", icon: "/mac-assets/dock/trash.png", group: "places" },
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
              {item.windowThumbnail ? (
                <span
                  className="p0-window-thumbnail"
                  style={{
                    aspectRatio: `${item.windowThumbnail.width} / ${item.windowThumbnail.height}`,
                    viewTransitionName: item.viewTransitionName,
                  }}
                >
                  {item.windowThumbnail.src ? (
                    <img src={item.windowThumbnail.src} alt="" draggable={false} />
                  ) : (
                    <span className="p0-window-thumbnail-fallback"><MacDockAppIcon icon={item.icon} /></span>
                  )}
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
