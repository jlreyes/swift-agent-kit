"use client";

// PLACEHOLDER components — replaced wholesale when the real packages/mac-chrome
// is vendored over this directory. The stub keeps only enough client behavior
// for template routes and jsdom interaction tests. Prop names, rendered class
// names, and default window geometry mirror the real package so pages written
// against the stub keep working after vendoring. Full drag, focus, overlay,
// and keyboard behavior exists only in the real package.
import { useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref, type RefObject } from "react";

/* ----- Menu types (mirrors menu.tsx / desktop-shell.tsx) ----- */

export interface MenuAction {
  readonly kind: "action";
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly shortcut?: string;
  readonly icon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly href?: string;
  readonly target?: string;
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: () => void;
}

export type MenuEntry =
  | MenuAction
  | { readonly kind: "separator"; readonly id: string }
  | { readonly kind: "section"; readonly id: string; readonly label: string };

export type MenuSpec = readonly MenuEntry[];

export type MenuPopoverConfig = {
  readonly className?: string;
  readonly placement?: "bottom start" | "bottom end";
  readonly offset?: number;
  readonly nonModal?: boolean;
};

/** A menu-bar title backed by a real dropdown (functional in the real package). */
export type MenuBarMenu = {
  readonly title: string;
  readonly items: MenuSpec;
};

export type MenuCommand = {
  readonly menu: string;
  readonly id: string;
  readonly label: string;
};

const stubStandardMenus: Readonly<Record<string, MenuSpec>> = {
  Window: [
    { kind: "action", id: "minimize", label: "Minimize", shortcut: "⌘M" },
    { kind: "action", id: "zoom", label: "Zoom" },
  ],
  Help: [
    { kind: "action", id: "app-help", label: "App Help", shortcut: "⌘?" },
  ],
};

export function MacMenu({ className = "", items, label, trigger, triggerClassName = "", triggerLabel }: {
  readonly className?: string;
  readonly isOpen?: boolean;
  readonly items: MenuSpec;
  readonly label: string;
  readonly onMenuKeyDown?: () => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onTriggerPointerEnter?: () => void;
  readonly popover?: MenuPopoverConfig;
  readonly trigger: ReactNode;
  readonly triggerLabel?: string;
  readonly triggerClassName?: string;
}) {
  return (
    <details className={`mc-menu ${className}`.trim()}>
      <summary role="button" aria-label={triggerLabel} className={`mc-menu-trigger ${triggerClassName}`.trim()}>{trigger}</summary>
      <div role="menu" aria-label={label} className="mc-menu-popover">
        {items.map((item) => item.kind === "separator" ? (
          <hr key={item.id} className="menu-separator" />
        ) : item.kind === "section" ? (
          <strong key={item.id} className="menu-section-label">{item.label}</strong>
        ) : (
          <button key={item.id} type="button" role="menuitem" disabled={item.disabled} onClick={item.onSelect}>
            <span aria-hidden="true">{item.icon ?? (item.checked ? "✓" : null)}</span>
            <span>{item.label}</span>
            {item.shortcut !== undefined ? <kbd>{item.shortcut}</kbd> : item.trailingIcon}
          </button>
        ))}
      </div>
    </details>
  );
}

