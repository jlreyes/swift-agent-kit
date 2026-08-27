"use client";

import type { ReactNode, Ref } from "react";

import { MacPopover } from "./menu";

import "./styles/tokens.css";
import "./styles/popover.css";

/* Menu-bar extra: a glyph trigger sitting in the menu bar that toggles a
   popover shell. Content is slotted; the layer spans the desktop canvas so
   the popover can hang below the bar. */
export function MenuBarExtra({ badge, children, icon, isOpen, label, onOpenChange, triggerRef }: {
  readonly badge?: number | string;
  readonly children: ReactNode;
  /** Image URL, or a ReactNode (e.g. a SystemSymbol). */
  readonly icon: ReactNode | string;
  readonly isOpen?: boolean;
  readonly label: string;
  readonly onOpenChange?: (open: boolean) => void;
  readonly triggerRef?: Ref<HTMLButtonElement>;
}) {
  const showBadge = badge !== undefined && badge !== 0 && badge !== "";

  return (
    <div className="mc-menubar-layer">
      <MacPopover
        className="mc-menubar-popover"
        contentInset="flush"
        isOpen={isOpen}
        label={label}
        layout="status"
        offset={4}
        onOpenChange={onOpenChange}
        triggerClassName="mc-menubar-trigger"
        triggerRef={triggerRef}
        trigger={
          <>
            {typeof icon === "string" ? <img src={icon} alt="" /> : icon}
            {showBadge ? <span className="mc-menubar-badge" aria-hidden="true">{badge}</span> : null}
          </>
        }
      >
        {children}
      </MacPopover>
    </div>
  );
}
