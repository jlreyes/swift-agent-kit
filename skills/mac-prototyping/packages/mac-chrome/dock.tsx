"use client";

import type { DragEvent as ReactDragEvent, ReactNode } from "react";

import "./styles/tokens.css";
import "./styles/dock.css";

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Image URL, or a ReactNode (e.g. a SystemSymbol). */
  readonly icon: ReactNode | string;
  readonly running?: boolean;
  /** Adjacent items with different group values get a divider between them. */
  readonly group?: string;
  readonly onActivate?: () => void;
  /** MIME type → payload. Presence makes the tile draggable (effectAllowed: copy). */
  readonly draggablePayload?: Readonly<Record<string, string>>;
}

export function MacDock({ items, label = "Dock" }: {
  readonly items: readonly DockItem[];
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
              className={`p0-dock-item${item.running ? " is-running" : ""}${draggable ? " can-drag" : ""}`}
              type="button"
              aria-label={item.label}
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
              {typeof item.icon === "string"
                ? <img src={item.icon} alt="" draggable={false} />
                : <span className="p0-dock-icon" aria-hidden="true">{item.icon}</span>}
              <span className="p0-dock-tooltip" role="tooltip">{item.label}</span>
              <span className="p0-dock-running-dot" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </nav>
  );
}
