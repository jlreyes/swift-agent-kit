"use client";

// PLACEHOLDER components — replaced wholesale when the real packages/mac-chrome
// is vendored over this directory. The stub keeps only enough client behavior
// for template routes and jsdom interaction tests. Prop names, rendered class
// names, and default window geometry mirror the real package so pages written
// against the stub keep working after vendoring. Full drag, focus, overlay,
// and keyboard behavior exists only in the real package.
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEventHandler, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type RefObject } from "react";
import { getSymbol, type SymbolName } from "symbolist";

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

export type MacPopoverLayout = "content" | "status";
export type MacPopoverContentInset = "regular" | "compact" | "flush";

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
          <button key={item.id} type="button" role={item.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked={item.checked} disabled={item.disabled} onClick={item.onSelect}>
            <span aria-hidden="true">{item.icon ?? (item.checked ? <SystemSymbol name="checkmark" /> : null)}</span>
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

export function MacPopover({ children, className = "", contentInset = "regular", isOpen, label, layout = "content", onOpenChange, trigger, triggerClassName = "", triggerRef }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentInset?: MacPopoverContentInset;
  readonly isOpen?: boolean;
  readonly label: string;
  readonly layout?: MacPopoverLayout;
  readonly offset?: number;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placement?: "bottom start" | "bottom end";
  readonly trigger: ReactNode;
  readonly triggerClassName?: string;
  readonly triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isOpen ?? uncontrolledOpen;
  function setOpen(nextOpen: boolean) {
    if (isOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }
  return (
    <span className="mc-popover-stub">
      <button ref={triggerRef} type="button" className={`mc-popover-trigger ${triggerClassName}`.trim()} aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>{trigger}</button>
      {open ? <aside className={`mc-popover-surface ${className}`.trim()} data-popover-layout={layout} aria-label={label}><div className="mc-popover-dialog" data-content-inset={contentInset}>{children}</div></aside> : null}
    </span>
  );
}

/* ----- Window frame (mirrors window.tsx) ----- */

export type WindowFrame = {
  readonly top?: number | string;
  readonly left?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
};

export type WindowSize = { readonly width: number; readonly height: number };

const stubResizeEdges = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

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
              <span className="apple-mark"><SystemSymbol name="apple.logo" /></span>
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
            <span className="mc-status-symbol" data-status-icon="battery" aria-label="Battery" role="img"><SystemSymbol name="battery.100percent" /></span>
            <span className="mc-status-symbol" data-status-icon="wifi" aria-label="Wi-Fi" role="img"><SystemSymbol name="wifi" /></span>
            <span className="mc-status-symbol" data-status-icon="control-center" aria-label="Control Center" role="img"><SystemSymbol name="switch.2" /></span>
            <span>{date}</span>
            <span>{clock}</span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

/* ----- Managed apps and windows (mirrors app.tsx) ----- */

export type MacWindowState = "open" | "minimized" | "closed";
export type MacAppPresentation = "windowed" | "menuBar";
export interface MacWindowThumbnail {
  readonly src?: string;
  readonly width: number;
  readonly height: number;
}

export interface MacManagedApp {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup: "apps" | "places";
  readonly presentation: MacAppPresentation;
  readonly running: boolean;
  readonly windowIds: readonly string[];
}

export interface MacManagedWindow {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly state: MacWindowState;
  readonly zoomed: boolean;
  readonly isKeyWindow: boolean;
  readonly zIndex: number;
  readonly thumbnail?: MacWindowThumbnail;
}

export interface MacWindowManagerValue {
  readonly apps: readonly MacManagedApp[];
  readonly windows: readonly MacManagedWindow[];
  readonly keyWindowId: string | null;
  readonly keyAppId: string | null;
  readonly activateApp: (appId: string) => void;
  readonly activateWindow: (windowId: string) => void;
  readonly openWindow: (windowId: string) => void;
  readonly closeWindow: (windowId: string) => void;
  readonly minimizeWindow: (windowId: string) => void;
  readonly restoreWindow: (windowId: string) => void;
  readonly toggleZoom: (windowId: string) => void;
  readonly bringAllToFront: (appId?: string) => void;
  readonly quitApp: (appId: string) => void;
}

type StubAppRecord = Omit<MacManagedApp, "windowIds"> & { readonly order: number };
type StubWindowRecord = Omit<MacManagedWindow, "isKeyWindow" | "zIndex"> & { readonly order: number };
type StubManagerState = {
  readonly apps: readonly StubAppRecord[];
  readonly windows: readonly StubWindowRecord[];
  readonly nextOrder: number;
};
type StubManagerContextValue = MacWindowManagerValue & {
  readonly registerApp: (app: Omit<StubAppRecord, "order" | "running"> & { readonly defaultRunning: boolean }) => void;
  readonly unregisterApp: (appId: string) => void;
  readonly registerWindow: (window: Pick<StubWindowRecord, "id" | "appId" | "label"> & { readonly defaultOpen: boolean }) => void;
  readonly unregisterWindow: (windowId: string) => void;
  readonly consumeKeyboardWindowFocusIntent: () => boolean;
};
type StubAppContextValue = { readonly id: string; readonly defaultRunning: boolean };

const StubManagerContext = createContext<StubManagerContextValue | null>(null);
const StubAppContext = createContext<StubAppContextValue | null>(null);

export function MacWindowManager({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<StubManagerState>({ apps: [], windows: [], nextOrder: 1 });
  const interactionModalityRef = useRef<"keyboard" | "pointer" | null>(null);
  useEffect(() => {
    function recordKeyboardInteraction() { interactionModalityRef.current = "keyboard"; }
    function recordPointerInteraction() { interactionModalityRef.current = "pointer"; }
    document.addEventListener("keydown", recordKeyboardInteraction, true);
    document.addEventListener("pointerdown", recordPointerInteraction, true);
    return () => {
      document.removeEventListener("keydown", recordKeyboardInteraction, true);
      document.removeEventListener("pointerdown", recordPointerInteraction, true);
    };
  }, []);
  const consumeKeyboardWindowFocusIntent = useCallback(() => {
    if (interactionModalityRef.current !== "keyboard") return false;
    interactionModalityRef.current = null;
    return true;
  }, []);
  const registerApp = useCallback((app: Omit<StubAppRecord, "order" | "running"> & { readonly defaultRunning: boolean }) => {
    setState((current) => current.apps.some((candidate) => candidate.id === app.id) ? current : {
      ...current,
      apps: [...current.apps, { id: app.id, name: app.name, icon: app.icon, dockGroup: app.dockGroup, presentation: app.presentation, running: app.defaultRunning, order: current.nextOrder }],
      nextOrder: current.nextOrder + 1,
    });
  }, []);
  const unregisterApp = useCallback((appId: string) => setState((current) => ({ ...current, apps: current.apps.filter((app) => app.id !== appId), windows: current.windows.filter((window) => window.appId !== appId) })), []);
  const registerWindow = useCallback((window: Pick<StubWindowRecord, "id" | "appId" | "label"> & { readonly defaultOpen: boolean }) => {
    setState((current) => current.windows.some((candidate) => candidate.id === window.id) ? current : {
      ...current,
      windows: [...current.windows, { id: window.id, appId: window.appId, label: window.label, state: window.defaultOpen ? "open" : "closed", zoomed: false, order: window.defaultOpen ? current.nextOrder : 0 }],
      nextOrder: window.defaultOpen ? current.nextOrder + 1 : current.nextOrder,
    });
  }, []);
  const unregisterWindow = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.filter((window) => window.id !== windowId) })), []);
  const activateWindow = useCallback((windowId: string) => setState((current) => {
    const target = current.windows.find((window) => window.id === windowId);
    if (target === undefined) return current;
    return {
      ...current,
      apps: current.apps.map((app) => app.id === target.appId ? { ...app, running: true } : app),
      windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "open", order: current.nextOrder, thumbnail: undefined } : window),
      nextOrder: current.nextOrder + 1,
    };
  }), []);
  const activateApp = useCallback((appId: string) => setState((current) => {
    const appWindows = current.windows.filter((window) => window.appId === appId).slice().sort((left, right) => right.order - left.order);
    const target = appWindows.find((window) => window.state !== "closed") ?? appWindows[0];
    return {
      ...current,
      apps: current.apps.map((app) => app.id === appId ? { ...app, running: true } : app),
      windows: target === undefined ? current.windows : current.windows.map((window) => window.id === target.id ? { ...window, state: "open", order: current.nextOrder, thumbnail: undefined } : window),
      nextOrder: target === undefined ? current.nextOrder : current.nextOrder + 1,
    };
  }), []);
  const closeWindow = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "closed", thumbnail: undefined } : window) })), []);
  const minimizeWindow = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "minimized", thumbnail: { width: 720, height: 480 } } : window) })), []);
  const toggleZoom = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, zoomed: !window.zoomed } : window) })), []);
  const bringAllToFront = useCallback((appId?: string) => setState((current) => {
    let nextOrder = current.nextOrder;
    const windows = current.windows.map((window) => window.state === "open" && (appId === undefined || window.appId === appId) ? { ...window, order: nextOrder++ } : window);
    return { ...current, windows, nextOrder };
  }), []);
  const quitApp = useCallback((appId: string) => setState((current) => ({
    ...current,
    apps: current.apps.map((app) => app.id === appId ? { ...app, running: false } : app),
    windows: current.windows.map((window) => window.appId === appId ? { ...window, state: "closed" } : window),
  })), []);
  const visible = state.windows.filter((window) => window.state === "open" && state.apps.find((app) => app.id === window.appId)?.running).slice().sort((left, right) => left.order - right.order);
  const keyWindow = visible.at(-1);
  const windows: readonly MacManagedWindow[] = state.windows.map((window) => ({ ...window, isKeyWindow: window.id === keyWindow?.id, zIndex: 10 + visible.findIndex((candidate) => candidate.id === window.id) }));
  const apps: readonly MacManagedApp[] = state.apps.map((app) => ({ ...app, windowIds: state.windows.filter((window) => window.appId === app.id).map((window) => window.id) }));
  const value = useMemo<StubManagerContextValue>(() => ({
    apps,
    windows,
    keyWindowId: keyWindow?.id ?? null,
    keyAppId: keyWindow?.appId ?? null,
    activateApp,
    activateWindow,
    openWindow: activateWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow: activateWindow,
    toggleZoom,
    bringAllToFront,
    quitApp,
    registerApp,
    unregisterApp,
    registerWindow,
    unregisterWindow,
    consumeKeyboardWindowFocusIntent,
  }), [activateApp, activateWindow, apps, bringAllToFront, closeWindow, consumeKeyboardWindowFocusIntent, keyWindow?.appId, keyWindow?.id, minimizeWindow, quitApp, registerApp, registerWindow, toggleZoom, unregisterApp, unregisterWindow, windows]);
  return <StubManagerContext.Provider value={value}>{children}</StubManagerContext.Provider>;
}

