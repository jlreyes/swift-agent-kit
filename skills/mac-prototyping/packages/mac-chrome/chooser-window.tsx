"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { SystemSymbol, type SystemSymbolName } from "./system-symbol";
import { TrafficLights, WindowChrome, type WindowFrame } from "./window";
import "./styles/tokens.css";
import "./styles/chooser.css";

/* Default geometry (welcome/chooser rubric: ~820x520, centered). */
const chooserDefaultSize = { width: 820, height: 520 } as const;

export type ChooserChoice = {
  readonly id: string;
  readonly symbol: SystemSymbolName;
  readonly title: string;
  readonly caption: string;
  // Rendered in the detail pane while this choice is selected.
  readonly preview?: ReactNode;
};

export type ChooserCommand = {
  readonly id: string;
  readonly symbol?: SystemSymbolName;
  readonly title: string;
  readonly caption?: string;
  readonly checked?: boolean;
  readonly onSelect: () => void;
};

export type ChooserCommandSection = {
  readonly id: string;
  readonly label?: string;
  readonly commands: readonly ChooserCommand[];
};

// The escape hatch beside the filmstrip: a borderless command that opens a
// menu — never a peer card.
export type ChooserSecondaryGroup = {
  readonly label: string;
  readonly caption?: string;
  // Shown in place of the caption while one of the menu commands is active.
  readonly activeCaption?: string;
  readonly sections: readonly ChooserCommandSection[];
};

// localStorage-synced id list (e.g. installed templates), shared across tabs
// via the storage event and across same-tab writers via explicit notify.
export type StoredIdList = {
  readonly key: string;
  readonly useStoredIds: () => readonly string[];
  readonly read: () => readonly string[];
  readonly add: (id: string) => void;
  readonly remove: (id: string) => void;
};

export function createStoredIdList(key: string, isValid: (id: string) => boolean = () => true): StoredIdList {
  const empty: readonly string[] = [];
  const subscribers = new Set<() => void>();
  let snapshotRaw: string | null | undefined;
  let snapshot = empty;

  function readRaw(): string | null {
    if (typeof window === "undefined" || window.localStorage === undefined) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function parse(raw: string | null): readonly string[] {
    if (raw === null) return empty;
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) return empty;
      return value.filter((id): id is string => typeof id === "string" && isValid(id));
    } catch {
      return empty;
    }
  }

  // Snapshot identity is keyed on the raw string so useSyncExternalStore sees
  // a stable reference between unrelated storage writes.
  function browserSnapshot(): readonly string[] {
    const raw = readRaw();
    if (raw !== snapshotRaw) {
      snapshotRaw = raw;
      snapshot = parse(raw);
    }
    return snapshot;
  }

  function notify() {
    snapshotRaw = undefined;
    for (const subscriber of subscribers) subscriber();
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === key) notify();
  }

  function subscribe(subscriber: () => void) {
    subscribers.add(subscriber);
    if (subscribers.size === 1) window.addEventListener("storage", handleStorage);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) window.removeEventListener("storage", handleStorage);
    };
  }

  function write(ids: readonly string[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Storage unavailable: state stays as-is; notify below re-reads it.
    }
    notify();
  }

  return {
    key,
    useStoredIds: () => useSyncExternalStore(subscribe, browserSnapshot, () => empty),
    read: browserSnapshot,
    add: (id) => {
      const current = browserSnapshot();
      if (!current.includes(id)) write([...current, id]);
    },
    remove: (id) => {
      const current = browserSnapshot();
      if (current.includes(id)) write(current.filter((value) => value !== id));
    },
  };
}

