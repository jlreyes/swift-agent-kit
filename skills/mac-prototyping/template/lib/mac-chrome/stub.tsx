// PLACEHOLDER components — replaced wholesale when the real packages/mac-chrome
// is vendored over this directory. Server-safe (no hooks, no handlers) so they
// render in RSC builds and in jsdom tests alike. Prop names and rendered class
// names mirror the real package so pages written against the stub keep working
// after vendoring.
import type { CSSProperties, ReactNode } from "react";

export interface DesktopShellProps {
  readonly appName: string;
  readonly menuItems?: readonly string[];
  readonly date?: string;
  readonly clock?: string;
  /** CSS image value (url(...), gradient, var(...)) or a bare image URL. */
  readonly wallpaper?: string;
  readonly children: ReactNode;
}

export function DesktopShell({
  appName,
  menuItems = ["File", "Edit", "View", "Window", "Help"],
  date = "Wed Aug 6",
  clock = "9:47 AM",
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
            {menuItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="menu-right" aria-label="Mac status items">
            <span>{date}</span>
            <span>{clock}</span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function TrafficLights() {
  return (
    <div className="traffic-lights" aria-label="Window controls">
      <span className="traffic-close" />
      <span className="traffic-minimize" />
      <span className="traffic-zoom" />
    </div>
  );
}

export function WindowChrome({
  children,
  className = "",
  label,
  style,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly style?: CSSProperties;
}) {
  return (
    <section className={`mac-window ${className}`.trim()} aria-label={label} style={style}>
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
    <header className={`mc-toolbar ${className}`.trim()}>
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