export function useMacWindowManager() {
  const manager = useContext(StubManagerContext);
  if (manager === null) throw new Error("useMacWindowManager must be used inside MacWindowManager");
  return manager;
}

export function MacApp({ children, defaultRunning = true, dockGroup = "apps", icon, id, name, presentation = "windowed" }: {
  readonly children: ReactNode;
  readonly defaultRunning?: boolean;
  readonly dockGroup?: "apps" | "places";
  readonly icon: DockIconSource;
  readonly id: string;
  readonly name: string;
  readonly presentation?: MacAppPresentation;
}) {
  const manager = useMacWindowManager();
  const initial = useRef({ id, name, icon, dockGroup, defaultRunning, presentation });
  useEffect(() => {
    manager.registerApp(initial.current);
    return () => manager.unregisterApp(initial.current.id);
  }, [manager.registerApp, manager.unregisterApp]);
  const value = useMemo<StubAppContextValue>(() => ({ id, defaultRunning }), [defaultRunning, id]);
  return <StubAppContext.Provider value={value}>{children}</StubAppContext.Provider>;
}

type StubWindowControls = { readonly close: () => void; readonly minimize: () => void; readonly zoom: () => void };
const StubWindowControlsContext = createContext<StubWindowControls | null>(null);

export function TrafficLights({ disabled = false, onClose, onMinimize, onZoom }: {
  readonly disabled?: boolean;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
} = {}) {
  const controls = useContext(StubWindowControlsContext);
  function control(kind: "close" | "minimize" | "zoom", label: string, action: (() => void) | undefined) {
    return disabled || action === undefined
      ? <span className={`traffic-${kind}`} />
      : <button type="button" className={`traffic-${kind}`} aria-label={label} onClick={action} />;
  }
  return <div className={`traffic-lights${disabled ? " mc-disabled" : ""}`} aria-label="Window controls">{control("close", "Close window", onClose ?? controls?.close)}{control("minimize", "Minimize window", onMinimize ?? controls?.minimize)}{control("zoom", "Zoom window", onZoom ?? controls?.zoom)}</div>;
}