export function MacDetailsMenu({ children, className = "", label, summary }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly summary: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mc-details-menu ${className}`.trim()}>
      <button
        type="button"
        className="mc-details-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {summary}
      </button>
      {open ? <div className="mc-details-menu-popover"><div className="mc-popover-dialog">{children}</div></div> : null}
    </div>
  );
}

/* ----- Window frame (mirrors window.tsx) ----- */

export type WindowFrame = {
  readonly top?: number | string;
  readonly left?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
};

type WindowSize = { readonly width: number; readonly height: number };

const genericDefaultSize: WindowSize = { width: 720, height: 480 };
const finderDefaultSize: WindowSize = { width: 940, height: 580 };

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function framePlacement(frame: WindowFrame | undefined, defaultSize: WindowSize): CSSProperties {
  const width = cssLength(frame?.width ?? defaultSize.width);
  const height = cssLength(frame?.height ?? defaultSize.height);
  return {
    width,
    height,
    top: frame?.top !== undefined ? cssLength(frame.top) : `max(28px, calc(50% - (${height}) / 2 - 28px))`,
    left: frame?.left !== undefined ? cssLength(frame.left) : `calc(50% - (${width}) / 2)`,
  };
}

export interface DesktopShellProps {
  readonly appName: string;
  /** Plain standard titles get native defaults in the real package. */
  readonly menuItems?: readonly (string | MenuBarMenu)[];
  readonly appleMenuItems?: MenuSpec;
  readonly appMenuItems?: MenuSpec;
  readonly onMenuAction?: (command: MenuCommand) => void;
  readonly date?: string;
  readonly clock?: string;
  /** MenuBarExtra elements rendered in flow beside the status items. */
  readonly menuBarExtras?: ReactNode;
  /** CSS image value (url(...), gradient, var(...)) or a bare image URL. */
  readonly wallpaper?: string;
  readonly children: ReactNode;
}

export function DesktopShell({
  appName,
  menuItems = ["File", "Edit", "View", "Window", "Help"],
  onMenuAction,
  date = "Wed Aug 6",
  clock = "9:47 AM",
  menuBarExtras,
  wallpaper,
  children,
}: DesktopShellProps) {
  const canvasStyle = wallpaper
    ? ({ "--mc-wallpaper": wallpaper.startsWith("url(") ? wallpaper : `url("${wallpaper}")` } as CSSProperties)
    : undefined;
  return (
    <main className="showcase-viewport">
      <div className="desktop-canvas" style={canvasStyle}>
        <header className="mac-menu-bar">
          <div className="menu-left">
            <button type="button" className="mc-menu-trigger mc-menubar-menu-title" aria-label="Apple">
              <span className="apple-mark"><svg viewBox="0 0 18 20" aria-hidden="true"><path d="M14.8 10.5c0-2 1.7-3 1.8-3.1a4 4 0 0 0-3.2-1.7c-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8A4.4 4.4 0 0 0 3.3 8c-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3.1-.7 1.4 0 1.8.7 3.1.7s2.1-1.1 2.8-2.2a9.8 9.8 0 0 0 1.3-2.7 4 4 0 0 1-2.8-3.9ZM12.5 4.3A4 4 0 0 0 13.4 1a4.1 4.1 0 0 0-2.8 1.4 3.8 3.8 0 0 0-1 3.1 3.4 3.4 0 0 0 2.9-1.2Z" /></svg></span>
            </button>
            <button type="button" className="mc-menu-trigger mc-menubar-menu-title"><strong>{appName}</strong></button>
            {menuItems.map((item) => {
              const title = typeof item === "string" ? item : item.title;
              const baseItems: MenuSpec = typeof item === "string"
                ? stubStandardMenus[title] ?? [{ kind: "action", id: `stub-${title.toLowerCase()}`, label: `No ${title} commands`, disabled: true }]
                : item.items;
              const items: MenuSpec = baseItems.map((entry) =>
                entry.kind === "action" && entry.onSelect === undefined && onMenuAction !== undefined
                  ? { ...entry, onSelect: () => onMenuAction({ menu: title, id: entry.id, label: entry.label }) }
                  : entry);
              return (
                <MacMenu
                  key={title}
                  className="mc-menubar-menu"
                  triggerClassName="mc-menubar-menu-title"
                  trigger={title}
                  triggerLabel={`${title} menu`}
                  label={`${title} menu`}
                  items={items}
                />
              );
            })}
          </div>
          <div className="menu-right" aria-label="Mac status items">
            {menuBarExtras !== undefined ? <span className="mc-menubar-extras">{menuBarExtras}</span> : null}
            <span>{date}</span>
            <span>{clock}</span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function TrafficLights({ disabled = false }: {
  readonly disabled?: boolean;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
} = {}) {
  return (
    <div className={`traffic-lights${disabled ? " mc-disabled" : ""}`} aria-label="Window controls">
      <span className="traffic-close" />
      <span className="traffic-minimize" />
      <span className="traffic-zoom" />
    </div>
  );
}

export function WindowChrome({
  children,
  className = "",
  defaultSize = genericDefaultSize,
  frame,
  label,
  style,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly defaultSize?: WindowSize;
  readonly draggable?: boolean;
  readonly dragHandleSelector?: string;
  /** Placement/size override; unset sides default to the centered placement. */
  readonly frame?: WindowFrame;
  readonly label: string;
  readonly style?: CSSProperties;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  return (
    <section
      className={`mac-window ${className}`.trim()}
      aria-label={label}
      style={{ ...framePlacement(frame, defaultSize), ...style }}
    >
      {children}
    </section>
  );
}

export function MacToolbar({ center, children, className = "", leading, title, trailing }: {
  readonly center?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly leading?: ReactNode;
  readonly title?: ReactNode;
  readonly trailing?: ReactNode;
}) {
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

export type ToolbarGlyphName = "back" | "forward" | "grid" | "inspector" | "list" | "more" | "search";

export function ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName }) {
  return <SystemSymbol name={name === "grid" ? "square.grid.2x2" : name === "list" ? "list.bullet" : name === "inspector" ? "sidebar.trailing" : name === "search" ? "magnifyingglass" : "chevron.right"} />;
}

export function ToolbarCapsule({ children, className = "", divided = false, label, role }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly divided?: boolean;
  readonly label?: string;
  readonly role?: "group";
}) {
  return <span className={`mc-capsule ${className}`.trim()} data-divided={divided ? "" : undefined} role={role} aria-label={label}>{children}</span>;
}

export function ToolbarButton({ children, className = "", disabled = false, label, pressed, ref, selected = false, title, onClick }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly pressed?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
  readonly selected?: boolean;
  readonly title?: string;
  readonly onClick?: () => void;
}) {
  return (
    <button ref={ref} type="button" className={`mc-toolbar-button${selected ? " selected" : ""} ${className}`.trim()} aria-label={label} aria-pressed={pressed} title={title} disabled={disabled} onClick={onClick}>
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
    <button type="button" className={`mc-toolbar-button mc-toolbar-toggle${pressed ? " selected" : ""} ${className}`.trim()} aria-label={label} aria-pressed={pressed} title={title} onClick={() => onPressedChange(!pressed)}>
      {children}
    </button>
  );
}

export function ToolbarSearchBubble({ label = "Search", open, placeholder = "Search", value, onChange, onOpenChange, onValueChange }: {
  readonly label?: string;
  readonly open?: boolean;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange?: (value: string) => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onValueChange?: (value: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const expanded = open ?? internalOpen;
  const setExpanded = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className={`mc-search-bubble${expanded ? " open" : ""}`}>
      <button type="button" aria-label={label} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><ToolbarGlyph name="search" /></button>
      {expanded ? <input aria-label={label} value={value} placeholder={placeholder} onChange={(event) => (onChange ?? onValueChange)?.(event.target.value)} /> : null}
    </div>
  );
}

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Image URL, or a ReactNode (e.g. a SystemSymbol). */
  readonly icon: ReactNode | string;
  readonly running?: boolean;
  /** Adjacent items with different group values get a divider between them. */
  readonly group?: string;
  readonly onActivate?: () => void;
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
        return (
          <span className="p0-dock-item-wrap" key={item.id}>
            {startsGroup ? <i className="p0-dock-divider" aria-hidden="true" /> : null}
            <button
              className={`p0-dock-item${item.running ? " is-running" : ""}`}
              type="button"
              aria-label={item.label}
              onClick={item.onActivate}
            >
              {typeof item.icon === "string"
                ? <img src={item.icon} alt="" draggable={false} />
                : <span className="p0-dock-icon" aria-hidden="true">{item.icon}</span>}
              <span className="p0-dock-running-dot" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </nav>
  );
}

export function MenuBarExtra({ badge, children, icon, label }: {
  readonly badge?: number | string;
  readonly children: ReactNode;
  readonly icon: ReactNode | string;
  readonly label: string;
}) {
  return (
    <details className="mc-menubar-layer">
      <summary className="mc-menubar-trigger" aria-label={label}>
        {typeof icon === "string" ? <img src={icon} alt="" /> : icon}
        {badge !== undefined && badge !== 0 && badge !== "" ? <span className="mc-menubar-badge">{badge}</span> : null}
      </summary>
      <aside className="menu-popover mc-menubar-popover" aria-label={label}>{children}</aside>
    </details>
  );
}

export type FinderViewMode = "icons" | "list";

export type FinderEntry = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly icon: ReactNode;
  readonly modified?: string;
  readonly size?: string;
  readonly badge?: string;
  readonly draggable?: boolean;
};

export type SidebarItem = {
  readonly id: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly badge?: ReactNode;
  readonly indent?: boolean;
  readonly selected?: boolean;
  readonly onSelect: () => void;
};

export type SidebarSection = {
  readonly id: string;
  readonly title?: string;
  readonly collapsible?: boolean;
  readonly count?: number;
  readonly selected?: boolean;
  readonly onTitleSelect?: () => void;
  readonly action?: ReactNode;
  /** Extra class on the section root (e.g. a bottom-anchored section). */
  readonly className?: string;
  readonly items: readonly SidebarItem[];
};

export type FinderSelection = {
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
};

export type FinderSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

// Static Finder shell mirroring the real package's rendered structure (window
// label, sidebar header/sections, listbox/option roles, mc-finder-* classes).
// Callback props are accepted for API parity but never wired — server-safe.
export function FinderWindow({ sidebar, sidebarHeader, entries, mode, onModeChange, search, selection, onOpen, preview, previewVisible, onPreviewVisibleChange, statusBar, toolbarExtras, title, label, frame }: {
  readonly sidebar: readonly SidebarSection[];
  readonly sidebarHeader?: ReactNode;
  readonly entries: readonly FinderEntry[];
  readonly mode: FinderViewMode;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly search: FinderSearch;
  readonly selection: FinderSelection;
  readonly onOpen: (entry: FinderEntry) => void;
  readonly preview?: (selection: FinderEntry | null) => ReactNode;
  readonly previewVisible?: boolean;
  readonly onPreviewVisibleChange?: (visible: boolean) => void;
  readonly statusBar?: ReactNode;
  readonly toolbarExtras?: ReactNode;
  readonly title?: string;
  readonly label?: string;
  /** Placement/size override; defaults to ~940x580, centered. */
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
  readonly iconColumns?: number;
}) {
  return (
    <WindowChrome className="mc-finder-window" label={label ?? title ?? "Finder"} frame={frame} defaultSize={finderDefaultSize}>
      <aside className="mc-finder-sidebar">
        <div className="mc-finder-sidebar-top" data-window-drag-handle="">
          <TrafficLights />
        </div>
        {sidebarHeader !== undefined ? <div className="mc-finder-sidebar-header">{sidebarHeader}</div> : null}
        <nav aria-label="Sidebar">
          {sidebar.map((section) => (
            <section
              key={section.id}
              className={`mc-sidebar-section${section.className !== undefined ? ` ${section.className}` : ""}`}
            >
              {section.title !== undefined ? <strong className="mc-sidebar-section-label">{section.title}</strong> : null}
              <div className="mc-sidebar-items">
                {section.items.map((item) => (
                  <span key={item.id} className={`mc-sidebar-item${item.selected ? " mc-selected" : ""}`}>
                    {item.icon !== undefined ? <span className="mc-sidebar-item-icon" aria-hidden="true">{item.icon}</span> : null}
                    <span className="mc-sidebar-item-label">{item.label}</span>
                    {item.badge !== undefined ? <small className="mc-sidebar-item-badge">{item.badge}</small> : null}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <main className="mc-finder-main">
        <MacToolbar
          title={title}
          trailing={
            <>
              {toolbarExtras}
              <ToolbarCapsule divided role="group" label="View">
                <ToolbarButton label="Icon view" selected={mode === "icons"} pressed={mode === "icons"} onClick={() => onModeChange("icons")}><SystemSymbol name="square.grid.2x2" /></ToolbarButton>
                <ToolbarButton label="List view" selected={mode === "list"} pressed={mode === "list"} onClick={() => onModeChange("list")}><SystemSymbol name="list.bullet" /></ToolbarButton>
              </ToolbarCapsule>
              {preview !== undefined ? (
                <ToolbarToggle
                  label={previewVisible === false ? "Show Preview" : "Hide Preview"}
                  pressed={previewVisible !== false}
                  onPressedChange={(visible) => onPreviewVisibleChange?.(visible)}
                >
                  <SystemSymbol name="sidebar.trailing" />
                </ToolbarToggle>
              ) : null}
              <ToolbarSearchBubble value={search.value} onChange={search.onChange} />
            </>
          }
        />
        <div role="listbox" aria-label={title ?? "Files"} className={`mc-finder-content mc-${mode}`}>
          {entries.map((entry) => (
            <button
              type="button"
              role="option"
              key={entry.id}
              className={`mc-finder-entry${selection.selectedId === entry.id ? " mc-selected" : ""}`}
              aria-selected={selection.selectedId === entry.id}
              onClick={() => selection.onSelect(entry.id)}
              onDoubleClick={() => onOpen(entry)}
            >
              <span className="mc-finder-entry-icon" aria-hidden="true">{entry.icon}</span>
              <span className="mc-finder-name">{entry.name}</span>
              <span className="mc-finder-modified">{entry.modified ?? ""}</span>
              <span className="mc-finder-size">{entry.size ?? ""}</span>
            </button>
          ))}
        </div>
        {statusBar !== undefined ? <footer className="mc-finder-status">{statusBar}</footer> : null}
      </main>
      {preview !== undefined && previewVisible !== false ? <aside className="mc-finder-preview">{preview(entries.find((entry) => entry.id === selection.selectedId) ?? null)}</aside> : null}
    </WindowChrome>
  );
}

export function QuickLook({ entry, detail, onClose }: {
  readonly entry: FinderEntry;
  readonly detail?: ReactNode;
  readonly onClose: () => void;
}) {
  return (
    <div className="mc-quicklook-scrim">
      <section className="mc-quicklook-panel" role="dialog" aria-modal="true" aria-label={`Quick Look ${entry.name}`}>
        <header><button type="button" onClick={onClose} aria-label="Close Quick Look">×</button><strong>{entry.name}</strong></header>
        <div>{entry.icon}<h2>{entry.name}</h2>{detail}</div>
      </section>
    </div>
  );
}

export function finderKeyTarget(key: string, index: number, columns: number, count: number): number | null {
  if (count === 0) return null;
  if (index < 0 || index >= count) return 0;
  if (key === "ArrowLeft") return columns > 1 && index > 0 ? index - 1 : null;
  if (key === "ArrowRight") return columns > 1 && index < count - 1 ? index + 1 : null;
  if (key === "ArrowUp") return index - columns >= 0 ? index - columns : null;
  if (key === "ArrowDown") return index + columns < count ? index + columns : null;
  return null;
}

export type SystemSymbolName = string;

export type ChooserChoice = {
  readonly id: string;
  readonly symbol: SystemSymbolName;
  readonly title: string;
  readonly caption: string;
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

export type ChooserSecondaryGroup = {
  readonly label: string;
  readonly caption?: string;
  readonly activeCaption?: string;
  readonly sections: readonly ChooserCommandSection[];
};

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
  let rawSnapshot: string | null | undefined;
  let parsedSnapshot = empty;
  function readRaw() {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  function read() {
    const raw = readRaw();
    if (raw === rawSnapshot) return parsedSnapshot;
    rawSnapshot = raw;
    try {
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      parsedSnapshot = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && isValid(id)) : empty;
    } catch {
      parsedSnapshot = empty;
    }
    return parsedSnapshot;
  }
  function notify() {
    rawSnapshot = undefined;
    subscribers.forEach((subscriber) => subscriber());
  }
  function write(ids: readonly string[]) {
    try { window.localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage is optional */ }
    notify();
  }
  return {
    key,
    useStoredIds: () => useSyncExternalStore(
      (subscriber) => { subscribers.add(subscriber); return () => subscribers.delete(subscriber); },
      read,
      () => empty,
    ),
    read,
    add: (id) => { const ids = read(); if (!ids.includes(id)) write([...ids, id]); },
    remove: (id) => write(read().filter((candidate) => candidate !== id)),
  };
}

export function ChooserWindow({ title, subtitle, finePrint, windowTitle, toolbarExtras, choices, selected, onSelect, onActivate, secondaryGroup, footer, label, frame }: {
  readonly title: string;
  readonly subtitle: string;
  readonly finePrint?: string;
  readonly windowTitle?: string;
  readonly toolbarExtras?: ReactNode;
  readonly choices: readonly ChooserChoice[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onActivate?: (id: string) => void;
  readonly secondaryGroup?: ChooserSecondaryGroup;
  readonly footer: ReactNode;
  readonly label?: string;
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const active = choices.find((choice) => choice.id === selected);
  return (
    <WindowChrome className="mc-chooser-window" label={label ?? title} frame={frame}>
      <header className="mc-chooser-toolbar"><TrafficLights /><strong>{windowTitle}</strong>{toolbarExtras}</header>
      <header className="mc-chooser-heading"><h1>{title}</h1><p>{subtitle}</p>{finePrint !== undefined ? <small>{finePrint}</small> : null}</header>
      <div className="mc-chooser-body">
        <div className="mc-chooser-filmstrip" role="listbox" aria-label={title}>
          {choices.map((choice) => (
            <button type="button" role="option" aria-selected={choice.id === selected} key={choice.id} onClick={() => onSelect(choice.id)} onDoubleClick={() => onActivate?.(choice.id)}>
              <SystemSymbol name={choice.symbol} /><strong>{choice.title}</strong><small>{choice.caption}</small>
            </button>
          ))}
        </div>
        {secondaryGroup !== undefined ? (
          <MacDetailsMenu label={secondaryGroup.label} summary={secondaryGroup.label}>
            {secondaryGroup.sections.flatMap((section) => section.commands).map((command) => <button type="button" key={command.id} onClick={command.onSelect}>{command.title}</button>)}
          </MacDetailsMenu>
        ) : null}
        <section className="mc-chooser-detail">{active?.preview}</section>
      </div>
      <footer className="mc-window-footer">{footer}</footer>
    </WindowChrome>
  );
}

export type SetupStep = {
  readonly id: string;
  readonly name: string;
  readonly symbol?: SystemSymbolName;
};

export function SetupHeading({ symbol, title }: { readonly symbol?: SystemSymbolName; readonly title: string }) {
  return <header className="mc-setup-heading">{symbol !== undefined ? <SystemSymbol name={symbol} /> : null}<h1>{title}</h1></header>;
}

export function Sheet({ open, onClose, label, children }: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly label?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly children: ReactNode;
}) {
  if (!open) return null;
  return <div className="mc-sheet-scrim" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="mc-sheet" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>;
}

export function SetupAssistant({ steps, currentStep, furthestIndex, onSelectStep, onBack, backLabel = "Back", onContinue, continueLabel = "Continue", continueDisabled = false, modalOpen = false, label, frame, children }: {
  readonly steps: readonly SetupStep[];
  readonly currentStep: string;
  readonly furthestIndex: number;
  readonly onSelectStep: (id: string) => void;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly onContinue: () => void;
  readonly continueLabel?: string;
  readonly continueDisabled?: boolean;
  readonly modalOpen?: boolean;
  readonly label?: string;
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
  readonly children: ReactNode;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  return (
    <WindowChrome className="mc-setup-window" label={label ?? "Setup Assistant"} frame={frame}>
      <div className="mc-setup-titlebar"><TrafficLights /></div>
      <div className="mc-setup-underlay" aria-hidden={modalOpen || undefined}>
        <nav className="mc-setup-progress" aria-label="Steps">{steps.map((step, index) => <button type="button" key={step.id} disabled={index > furthestIndex} aria-current={step.id === currentStep ? "step" : undefined} onClick={() => onSelectStep(step.id)}>{step.symbol !== undefined ? <SystemSymbol name={step.symbol} /> : null}{step.name}</button>)}</nav>
        <div className="mc-setup-content">{children}</div>
        <footer className="mc-setup-footer"><button type="button" className="mc-button mc-text" onClick={onBack}>{backLabel}</button><button type="button" className="mc-button mc-primary" disabled={continueDisabled} onClick={onContinue}>{continueLabel}</button></footer>
      </div>
    </WindowChrome>
  );
}

export type ChatRole = "owner" | "agent" | "system";
export type ChatAuthor = { readonly name: string; readonly icon?: ReactNode; readonly role: ChatRole };
export type ChatMessage = { readonly id: string; readonly author: ChatAuthor; readonly at: string; readonly body: ReactNode; readonly status?: string };
export type Conversation = { readonly id: string; readonly title: string; readonly icon?: ReactNode; readonly messages: readonly ChatMessage[] };
export type ChatComposer = { readonly value: string; readonly onChange: (value: string) => void; readonly onSend: () => void; readonly placeholder?: string; readonly accessory?: ReactNode };
export type ChatSearch = { readonly value: string; readonly onChange: (value: string) => void };

export function ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", toolbarExtras, emptyTranscript, label, frame }: {
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly composer: ChatComposer;
  readonly search?: ChatSearch;
  readonly sidebarLabel?: string;
  readonly toolbarExtras?: ReactNode;
  readonly emptyTranscript?: ReactNode;
  readonly label?: string;
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const active = conversations.find((conversation) => conversation.id === activeConversationId);
  return (
    <WindowChrome className="mc-chat-window" label={label ?? active?.title ?? "Chat"} frame={frame}>
      <aside className="mc-chat-sidebar" aria-label={sidebarLabel}><div className="mc-chat-sidebar-top"><TrafficLights /></div><nav>{conversations.map((conversation) => <button type="button" key={conversation.id} aria-current={conversation.id === activeConversationId ? "true" : undefined} onClick={() => onSelectConversation(conversation.id)}>{conversation.icon}<strong>{conversation.title}</strong></button>)}</nav></aside>
      <section className="mc-chat-main">
        <MacToolbar title={active?.title} trailing={<>{search !== undefined ? <ToolbarSearchBubble value={search.value} onChange={search.onChange} label="Search conversation" /> : null}{toolbarExtras}</>} />
        <div className="mc-chat-transcript" role="log" aria-label="Conversation">{active?.messages.length ? active.messages.map((message) => <article key={message.id} className={`mc-chat-message mc-${message.author.role}`}>{message.author.icon}<strong>{message.author.name}</strong><p>{message.body}</p><small>{message.at}</small></article>) : emptyTranscript}</div>
        <form className="mc-chat-composer" onSubmit={(event) => { event.preventDefault(); if (composer.value.trim()) composer.onSend(); }}>{composer.accessory}<textarea aria-label={composer.placeholder ?? "Message"} value={composer.value} placeholder={composer.placeholder} onChange={(event) => composer.onChange(event.target.value)} /><button type="submit" disabled={!composer.value.trim()} aria-label="Send message"><SystemSymbol name="arrow.up" /></button></form>
      </section>
    </WindowChrome>
  );
}

export function useWindowDrag<T extends HTMLElement>() {
  const windowRef = useRef<T>(null);
  const noop = () => undefined;
  return { windowRef, style: {}, onPointerDown: noop, onPointerMove: noop, onPointerUp: noop, onPointerCancel: noop };
}

export function useModalFocusTrap() {
  return () => undefined;
}

export function SystemSymbol({ className, name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  return (
    <svg className={className} data-system-symbol={name} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
