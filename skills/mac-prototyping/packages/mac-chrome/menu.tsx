"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

import "./styles/tokens.css";
import "./styles/popover.css";

export interface MenuAction {
  readonly kind: "action";
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  /** Renders as a link instead of a button. */
  readonly href?: string;
  readonly target?: string;
  /** When set, renders role=menuitemradio with aria-checked. */
  readonly checked?: boolean;
  readonly onSelect?: () => void;
}

export type MenuEntry =
  | MenuAction
  | { readonly kind: "separator"; readonly id: string }
  | { readonly kind: "section"; readonly id: string; readonly label: string };

export type MenuSpec = readonly MenuEntry[];

const menuItemSelector = '[role="menuitem"], [role="menuitemradio"]';

/* ARIA menu-button: Esc/Tab close and restore focus, arrows cycle with wrap,
   Home/End jump, outside pointerdown closes, first item focused on open. */
export function MacMenu({ className = "", items, label, trigger, triggerClassName = "" }: {
  readonly className?: string;
  readonly items: MenuSpec;
  readonly label: string;
  readonly trigger: ReactNode;
  readonly triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>(menuItemSelector)?.focus({ preventScroll: true }));
    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleMenuKey(event: KeyboardEvent) {
      const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(menuItemSelector) ?? []);
      const activeElement = document.activeElement;
      const index = activeElement instanceof HTMLElement ? menuItems.indexOf(activeElement) : -1;
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = index < 0 ? 0 : (index + direction + menuItems.length) % menuItems.length;
        menuItems[next]?.focus({ preventScroll: true });
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        menuItems[event.key === "Home" ? 0 : menuItems.length - 1]?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", handleMenuKey);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", handleMenuKey);
    };
  }, [open]);

  function choose(entry: MenuAction) {
    entry.onSelect?.();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div ref={wrapperRef} className={`mc-menu ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={`mc-menu-trigger ${triggerClassName}`.trim()}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} className="mc-menu-popover" role="menu" aria-label={label}>
          {items.map((entry) => {
            if (entry.kind === "separator") return <div key={entry.id} className="menu-separator" />;
            if (entry.kind === "section") return <div key={entry.id} className="menu-section-label">{entry.label}</div>;
            const content = (
              <>
                {entry.icon}
                <span><strong>{entry.label}</strong>{entry.detail !== undefined ? <small>{entry.detail}</small> : null}</span>
                {entry.trailingIcon}
              </>
            );
            if (entry.href !== undefined) {
              return (
                <a
                  key={entry.id}
                  role="menuitem"
                  tabIndex={-1}
                  href={entry.href}
                  target={entry.target}
                  rel={entry.target === "_blank" ? "noreferrer" : undefined}
                  onClick={() => choose(entry)}
                >
                  {content}
                </a>
              );
            }
            return (
              <button
                key={entry.id}
                type="button"
                role={entry.checked !== undefined ? "menuitemradio" : "menuitem"}
                aria-checked={entry.checked}
                tabIndex={-1}
                onClick={() => choose(entry)}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* Details-based popover: no JS, browser handles open/close; ideal for
   account-style menus whose content is arbitrary. */
export function MacDetailsMenu({ children, className = "", summary }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly summary: ReactNode;
}) {
  return (
    <details className={`mc-details-menu ${className}`.trim()}>
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
