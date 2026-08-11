"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
  const layerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const showBadge = badge !== undefined && badge !== 0 && badge !== "";

  // Dismissal contract (matching the app menus): Escape closes and restores
  // the trigger's focus; a pointer-down outside the layer closes.
  useEffect(() => {
    if (!open) return;
    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !layerRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={layerRef} className="mc-menubar-layer">
      <button
        ref={triggerRef}
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
