"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import "./styles/tokens.css";
import "./styles/popover.css";

/* Menu-bar extra: a glyph trigger sitting in the menu bar that toggles a
   popover shell. Content is slotted; the layer spans the desktop canvas so
   the popover can hang below the bar. */
export function MenuBarExtra({ badge, children, icon, label }: {
  readonly badge?: number | string;
  readonly children: ReactNode;
  /** Image URL, or a ReactNode (e.g. a SystemSymbol). */
  readonly icon: ReactNode | string;
  readonly label: string;
}) {
  const [open, setOpen] = useState(false);
  const showBadge = badge !== undefined && badge !== 0 && badge !== "";
  return (
    <div className="mc-menubar-layer">
      <button
        type="button"
        className={`mc-menubar-trigger${open ? " active" : ""}`}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {typeof icon === "string" ? <img src={icon} alt="" /> : icon}
        {showBadge ? <span className="mc-menubar-badge" aria-hidden="true">{badge}</span> : null}
      </button>
      {open ? <aside className="menu-popover mc-menubar-popover" aria-label={label}>{children}</aside> : null}
    </div>
  );
}