export function WindowChrome({
  children,
  className = "",
  defaultOpen = true,
  defaultSize = genericDefaultSize,
  frame,
  label,
  minSize: _minSize,
  resizable = true,
  style,
  windowId,
  onClose,
  onMinimize,
  onZoom,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly defaultOpen?: boolean;
  readonly defaultSize?: WindowSize;
  readonly draggable?: boolean;
  readonly dragHandleSelector?: string;
  /** Placement/size override; unset sides default to the centered placement. */
  readonly frame?: WindowFrame;
  readonly label: string;
  readonly minSize?: WindowSize;
  readonly resizable?: boolean;
  readonly style?: CSSProperties;
  readonly windowId?: string;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const manager = useContext(StubManagerContext);
  const app = useContext(StubAppContext);
  const resolvedWindowId = manager !== null && app !== null ? windowId ?? `${app.id}:main` : null;
  useEffect(() => {
    if (manager === null || app === null || resolvedWindowId === null) return;
    manager.registerWindow({ id: resolvedWindowId, appId: app.id, label, defaultOpen });
    return () => manager.unregisterWindow(resolvedWindowId);
  }, [app, defaultOpen, label, manager?.registerWindow, manager?.unregisterWindow, resolvedWindowId]);
  const managedWindow = resolvedWindowId === null ? undefined : manager?.windows.find((window) => window.id === resolvedWindowId);
  const appRunning = app === null ? true : manager?.apps.find((candidate) => candidate.id === app.id)?.running ?? app.defaultRunning;
  const visible = manager === null || resolvedWindowId === null || (appRunning && (managedWindow?.state === "open" || managedWindow === undefined && defaultOpen));
  const controls: StubWindowControls = {
    close: () => { onClose?.(); if (resolvedWindowId !== null) manager?.closeWindow(resolvedWindowId); },
    minimize: () => { onMinimize?.(); if (resolvedWindowId !== null) manager?.minimizeWindow(resolvedWindowId); },
    zoom: () => { onZoom?.(); if (resolvedWindowId !== null) manager?.toggleZoom(resolvedWindowId); },
  };
  if (!visible) return null;
  return (
    <StubWindowControlsContext.Provider value={controls}>
      <section
        className={`mac-window ${className}${managedWindow?.zoomed ? " mc-zoomed" : ""}`.trim()}
        aria-label={label}
        data-app-id={app?.id}
        data-key-window={managedWindow === undefined ? undefined : managedWindow.isKeyWindow ? "true" : "false"}
        data-window-id={resolvedWindowId ?? undefined}
        data-window-resizable={resizable ? "true" : "false"}
        data-window-state={managedWindow?.state}
        onPointerDownCapture={() => { if (resolvedWindowId !== null) manager?.activateWindow(resolvedWindowId); }}
        onFocusCapture={() => {
          if (resolvedWindowId !== null && manager?.consumeKeyboardWindowFocusIntent()) manager.activateWindow(resolvedWindowId);
        }}
        style={{ ...framePlacement(frame, defaultSize), ...style, zIndex: managedWindow?.zIndex, viewTransitionName: resolvedWindowId === null ? undefined : `mc-window-${resolvedWindowId.replaceAll(":", "-3a-")}` }}
      >
        {children}
        {resizable ? stubResizeEdges.map((edge) => <span aria-hidden="true" className={`mc-window-resize-handle mc-window-resize-${edge}`} data-window-resize-handle={edge} key={edge} />) : null}
      </section>
    </StubWindowControlsContext.Provider>
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

const stubToolbarSymbols = {
  back: "chevron.left",
  forward: "chevron.right",
  grid: "square.grid.2x2",
  inspector: "sidebar.trailing",
  list: "list.bullet",
  more: "ellipsis",
  search: "magnifyingglass",
} as const satisfies Readonly<Record<ToolbarGlyphName, SystemSymbolName>>;

export function ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName }) {
  return <SystemSymbol className="mc-toolbar-glyph" name={stubToolbarSymbols[name]} />;
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

export type DockIcon =
  | { readonly kind: "asset"; readonly src: string }
  | { readonly kind: "symbol"; readonly symbol: ReactNode; readonly background?: string; readonly foreground?: string };

export type DockIconSource = DockIcon | ReactNode | string;

export interface MacDockAppIconProps {
  readonly icon: DockIconSource;
  readonly label?: string;
}

function stubDockIcon(icon: DockIconSource): DockIcon {
  if (typeof icon === "string") return { kind: "asset", src: icon };
  if (typeof icon === "object" && icon !== null && "kind" in icon) return icon as DockIcon;
  return { kind: "symbol", symbol: icon };
}

export function MacDockAppIcon({ icon, label }: MacDockAppIconProps) {
  const normalized = stubDockIcon(icon);
  return (
    <span className={`p0-app-icon p0-app-icon--${normalized.kind === "asset" ? "asset" : "tile"}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span
        className="p0-app-icon-artwork"
        style={normalized.kind === "symbol" ? { backgroundColor: normalized.background, color: normalized.foreground } : undefined}
      >
        {normalized.kind === "asset" ? <img className="p0-app-icon-image" src={normalized.src} alt="" draggable={false} /> : <span className="p0-app-icon-glyph">{normalized.symbol}</span>}
      </span>
    </span>
  );
}

export interface DockItem {
  readonly id: string;
  readonly label: string;
  readonly icon: DockIconSource;
  readonly windowThumbnail?: MacWindowThumbnail;
  readonly viewTransitionName?: string;
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
              className={`p0-dock-item${item.running ? " is-running" : ""}${item.windowThumbnail ? " is-window-thumbnail" : ""}`}
              type="button"
              aria-label={item.label}
              onClick={item.onActivate}
            >
              {item.windowThumbnail ? (
                <span className="p0-window-thumbnail" style={{ aspectRatio: `${item.windowThumbnail.width} / ${item.windowThumbnail.height}`, viewTransitionName: item.viewTransitionName }}>
                  {item.windowThumbnail.src ? <img src={item.windowThumbnail.src} alt="" draggable={false} /> : <span className="p0-window-thumbnail-fallback"><MacDockAppIcon icon={item.icon} /></span>}
                </span>
              ) : <MacDockAppIcon icon={item.icon} />}
              <span className="p0-dock-running-dot" aria-hidden="true" />
            </button>
          </span>
        );
      })}
    </nav>
  );
}

export function MacAppDock({ extraItems = [], label = "Dock", onAppActivate }: {
  readonly extraItems?: readonly DockItem[];
  readonly label?: string;
  readonly onAppActivate?: (appId: string) => void;
}) {
  const manager = useMacWindowManager();
  const appIds = new Set(manager.apps.map((app) => app.id));
  const unmanagedItems = extraItems.filter((item) => !appIds.has(item.id));
  function appDockItem(app: MacManagedApp): DockItem {
    return {
      id: app.id,
      label: app.name,
      icon: app.icon,
      running: app.running,
      group: app.dockGroup,
      onActivate: () => { manager.activateApp(app.id); onAppActivate?.(app.id); },
    };
  }
  const items: readonly DockItem[] = [
    ...manager.apps.filter((app) => app.presentation === "windowed" && app.dockGroup === "apps").map(appDockItem),
    ...unmanagedItems.filter((item) => item.group === "apps"),
    ...manager.windows.filter((window) => window.state === "minimized").map((window): DockItem => {
      const app = manager.apps.find((candidate) => candidate.id === window.appId);
      return {
        id: `minimized:${window.id}`,
        label: window.label,
        icon: app?.icon ?? "",
        group: "windows",
        windowThumbnail: window.thumbnail ?? { width: 720, height: 480 },
        viewTransitionName: `mc-window-${window.id.replaceAll(":", "-3a-")}`,
        onActivate: () => manager.restoreWindow(window.id),
      };
    }),
    ...manager.apps.filter((app) => app.presentation === "windowed" && app.dockGroup === "places").map(appDockItem),
    ...unmanagedItems.filter((item) => item.group !== "apps"),
  ];
  return <MacDock items={items} label={label} />;
}

export function MenuBarExtra({ badge, children, icon, isOpen, label, onOpenChange, triggerRef }: {
  readonly badge?: number | string;
  readonly children: ReactNode;
  readonly icon: ReactNode | string;
  readonly isOpen?: boolean;
  readonly label: string;
  readonly onOpenChange?: (open: boolean) => void;
  readonly triggerRef?: Ref<HTMLButtonElement>;
}) {
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
            {badge !== undefined && badge !== 0 && badge !== "" ? <span className="mc-menubar-badge" aria-hidden="true">{badge}</span> : null}
          </>
        }
      >
        {children}
      </MacPopover>
    </div>
  );
}

/* ----- Reusable navigation and collection primitives ----- */

export type MacNavigationColumnSizing = {
  readonly minSize?: number | string;
  readonly defaultSize?: number | string;
  readonly maxSize?: number | string;
};

export type MacNavigationSplitViewProps = {
  readonly sidebar: ReactNode;
  readonly content?: ReactNode;
  readonly detail: ReactNode;
  readonly sidebarVisible?: boolean;
  readonly sidebarLabel?: string;
  readonly contentLabel?: string;
  readonly detailLabel?: string;
  readonly sidebarSizing?: MacNavigationColumnSizing;
  readonly contentSizing?: MacNavigationColumnSizing;
  readonly detailSizing?: MacNavigationColumnSizing;
  readonly className?: string;
  readonly id?: string;
};

export function MacNavigationSplitView({
  sidebar,
  content,
  detail,
  sidebarVisible = true,
  sidebarLabel = "Sidebar",
  contentLabel = "Content",
  detailLabel = "Detail",
  className = "",
}: MacNavigationSplitViewProps) {
  return (
    <div className={`mc-navigation-split-view ${className}`.trim()}>
      {sidebarVisible ? <><aside className="mc-navigation-column mc-navigation-sidebar" aria-label={sidebarLabel}>{sidebar}</aside><span className="mc-navigation-separator" /></> : null}
      {content !== undefined ? <><section className="mc-navigation-column mc-navigation-content" aria-label={contentLabel}>{content}</section><span className="mc-navigation-separator" /></> : null}
      <section className="mc-navigation-column mc-navigation-detail" aria-label={detailLabel}>{detail}</section>
    </div>
  );
}

export type MacInspectorProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label?: string;
  readonly visible?: boolean;
  readonly width?: number | string;
  readonly defaultWidth?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly onWidthChange?: (width: number) => void;
};

export function MacInspector({ children, className = "", label = "Inspector", visible = true, width, defaultWidth = 260, minWidth = 220, maxWidth = 360, onWidthChange }: MacInspectorProps) {
  const minimum = Math.min(minWidth, maxWidth);
  const maximum = Math.max(minWidth, maxWidth);
  const clamp = (next: number) => Math.min(Math.max(next, minimum), maximum);
  const [internalWidth, setInternalWidth] = useState(() => clamp(defaultWidth));
  const renderedWidth = width ?? internalWidth;
  const currentWidth = typeof renderedWidth === "number" ? clamp(renderedWidth) : internalWidth;
  const drag = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);
  const inspectorId = `mc-inspector-${useId().replaceAll(":", "")}`;

  function resize(next: number) {
    const resized = clamp(next);
    if (width === undefined) setInternalWidth(resized);
    onWidthChange?.(resized);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    drag.current = { startX: event.clientX, startWidth: currentWidth };
    event.preventDefault();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current === null) return;
    resize(drag.current.startWidth + drag.current.startX - event.clientX);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const next = event.key === "ArrowLeft" ? currentWidth + 10 : event.key === "ArrowRight" ? currentWidth - 10 : event.key === "Home" ? minimum : event.key === "End" ? maximum : undefined;
    if (next === undefined) return;
    event.preventDefault();
    resize(next);
  }

  if (!visible) return null;
  return <><div role="separator" aria-controls={inspectorId} aria-label={`Resize ${label}`} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={currentWidth} className="mc-navigation-separator mc-inspector-separator" tabIndex={0} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} /><aside id={inspectorId} className={`mc-inspector ${className}`.trim()} aria-label={label} style={{ width: cssLength(renderedWidth), minWidth: cssLength(minimum), maxWidth: cssLength(maximum) }}>{children}</aside></>;
}

export type MacSourceListItem = {
  readonly id: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly badge?: ReactNode;
  readonly indent?: boolean;
};

export type MacSourceListSection = {
  readonly id: string;
  readonly title?: string;
  readonly collapsible?: boolean;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly items: readonly MacSourceListItem[];
};

export type MacSourceListProps = {
  readonly sections: readonly MacSourceListSection[];
  readonly label?: string;
  readonly className?: string;
  readonly selectedId: string | null;
  readonly onSelectionChange: (id: string) => void;
  readonly expandedSectionIds?: ReadonlySet<string>;
  readonly onExpandedSectionIdsChange?: (ids: ReadonlySet<string>) => void;
};

export function MacSourceList({ sections, label = "Sidebar", className = "", selectedId, onSelectionChange }: MacSourceListProps) {
  return (
    <nav role="tree" aria-label={label} className={`mc-sidebar-tree ${className}`.trim()}>
      {sections.map((section) => (
        <section key={section.id} className={`mc-sidebar-section ${section.className ?? ""}`.trim()}>
          {section.title !== undefined ? <strong className="mc-sidebar-section-label">{section.title}{section.count !== undefined ? <small>{section.count}</small> : null}</strong> : null}
          {section.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="treeitem"
              aria-selected={selectedId === item.id}
              className={`mc-sidebar-item${selectedId === item.id ? " mc-selected" : ""}${item.indent ? " mc-indent" : ""}`}
              onClick={() => onSelectionChange(item.id)}
            >
              {item.icon !== undefined ? <span className="mc-sidebar-item-icon" aria-hidden="true">{item.icon}</span> : null}
              <span className="mc-sidebar-item-label">{item.label}</span>
              {item.badge !== undefined ? <small className="mc-sidebar-item-badge">{item.badge}</small> : null}
            </button>
          ))}
        </section>
      ))}
    </nav>
  );
}

export type MacListRow = {
  readonly id: string;
  readonly label: ReactNode;
  readonly textValue?: string;
  readonly icon?: ReactNode;
  readonly description?: ReactNode;
  readonly secondary?: ReactNode;
  readonly accessory?: ReactNode;
  readonly disabled?: boolean;
  readonly onAction?: () => void;
};

export type MacListSection = {
  readonly id: string;
  readonly title?: ReactNode;
  readonly items: readonly MacListRow[];
};

export function MacList({ ariaLabel, className = "", emptyState = "No items", selectedId, sections, onSelectionChange }: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly emptyState?: ReactNode;
  readonly selectedId: string | null;
  readonly sections: readonly MacListSection[];
  readonly onSelectionChange: (id: string | null) => void;
}) {
  const rows = sections.flatMap((section) => section.items);
  if (rows.length === 0) return <div className={`mc-list ${className}`.trim()} aria-label={ariaLabel}><div className="mc-list-empty">{emptyState}</div></div>;
  return (
    <div role="listbox" aria-label={ariaLabel} className={`mc-list ${className}`.trim()}>
      {sections.map((section) => (
        <section key={section.id} className="mc-list-section">
          {section.title !== undefined ? <strong className="mc-list-section-title">{section.title}</strong> : null}
          {section.items.map((row) => (
            <button
              key={row.id}
              type="button"
              role="option"
              aria-selected={row.id === selectedId}
              className="mc-list-row"
              disabled={row.disabled}
              onClick={() => { onSelectionChange(row.id); row.onAction?.(); }}
            >
              {row.icon !== undefined ? <span className="mc-list-row-icon" aria-hidden="true">{row.icon}</span> : null}
              <span className="mc-list-row-copy"><span className="mc-list-row-label">{row.label}</span>{row.description !== undefined ? <small>{row.description}</small> : null}</span>
              {row.secondary !== undefined ? <span className="mc-list-row-secondary">{row.secondary}</span> : null}
              {row.accessory !== undefined ? <span className="mc-list-row-accessory">{row.accessory}</span> : null}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function MacDisclosureGroup({ children, className = "", disabled = false, expanded, title, onExpandedChange }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly expanded: boolean;
  readonly title: ReactNode;
  readonly onExpandedChange: (expanded: boolean) => void;
}) {
  return (
    <section className={`mc-disclosure ${className}`.trim()} data-expanded={expanded ? "" : undefined}>
      <h3 className="mc-disclosure-heading"><button type="button" className="mc-disclosure-trigger" disabled={disabled} aria-expanded={expanded} onClick={() => onExpandedChange(!expanded)}><span className="mc-disclosure-chevron" aria-hidden="true" /><span>{title}</span></button></h3>
      {expanded ? <div className="mc-disclosure-panel">{children}</div> : null}
    </section>
  );
}

/* ----- Reusable controls and content states ----- */

export type MacButtonVariant = "regular" | "primary" | "destructive" | "borderless";

export function MacButton({ ariaLabel, children, className = "", disabled = false, ref, type = "button", variant = "regular", onPress }: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
  readonly type?: "button" | "submit" | "reset";
  readonly variant?: MacButtonVariant;
  readonly onPress?: () => void;
}) {
  return <button ref={ref} type={type} aria-label={ariaLabel} className={`mc-button mc-button-${variant} ${className}`.trim()} disabled={disabled} onClick={onPress}>{children}</button>;
}

export function MacTextField({ ariaLabel, autoComplete, className = "", description, disabled = false, errorMessage, invalid = false, label, name, placeholder, readOnly = false, type = "text", value, onChange }: {
  readonly ariaLabel?: string;
  readonly autoComplete?: string;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly errorMessage?: ReactNode;
  readonly invalid?: boolean;
  readonly label?: ReactNode;
  readonly name?: string;
  readonly placeholder?: string;
  readonly readOnly?: boolean;
  readonly type?: "email" | "password" | "search" | "text" | "url";
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className={`mc-text-field ${className}`.trim()}>
      {label !== undefined ? <span className="mc-field-label">{label}</span> : null}
      <input className="mc-field-input" aria-label={label === undefined ? ariaLabel : undefined} autoComplete={autoComplete} disabled={disabled} aria-invalid={invalid} name={name} placeholder={placeholder} readOnly={readOnly} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {description !== undefined ? <small className="mc-field-description">{description}</small> : null}
      {errorMessage !== undefined ? <small className="mc-field-error">{errorMessage}</small> : null}
    </label>
  );
}

export type MacToggleStyle = "checkbox" | "switch";

export function MacToggle({ children, className = "", disabled = false, selected, style = "checkbox", onChange }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly selected: boolean;
  readonly style?: MacToggleStyle;
  readonly onChange: (selected: boolean) => void;
}) {
  return <label className={`mc-toggle mc-toggle-${style} ${className}`.trim()}><input type="checkbox" role={style === "switch" ? "switch" : undefined} disabled={disabled} checked={selected} onChange={(event) => onChange(event.target.checked)} /><span className={style === "switch" ? "mc-switch-track" : "mc-checkbox-box"} aria-hidden="true" />{children}</label>;
}

export type MacSegment = { readonly id: string; readonly label: ReactNode; readonly icon?: ReactNode; readonly disabled?: boolean };

export function MacSegmentedControl({ ariaLabel, className = "", disabled = false, options, value, onChange }: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly options: readonly MacSegment[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return <div className={`mc-segmented-control ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>{options.map((option) => <button key={option.id} type="button" role="radio" aria-checked={value === option.id} className="mc-segmented-option" disabled={disabled || option.disabled} data-selected={value === option.id ? "" : undefined} onClick={() => onChange(option.id)}>{option.icon}<span>{option.label}</span></button>)}</div>;
}

export function MacControlGroup({ ariaLabel, children, className = "" }: { readonly ariaLabel: string; readonly children: ReactNode; readonly className?: string }) {
  return <div className={`mc-control-group ${className}`.trim()} role="group" aria-label={ariaLabel}>{children}</div>;
}

export function MacForm({ ariaLabel, children, className = "", onSubmit }: { readonly ariaLabel?: string; readonly children: ReactNode; readonly className?: string; readonly onSubmit?: FormEventHandler<HTMLFormElement> }) {
  return <form className={`mc-form ${className}`.trim()} aria-label={ariaLabel} onSubmit={onSubmit}>{children}</form>;
}

export function MacFormSection({ children, className = "", description, disabled = false, title }: { readonly children: ReactNode; readonly className?: string; readonly description?: ReactNode; readonly disabled?: boolean; readonly title?: ReactNode }) {
  return <fieldset className={`mc-form-section ${className}`.trim()} disabled={disabled}>{title !== undefined ? <legend>{title}</legend> : null}{description !== undefined ? <p className="mc-form-section-description">{description}</p> : null}<div className="mc-form-section-content">{children}</div></fieldset>;
}

export function MacLabeledContent({ children, className = "", description, label }: { readonly children: ReactNode; readonly className?: string; readonly description?: ReactNode; readonly label: ReactNode }) {
  return <div className={`mc-labeled-content ${className}`.trim()}><div className="mc-labeled-content-label"><span>{label}</span>{description !== undefined ? <small>{description}</small> : null}</div><div className="mc-labeled-content-value">{children}</div></div>;
}

export function MacContentUnavailable({ actions, className = "", description, icon, title }: { readonly actions?: ReactNode; readonly className?: string; readonly description?: ReactNode; readonly icon?: ReactNode; readonly title: ReactNode }) {
  return <section className={`mc-content-unavailable ${className}`.trim()}>{icon !== undefined ? <span className="mc-content-unavailable-icon" aria-hidden="true">{icon}</span> : null}<h2>{title}</h2>{description !== undefined ? <p>{description}</p> : null}{actions !== undefined ? <div className="mc-content-unavailable-actions">{actions}</div> : null}</section>;
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
export function FinderWindow({ sidebar, sidebarHeader, sidebarVisible, onSidebarVisibleChange, entries, mode, onModeChange, search, selection, onOpen, preview, previewVisible, onPreviewVisibleChange, statusBar, toolbarExtras, title, label, frame, onClose }: {
  readonly sidebar: readonly SidebarSection[];
  readonly sidebarHeader?: ReactNode;
  readonly sidebarVisible?: boolean;
  readonly onSidebarVisibleChange?: (visible: boolean) => void;
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
  const [uncontrolledSidebarVisible, setUncontrolledSidebarVisible] = useState(true);
  const isSidebarVisible = sidebarVisible ?? uncontrolledSidebarVisible;
  function setSidebarVisibility(visible: boolean) {
    if (sidebarVisible === undefined) setUncontrolledSidebarVisible(visible);
    onSidebarVisibleChange?.(visible);
  }
  return (
    <WindowChrome className="mc-finder-window" label={label ?? title ?? "Finder"} frame={frame} defaultSize={finderDefaultSize} onClose={onClose}>
      {isSidebarVisible ? <aside className="mc-finder-sidebar">
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
      </aside> : null}
      <main className="mc-finder-main">
        <MacToolbar
          leading={
            <>
              {!isSidebarVisible ? <TrafficLights /> : null}
              <ToolbarButton label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"} pressed={isSidebarVisible} onClick={() => setSidebarVisibility(!isSidebarVisible)}><SystemSymbol name="sidebar.left" /></ToolbarButton>
            </>
          }
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
        {statusBar !== undefined ? <MacWindowStatusBar className="mc-finder-status">{statusBar}</MacWindowStatusBar> : null}
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

export type SystemSymbolName = SymbolName;

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
  return <div className="mc-window-modal-layer mc-window-modal-layer-sheet mc-window-modal-layer-window" data-modal-kind="sheet" data-modal-scope="window"><div className="mc-window-modal-scrim" role="presentation" /><section className="mc-sheet mc-sheet-legacy" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>;
}

export type MacDialogActionRole = "cancel" | "destructive";
export type MacAlertPresentationScope = "automatic" | "desktop";
export type MacDialogAction = {
  readonly id: string;
  readonly label: string;
  readonly role?: MacDialogActionRole;
  readonly isDefault?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
};

export type MacAlertActionRole = MacDialogActionRole | "default";
export type MacAlertAction = Omit<MacDialogAction, "role"> & { readonly role?: MacAlertActionRole };

type StubDialogAction = MacDialogAction | MacAlertAction;

function stubActionIsDefault(action: StubDialogAction) {
  return action.isDefault === true || action.role === "default";
}

function StubDialogActions({ actions, onClose }: { readonly actions: readonly StubDialogAction[]; readonly onClose: () => void }) {
  const ordered = actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => {
      const priority = (action: StubDialogAction) => stubActionIsDefault(action) ? 2 : action.role === "cancel" ? 1 : 0;
      return priority(left.action) - priority(right.action) || left.index - right.index;
    })
    .map(({ action }) => action);
  return (
    <div className="mc-dialog-actions">
      {ordered.map((action) => {
        const isDefault = stubActionIsDefault(action);
        const isDestructive = action.role === "destructive";
        return (
          <MacButton
            key={action.id}
            className={`mc-dialog-action${isDefault ? " mc-dialog-action-default" : ""}${isDestructive ? " mc-dialog-action-destructive" : ""}${action.role === "cancel" ? " mc-dialog-action-cancel" : ""}`}
            variant={isDefault ? "primary" : isDestructive ? "destructive" : "regular"}
            disabled={action.disabled}
            onPress={() => {
              if (action.disabled === true) return;
              action.onPress?.();
              onClose();
            }}
          >
            {action.label}
          </MacButton>
        );
      })}
    </div>
  );
}

export function MacSheet({ actions, children, fallbackFocusRef, initialFocusSelector: _initialFocusSelector, onClose, open, title }: {
  readonly actions: readonly MacDialogAction[];
  readonly children: ReactNode;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  function closeSheet() {
    onClose();
    window.requestAnimationFrame(() => fallbackFocusRef?.current?.focus());
  }
  if (!open) return <span className="mc-window-modal-anchor" aria-hidden="true" />;
  return (
    <>
      <span className="mc-window-modal-anchor" aria-hidden="true" />
      <div className="mc-window-modal-layer mc-window-modal-layer-sheet mc-window-modal-layer-window" data-modal-kind="sheet" data-modal-scope="window">
        <div className="mc-window-modal-scrim" role="presentation" />
        <section className="mc-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
          <header className="mc-sheet-header"><h2 id={titleId}>{title}</h2></header>
          <div className="mc-sheet-body" id={bodyId}>{children}</div>
          <footer className="mc-sheet-footer"><StubDialogActions actions={actions} onClose={closeSheet} /></footer>
        </section>
      </div>
    </>
  );
}

export function MacWindowStatusBar({ children, className = "", live, trailing }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly live?: "polite" | "assertive";
  readonly trailing?: ReactNode;
}) {
  return <footer className={`mc-window-status-bar ${className}`} role={live === undefined ? undefined : "status"} aria-live={live}><span className="mc-window-status-primary">{children}</span>{trailing === undefined ? null : <span className="mc-window-status-trailing">{trailing}</span>}</footer>;
}

export function MacAlert({ actions, applicationName, fallbackFocusRef, icon, message, onClose, open, presentationScope = "automatic", title }: {
  readonly actions: readonly (MacDialogAction | MacAlertAction)[];
  readonly applicationName?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly icon?: ReactNode;
  readonly message: ReactNode;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly presentationScope?: MacAlertPresentationScope;
  readonly title: string;
}) {
  const titleId = useId();
  const messageId = useId();
  function closeAlert() {
    onClose();
    window.requestAnimationFrame(() => fallbackFocusRef?.current?.focus());
  }
  if (!open) return <span className="mc-window-modal-anchor" aria-hidden="true" />;
  const scope = presentationScope === "desktop" ? "desktop" : "window";
  return (
    <>
      <span className="mc-window-modal-anchor" aria-hidden="true" />
      <div className={`mc-window-modal-layer mc-window-modal-layer-alert mc-window-modal-layer-${scope}`} data-modal-kind="alert" data-modal-scope={scope}>
        <div className="mc-window-modal-scrim" role="presentation" />
        <section className={`mc-alert${icon === undefined ? " mc-alert-no-icon" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        {icon === undefined ? null : <div className="mc-alert-icon" aria-hidden="true">{icon}</div>}
          <div className="mc-alert-copy">{applicationName === undefined ? null : <div className="mc-alert-application">{applicationName}</div>}<h2 id={titleId}>{title}</h2><div className="mc-alert-message" id={messageId}>{message}</div></div>
          <footer className="mc-alert-footer"><StubDialogActions actions={actions} onClose={closeAlert} /></footer>
        </section>
      </div>
    </>
  );
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

export function ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", sidebarVisible, onSidebarVisibleChange, toolbarExtras, emptyTranscript, label, frame, onClose }: {
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly composer: ChatComposer;
  readonly search?: ChatSearch;
  readonly sidebarLabel?: string;
  readonly sidebarVisible?: boolean;
  readonly onSidebarVisibleChange?: (visible: boolean) => void;
  readonly toolbarExtras?: ReactNode;
  readonly emptyTranscript?: ReactNode;
  readonly label?: string;
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const [uncontrolledSidebarVisible, setUncontrolledSidebarVisible] = useState(true);
  const isSidebarVisible = sidebarVisible ?? uncontrolledSidebarVisible;
  function setSidebarVisibility(visible: boolean) {
    if (sidebarVisible === undefined) setUncontrolledSidebarVisible(visible);
    onSidebarVisibleChange?.(visible);
  }
  const active = conversations.find((conversation) => conversation.id === activeConversationId);
  return (
    <WindowChrome className="mc-chat-window" label={label ?? active?.title ?? "Chat"} frame={frame} onClose={onClose}>
      {isSidebarVisible ? <aside className="mc-chat-sidebar" aria-label={sidebarLabel}><div className="mc-chat-sidebar-top"><TrafficLights /></div><nav>{conversations.map((conversation) => <button type="button" key={conversation.id} aria-current={conversation.id === activeConversationId ? "true" : undefined} onClick={() => onSelectConversation(conversation.id)}>{conversation.icon}<strong>{conversation.title}</strong></button>)}</nav></aside> : null}
      <section className="mc-chat-main">
        <MacToolbar leading={<>{!isSidebarVisible ? <TrafficLights /> : null}<ToolbarButton label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"} pressed={isSidebarVisible} onClick={() => setSidebarVisibility(!isSidebarVisible)}><SystemSymbol name="sidebar.left" /></ToolbarButton></>} title={active?.title} trailing={<>{search !== undefined ? <ToolbarSearchBubble value={search.value} onChange={search.onChange} label="Search conversation" /> : null}{toolbarExtras}</>} />
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

export function SystemSymbol({ className = "", name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const glyph = glyphRef.current;
    if (frame === null || glyph === null) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      glyph.style.removeProperty("--mc-symbol-fit-scale");
      glyph.style.removeProperty("--mc-symbol-fit-x");
      glyph.style.removeProperty("--mc-symbol-fit-y");
      const frameBounds = frame.getBoundingClientRect();
      if (frameBounds.width <= 0 || frameBounds.height <= 0) return;
      const range = document.createRange();
      range.selectNodeContents(glyph);
      if (typeof range.getBoundingClientRect !== "function") return;
      const contentBounds = range.getBoundingClientRect();
      if (contentBounds.width <= 0 || contentBounds.height <= 0) return;
      const glyphBounds = glyph.getBoundingClientRect();
      const scale = Math.min(1, frameBounds.width / contentBounds.width, frameBounds.height / contentBounds.height);
      const targetLeft = frameBounds.left + (frameBounds.width - contentBounds.width * scale) / 2;
      const targetTop = frameBounds.top + (frameBounds.height - contentBounds.height * scale) / 2;
      glyph.style.setProperty("--mc-symbol-fit-scale", `${scale}`);
      glyph.style.setProperty("--mc-symbol-fit-x", `${targetLeft - glyphBounds.left - (contentBounds.left - glyphBounds.left) * scale}px`);
      glyph.style.setProperty("--mc-symbol-fit-y", `${targetTop - glyphBounds.top - (contentBounds.top - glyphBounds.top) * scale}px`);
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(frame);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [name, size]);
  return (
    <span ref={frameRef} aria-hidden="true" className={`mc-system-symbol ${className}`.trim()} data-system-symbol={name} style={size === undefined ? undefined : { fontSize: `${size}px` }}>
      <span className="mc-system-symbol-glyph" ref={glyphRef}>{getSymbol(name) ?? ""}</span>
    </span>
  );
}