function SecondaryGroupMenu({ group }: { readonly group: ChooserSecondaryGroup }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasActiveCommand = group.sections.some((section) => section.commands.some((command) => command.checked === true));

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')?.focus({ preventScroll: true });
    });
    function closeFromOutside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleMenuKey(event: KeyboardEvent) {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? []);
      const activeElement = document.activeElement;
      const index = activeElement instanceof HTMLElement ? items.indexOf(activeElement) : -1;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      } else if (event.key === "Tab") {
        event.preventDefault();
        setOpen(false);
        const nextTarget = event.shiftKey
          ? triggerRef.current
          : wrapperRef.current?.closest(".mc-chooser-window")?.querySelector<HTMLElement>(".mc-window-footer button, .mc-window-footer a") ??
            triggerRef.current;
        requestAnimationFrame(() => nextTarget?.focus({ preventScroll: true }));
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = index < 0 ? 0 : (index + direction + items.length) % items.length;
        items[next]?.focus({ preventScroll: true });
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        items[event.key === "Home" ? 0 : items.length - 1]?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", handleMenuKey);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", handleMenuKey);
    };
  }, [open]);

  function choose(command: ChooserCommand) {
    command.onSelect();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  return (
    <div ref={wrapperRef} className="mc-chooser-secondary">
      <button
        ref={triggerRef}
        type="button"
        className="mc-chooser-secondary-trigger"
        data-selected={hasActiveCommand}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <SystemSymbol name="square.grid.2x2" />
        <span>
          <strong>{group.label}</strong>
          {hasActiveCommand && group.activeCaption !== undefined ? <small>{group.activeCaption}</small> : group.caption !== undefined ? <small>{group.caption}</small> : null}
        </span>
        <SystemSymbol name="chevron.down" />
      </button>
      {open ? (
        <div ref={menuRef} className="mc-chooser-secondary-menu" role="menu" aria-label={group.label}>
          {group.sections.map((section) => (
            <div key={section.id} role="none" className="mc-chooser-menu-section">
              {section.label !== undefined ? <div className="mc-chooser-menu-label">{section.label}</div> : null}
              {section.commands.map((command) => (
                <button
                  type="button"
                  key={command.id}
                  role={command.checked === undefined ? "menuitem" : "menuitemradio"}
                  aria-checked={command.checked === undefined ? undefined : command.checked}
                  tabIndex={-1}
                  onClick={() => choose(command)}
                >
                  {command.checked === true ? (
                    <SystemSymbol name="checkmark" />
                  ) : command.symbol !== undefined ? (
                    <SystemSymbol name={command.symbol} />
                  ) : (
                    <span className="mc-chooser-menu-symbol-spacer" />
                  )}
                  <span>
                    <strong>{command.title}</strong>
                    {command.caption !== undefined ? <small>{command.caption}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChooserWindow({
  title,
  subtitle,
  finePrint,
  windowTitle,
  toolbarExtras,
  choices,
  selected,
  onSelect,
  onActivate,
  secondaryGroup,
  footer,
  label,
  frame,
  onClose,
  onMinimize,
  onZoom,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly finePrint?: string;
  readonly windowTitle?: string;
  readonly toolbarExtras?: ReactNode;
  readonly choices: readonly ChooserChoice[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  // Double-click or Enter on a choice; the footer's primary action is `footer`'s concern.
  readonly onActivate?: (id: string) => void;
  readonly secondaryGroup?: ChooserSecondaryGroup;
  readonly footer: ReactNode;
  readonly label?: string;
  /** Placement/size override; defaults to ~820x520, centered. */
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Roving tabindex: exactly one filmstrip card is tabbable.
  const [focusedId, setFocusedId] = useState<string | null>(selected ?? choices[0]?.id ?? null);
  const selectedChoice = choices.find((choice) => choice.id === selected) ?? null;
  const resolvedFocusId = choices.some((choice) => choice.id === focusedId) ? focusedId : choices[0]?.id ?? null;

  function focusChoice(id: string) {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      for (const card of list.querySelectorAll<HTMLElement>("[data-mc-choice-id]")) {
        if (card.dataset["mcChoiceId"] === id) {
          card.focus({ preventScroll: true });
          return;
        }
      }
    });
  }

  function handleChoiceKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    const index = choices.findIndex((choice) => choice.id === id);
    if (index < 0) return;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = Math.min(choices.length - 1, index + 1);
    else if (event.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = choices.length - 1;
    else if (event.key === "Enter") {
      event.preventDefault();
      onActivate?.(id);
      return;
    } else return;
    event.preventDefault();
    const next = choices[nextIndex];
    if (!next) return;
    onSelect(next.id);
    setFocusedId(next.id);
    focusChoice(next.id);
  }

  return (
    <WindowChrome
      className="mc-chooser-window"
      label={label ?? title}
      frame={frame}
      defaultSize={chooserDefaultSize}
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
    >
      <header className="mc-chooser-toolbar" data-window-drag-handle="">
        <TrafficLights />
        <strong>{windowTitle ?? ""}</strong>
        <div className="mc-chooser-toolbar-actions">{toolbarExtras}</div>
      </header>
      <header className="mc-chooser-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {finePrint !== undefined ? <small>{finePrint}</small> : null}
      </header>
      <div className="mc-chooser-body">
        <div className={`mc-chooser-catalog${secondaryGroup !== undefined ? " mc-has-secondary" : ""}`}>
          <div ref={listRef} className="mc-chooser-filmstrip" role="listbox" aria-label={title}>
            {choices.map((choice) => (
              <button
                type="button"
                role="option"
                key={choice.id}
                data-mc-choice-id={choice.id}
                className="mc-chooser-choice"
                aria-selected={choice.id === selected}
                tabIndex={choice.id === resolvedFocusId ? 0 : -1}
                onClick={() => {
                  onSelect(choice.id);
                  setFocusedId(choice.id);
                }}
                onDoubleClick={() => onActivate?.(choice.id)}
                onKeyDown={(event) => handleChoiceKeyDown(event, choice.id)}
              >
                <SystemSymbol name={choice.symbol} />
                <span className="mc-chooser-choice-copy">
                  <strong>{choice.title}</strong>
                  <small>{choice.caption}</small>
                </span>
              </button>
            ))}
          </div>
          {secondaryGroup !== undefined ? <SecondaryGroupMenu group={secondaryGroup} /> : null}
        </div>
        <section className="mc-chooser-detail" aria-live="polite">
          {selectedChoice?.preview}
        </section>
      </div>
      <footer className="mc-window-footer">{footer}</footer>
    </WindowChrome>
  );
}
