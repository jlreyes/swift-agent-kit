// PLACEHOLDER components — replaced wholesale when the real packages/mac-chrome
// is vendored over this directory. Server-safe (no hooks, no handlers) so they
// render in RSC builds and in jsdom tests alike. Prop names, rendered class
// names, and default window geometry mirror the real package so pages written
// against the stub keep working after vendoring. Interactive behavior (drag,
// traffic-light actions, dropdown menus) exists only in the real package.
import type { CSSProperties, ReactNode } from "react";

/* ----- Menu types (mirrors menu.tsx / desktop-shell.tsx) ----- */

export interface MenuAction {
  readonly kind: "action";
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly href?: string;
  readonly target?: string;
  readonly checked?: boolean;
  readonly onSelect?: () => void;
}

export type MenuEntry =
  | MenuAction
  | { readonly kind: "separator"; readonly id: string }
  | { readonly kind: "section"; readonly id: string; readonly label: string };

export type MenuSpec = readonly MenuEntry[];

/** A menu-bar title backed by a real dropdown (functional in the real package). */
export type MenuBarMenu = {
  readonly title: string;
  readonly items: MenuSpec;
};

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
  /** Plain strings render inert; { title, items } opens a real dropdown (real package). */
  readonly menuItems?: readonly (string | MenuBarMenu)[];
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
            <span className="apple-mark" aria-hidden="true"></span>
            <strong>{appName}</strong>
            {menuItems.map((item) => {
              const title = typeof item === "string" ? item : item.title;
              return <span key={title}>{title}</span>;
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

export interface DockItem {
  readonly id: string;
  readonly label: string;
  /** Image URL, or a ReactNode (e.g. a SystemSymbol). */
  readonly icon: ReactNode | string;
  readonly running?: boolean;
  /** Adjacent items with different group values get a divider between them. */
  readonly group?: string;
  readonly onActivate?: () => void;
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
        return (
          <span className="p0-dock-item-wrap" key={item.id}>
            {startsGroup ? <i className="p0-dock-divider" aria-hidden="true" /> : null}
            <button
              className={`p0-dock-item${item.running ? " is-running" : ""}`}
              type="button"
              aria-label={item.label}
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
export function FinderWindow({ sidebar, sidebarHeader, entries, mode, selection, title, label, frame }: {
  readonly sidebar: readonly SidebarSection[];
  readonly sidebarHeader?: ReactNode;
  readonly entries: readonly FinderEntry[];
  readonly mode: FinderViewMode;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly search: FinderSearch;
  readonly selection: FinderSelection;
  readonly onOpen: (entry: FinderEntry) => void;
  readonly preview?: (selection: FinderEntry | null) => ReactNode;
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
        <div role="listbox" aria-label={title ?? "Files"} className={`mc-finder-content mc-${mode}`}>
          {entries.map((entry) => (
            <button
              type="button"
              role="option"
              key={entry.id}
              className={`mc-finder-entry${selection.selectedId === entry.id ? " mc-selected" : ""}`}
              aria-selected={selection.selectedId === entry.id}
            >
              <span className="mc-finder-entry-icon" aria-hidden="true">{entry.icon}</span>
              <span className="mc-finder-name">{entry.name}</span>
              <span className="mc-finder-modified">{entry.modified ?? ""}</span>
              <span className="mc-finder-size">{entry.size ?? ""}</span>
            </button>
          ))}
        </div>
      </main>
    </WindowChrome>
  );
}

export function SystemSymbol({ className, name, size }: {
  readonly className?: string;
  readonly name: string;
  readonly size?: number;
}) {
  return (
    <svg className={className} data-system-symbol={name} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
