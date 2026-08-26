"use client";

import type { ReactNode, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { Toolbar } from "react-aria-components";

import { SystemSymbol, type SystemSymbolName } from "./system-symbol.tsx";
import "./styles/tokens.css";
import "./styles/toolbar.css";

export type ToolbarGlyphName = "back" | "forward" | "grid" | "inspector" | "list" | "more" | "search";

const toolbarSymbols = {
  back: "chevron.left",
  forward: "chevron.right",
  grid: "square.grid.2x2",
  inspector: "sidebar.trailing",
  list: "list.bullet",
  more: "ellipsis",
  search: "magnifyingglass",
} as const satisfies Readonly<Record<ToolbarGlyphName, SystemSymbolName>>;

export function ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName }) {
  return <SystemSymbol className="mc-toolbar-glyph" name={toolbarSymbols[name]} />;
}

export function MacToolbar({ center, children, className = "", leading, title, trailing }: {
  readonly center?: ReactNode;
  /** Free-form layout alternative to the slots (surfaces bring their own toolbar grid). */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly leading?: ReactNode;
  readonly title?: ReactNode;
  readonly trailing?: ReactNode;
}) {
  // The toolbar surface is a window-drag handle (macOS anatomy); interactive
  // children are excluded by useWindowDrag's built-in selector. react-aria's
  // Toolbar (role=toolbar) supplies arrow-key focus movement between controls.
  return (
    <Toolbar aria-label="Toolbar" className={`mc-toolbar ${className}`.trim()} data-window-drag-handle="">
      {leading}
      {title !== undefined ? <h1 className="mc-toolbar-title">{title}</h1> : null}
      {center}
      {children}
      {trailing !== undefined ? <div className="mc-toolbar-actions">{trailing}</div> : null}
    </Toolbar>
  );
}

export function ToolbarCapsule({ children, className = "", divided = false, label, role }: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Draw a hairline between adjacent buttons (back/forward pattern). */
  readonly divided?: boolean;
  readonly label?: string;
  readonly role?: "group";
}) {
  return (
    <span className={`mc-capsule ${className}`.trim()} data-divided={divided ? "" : undefined} role={role} aria-label={label}>
      {children}
    </span>
  );
}

export function ToolbarButton({ children, className = "", disabled = false, label, pressed, ref, selected = false, title, onClick }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly label: string;
  /** When provided, exposes toggle state via aria-pressed. */
  readonly pressed?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
  readonly selected?: boolean;
  readonly title?: string;
  readonly onClick?: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`mc-toolbar-button${selected ? " selected" : ""} ${className}`.trim()}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ToolbarToggle({ children, className = "", label, pressed, title, onPressedChange }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly pressed: boolean;
  readonly title?: string;
  readonly onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`mc-toolbar-button mc-toolbar-toggle${pressed ? " selected" : ""} ${className}`.trim()}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      onClick={() => onPressedChange(!pressed)}
    >
      {children}
    </button>
  );
}

export function ToolbarSearchBubble({ label = "Search", open: openProp, placeholder = "Search", value, onChange, onOpenChange, onValueChange }: {
  readonly label?: string;
  /** Controlled expansion: pair with onOpenChange. Omit for internal open state. */
  readonly open?: boolean;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange?: (value: string) => void;
  readonly onOpenChange?: (open: boolean) => void;
  /** Alias of onChange; one of the two is required. */
  readonly onValueChange?: (value: string) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = openProp ?? openState;
  const changeValue = onChange ?? onValueChange ?? (() => undefined);
  const controlled = openProp !== undefined || onOpenChange !== undefined;
  function setOpen(next: boolean) {
    // Uncontrolled close clears the query; controlled owners decide in onOpenChange.
    if (!controlled && !next) changeValue("");
    onOpenChange?.(next);
    if (openProp === undefined) setOpenState(next);
  }
  // The enclosing react-aria Toolbar claims arrow keys (capture phase, at the
  // React root) to rove focus between controls — which would steal caret
  // movement from the text field. A document-capture guard runs before the
  // React root and stops arrow keys targeted at this input so the browser's
  // native caret behavior survives; every other key still reaches the toolbar.
  useEffect(() => {
    if (!open) return;
    function guardCaretKeys(event: KeyboardEvent) {
      if (event.target !== inputRef.current) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.stopPropagation();
      }
    }
    document.addEventListener("keydown", guardCaretKeys, true);
    return () => document.removeEventListener("keydown", guardCaretKeys, true);
  }, [open]);
  return (
    <div className={`mc-search-bubble${open ? " open" : ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ToolbarGlyph name="search" />
      </button>
      {open ? (
        <input
          ref={inputRef}
          value={value}
          autoFocus
          onChange={(event) => changeValue(event.target.value)}
          onBlur={() => {
            if (!value) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              changeValue("");
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={label}
        />
      ) : null}
    </div>
  );
}
