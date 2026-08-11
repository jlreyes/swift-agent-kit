"use client";

import type { ReactNode, Ref } from "react";
import { useState } from "react";

import "./styles/tokens.css";
import "./styles/toolbar.css";

export type ToolbarGlyphName = "back" | "forward" | "grid" | "inspector" | "list" | "more" | "search";

export function ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName }) {
  if (name === "back" || name === "forward") {
    return (
      <svg className="mc-toolbar-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d={name === "back" ? "M10.5 2.75 5.25 8l5.25 5.25" : "m5.5 2.75 5.25 5.25-5.25 5.25"} />
      </svg>
    );
  }

  if (name === "grid") {
    return (
      <svg className="mc-toolbar-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="2.25" y="2.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="9.25" y="2.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="2.25" y="9.25" width="4.5" height="4.5" rx="0.8" />
        <rect x="9.25" y="9.25" width="4.5" height="4.5" rx="0.8" />
      </svg>
    );
  }

  if (name === "list") {
    return (
      <svg className="mc-toolbar-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M5.25 3.25h8.5M5.25 8h8.5M5.25 12.75h8.5" />
        <circle cx="2.5" cy="3.25" r="0.7" />
        <circle cx="2.5" cy="8" r="0.7" />
        <circle cx="2.5" cy="12.75" r="0.7" />
      </svg>
    );
  }

  if (name === "inspector") {
    return (
      <svg className="mc-toolbar-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="1.6" />
        <path d="M10.25 2.6v10.8" />
      </svg>
    );
  }

  if (name === "more") {
    return (
      <svg className="mc-toolbar-glyph fill-dots" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="3" cy="8" r="1" />
        <circle cx="8" cy="8" r="1" />
        <circle cx="13" cy="8" r="1" />
      </svg>
    );
  }

  return (
    <svg className="mc-toolbar-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.4 10.4 3.1 3.1" />
    </svg>
  );
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
  // children are excluded by useWindowDrag's built-in selector.
  return (
    <header className={`mc-toolbar ${className}`.trim()} data-window-drag-handle="">
      {leading}
      {title !== undefined ? <h1 className="mc-toolbar-title">{title}</h1> : null}
      {center}
      {children}
      {trailing !== undefined ? <div className="mc-toolbar-actions">{trailing}</div> : null}
    </header>
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
  const open = openProp ?? openState;
  const changeValue = onChange ?? onValueChange ?? (() => undefined);
  const controlled = openProp !== undefined || onOpenChange !== undefined;
  function setOpen(next: boolean) {
    // Uncontrolled close clears the query; controlled owners decide in onOpenChange.
    if (!controlled && !next) changeValue("");
    onOpenChange?.(next);
    if (openProp === undefined) setOpenState(next);
  }
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
