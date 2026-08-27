"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { useOptionalMacWindowManager, type MacWindowManagerValue } from "./app.tsx";
import { MacMenu, type MenuSpec } from "./menu";
import { SystemSymbol } from "./system-symbol";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/popover.css";

const defaultMenuItems = ["File", "Edit", "View", "Window", "Help"] as const;

const unavailableMenu: MenuSpec = [
  { kind: "action", id: "unavailable", label: "No Commands Available", disabled: true },
];

const standardMenus: Readonly<Record<string, MenuSpec>> = {
  File: [
    { kind: "action", id: "new-window", label: "New Window", shortcut: "⌘N" },
    { kind: "action", id: "open", label: "Open…", shortcut: "⌘O" },
    { kind: "separator", id: "file-separator-1" },
    { kind: "action", id: "close-window", label: "Close Window", shortcut: "⌘W" },
    { kind: "action", id: "save", label: "Save", shortcut: "⌘S" },
    { kind: "separator", id: "file-separator-2" },
    { kind: "action", id: "get-info", label: "Get Info", shortcut: "⌘I" },
  ],
  Edit: [
    { kind: "action", id: "undo", label: "Undo", shortcut: "⌘Z" },
    { kind: "action", id: "redo", label: "Redo", shortcut: "⇧⌘Z" },
    { kind: "separator", id: "edit-separator-1" },
    { kind: "action", id: "cut", label: "Cut", shortcut: "⌘X" },
    { kind: "action", id: "copy", label: "Copy", shortcut: "⌘C" },
    { kind: "action", id: "paste", label: "Paste", shortcut: "⌘V" },
    { kind: "action", id: "select-all", label: "Select All", shortcut: "⌘A" },
  ],
  View: [
    { kind: "action", id: "show-sidebar", label: "Show Sidebar", shortcut: "⌃⌘S" },
    { kind: "separator", id: "view-separator-1" },
    { kind: "action", id: "enter-full-screen", label: "Enter Full Screen", shortcut: "⌃⌘F" },
  ],
  Window: [
    { kind: "action", id: "minimize", label: "Minimize", shortcut: "⌘M" },
    { kind: "action", id: "zoom", label: "Zoom" },
    { kind: "separator", id: "window-separator-1" },
    { kind: "action", id: "bring-all-to-front", label: "Bring All to Front" },
  ],
  Help: [
    { kind: "action", id: "app-help", label: "App Help", shortcut: "⌘?" },
    { kind: "separator", id: "help-separator-1" },
    { kind: "action", id: "search-help", label: "Search" },
  ],
};

/* Accepts a full CSS <image> value or a bare URL for the wallpaper prop. */
const cssImagePattern = /^(url\(|linear-gradient\(|radial-gradient\(|conic-gradient\(|image-set\(|var\()/;

type DesktopCanvasStyle = CSSProperties & { readonly "--mc-wallpaper"?: string };

/** A menu-bar title backed by a real dropdown (MacMenu machinery). */
export type MenuBarMenu = {
  readonly title: string;
  readonly items: MenuSpec;
};

export type MenuCommand = {
  readonly menu: string;
  readonly id: string;
  readonly label: string;
};

export interface DesktopShellProps {
  readonly appName: string;
  /** Plain standard titles get native defaults; objects supply product commands. */
  readonly menuItems?: readonly (string | MenuBarMenu)[];
  /** Overrides the system-shaped Apple menu. */
  readonly appleMenuItems?: MenuSpec;
  /** Overrides the application menu under `appName`. */
  readonly appMenuItems?: MenuSpec;
  /** Command target for built-in or otherwise handler-less menu actions. */
  readonly onMenuAction?: (command: MenuCommand) => void;
  readonly date?: string;
  readonly clock?: string;
  /** MenuBarExtra elements rendered in flow beside the status items (no overlap). */
  readonly menuBarExtras?: ReactNode;
  /** CSS image value (url(...), gradient, var(...)) or a bare image URL. */
  readonly wallpaper?: string;
  readonly children: ReactNode;
}

function AppleMark() {
  return <SystemSymbol name="apple.logo" />;
}

function StatusSymbol({ label, name, status }: {
  readonly label: string;
  readonly name: "battery.100percent" | "switch.2" | "wifi";
  readonly status: "battery" | "control-center" | "wifi";
}) {
  return (
    <span className="mc-status-symbol" data-status-icon={status} aria-label={label} role="img">
      <SystemSymbol name={name} />
    </span>
  );
}

function defaultAppleMenu(): MenuSpec {
  return [
    {
      kind: "action",
      id: "about-this-mac",
      label: "About This Mac",
      icon: <SystemSymbol name="laptopcomputer" />,
    },
    { kind: "separator", id: "apple-separator-1" },
    {
      kind: "action",
      id: "system-settings",
      label: "System Settings…",
      icon: <SystemSymbol name="gear" />,
    },
    {
      kind: "action",
      id: "app-store",
      label: "App Store…",
      icon: <SystemSymbol name="app" />,
    },
    { kind: "separator", id: "apple-separator-2" },
    { kind: "action", id: "force-quit", label: "Force Quit…", shortcut: "⌥⌘Esc" },
    { kind: "separator", id: "apple-separator-3" },
    { kind: "action", id: "sleep", label: "Sleep" },
    { kind: "action", id: "restart", label: "Restart…" },
    { kind: "action", id: "shut-down", label: "Shut Down…" },
    { kind: "separator", id: "apple-separator-4" },
    { kind: "action", id: "lock-screen", label: "Lock Screen", shortcut: "⌃⌘Q" },
    { kind: "action", id: "log-out", label: "Log Out…", shortcut: "⇧⌘Q" },
  ];
}

function defaultAppMenu(appName: string): MenuSpec {
  return [
    { kind: "action", id: "about-app", label: `About ${appName}` },
    { kind: "separator", id: "app-separator-1" },
    { kind: "action", id: "settings", label: "Settings…", shortcut: "⌘," },
    { kind: "separator", id: "app-separator-2" },
    { kind: "action", id: "hide-app", label: `Hide ${appName}`, shortcut: "⌘H" },
    { kind: "action", id: "hide-others", label: "Hide Others", shortcut: "⌥⌘H" },
    { kind: "action", id: "show-all", label: "Show All", disabled: true },
    { kind: "separator", id: "app-separator-3" },
    { kind: "action", id: "quit-app", label: `Quit ${appName}`, shortcut: "⌘Q" },
  ];
}

function resolveMenu(item: string | MenuBarMenu): MenuBarMenu {
  return typeof item === "string"
    ? { title: item, items: standardMenus[item] ?? unavailableMenu }
    : item;
}

function withManagedWindowCommands(
  menu: MenuBarMenu,
  manager: MacWindowManagerValue,
  onMenuAction: DesktopShellProps["onMenuAction"],
  isApplicationMenu: boolean,
): MenuBarMenu {
  const keyWindow = manager.windows.find((window) => window.id === manager.keyWindowId);
  const keyApp = manager.apps.find((app) => app.id === manager.keyAppId);
  const keyAppWindows = manager.windows.filter((window) => (
    window.appId === manager.keyAppId && window.state !== "closed"
  ));
  function command(id: string, label: string, action: () => void) {
    return () => {
      action();
      onMenuAction?.({ menu: menu.title, id, label });
    };
  }

  function managedCommand(
    entry: Extract<MenuSpec[number], { readonly kind: "action" }>,
    disabled: boolean,
    action: () => void,
  ) {
    // An entry with its own behavior is a consumer command that happens to
    // use a standard identifier, not permission for the shell to replace it.
    // This also lets callers deliberately keep a managed-looking command
    // unavailable while the window manager has a viable target.
    if (entry.onSelect !== undefined || entry.href !== undefined || entry.disabled !== undefined) return entry;
    return {
      ...entry,
      disabled,
      onSelect: disabled ? undefined : command(entry.id, entry.label, action),
    };
  }

  // The application menu is a structural slot, not a title. Check that
  // identity before standard title dispatch so an app literally named
  // "File" still receives lifecycle commands instead of File-menu behavior.
  if (isApplicationMenu) {
    if (keyApp === undefined) return menu;
    return {
      ...menu,
      items: menu.items.map((entry) => {
        if (entry.kind !== "action") return entry;
        if (entry.id === "hide-app") {
          return managedCommand(entry, false, () => {
            for (const window of keyAppWindows) manager.minimizeWindow(window.id);
          });
        }
        if (entry.id === "hide-others") {
          return managedCommand(entry, false, () => {
            for (const window of manager.windows) {
              if (window.appId !== keyApp.id && window.state === "open") manager.minimizeWindow(window.id);
            }
          });
        }
        if (entry.id === "quit-app") {
          return managedCommand(entry, false, () => manager.quitApp(keyApp.id));
        }
        return entry;
      }),
    };
  }
  if (menu.title === "File") {
    return {
      ...menu,
      items: menu.items.map((entry) => entry.kind === "action" && entry.id === "close-window"
        ? managedCommand(entry, keyWindow === undefined, () => {
            if (keyWindow !== undefined) manager.closeWindow(keyWindow.id);
          })
        : entry),
    };
  }
  if (menu.title !== "Window") return menu;

  const managedItems = menu.items.map((entry) => {
    if (entry.kind !== "action") return entry;
    if (entry.id === "minimize") {
      return managedCommand(entry, keyWindow === undefined, () => {
        if (keyWindow !== undefined) manager.minimizeWindow(keyWindow.id);
      });
    }
    if (entry.id === "zoom") {
      return managedCommand(entry, keyWindow === undefined, () => {
        if (keyWindow !== undefined) manager.toggleZoom(keyWindow.id);
      });
    }
    if (entry.id === "bring-all-to-front") {
      return managedCommand(entry, manager.keyAppId === null, () => manager.bringAllToFront(manager.keyAppId ?? undefined));
    }
    return entry;
  });
  const consumerIds = new Set(managedItems.map((entry) => entry.id));
  const managedWindows = keyAppWindows.filter((window) => !consumerIds.has(`window-${window.id}`));
  const items: MenuSpec = [
    ...managedItems,
    ...(managedItems.length === 0 || managedWindows.length === 0
      ? []
      : [{ kind: "separator" as const, id: "managed-window-list-separator" }]),
    ...managedWindows.map((window) => ({
      kind: "action" as const,
      id: `window-${window.id}`,
      label: window.label,
      checked: window.isKeyWindow,
      onSelect: command(`window-${window.id}`, window.label, () => manager.restoreWindow(window.id)),
    })),
  ];
  return { ...menu, items };
}

function withCommandTarget(menu: MenuBarMenu, onMenuAction: DesktopShellProps["onMenuAction"]): MenuBarMenu {
  return {
    ...menu,
    items: menu.items.map((entry) => {
      if (entry.kind !== "action" || entry.onSelect !== undefined || entry.href !== undefined || entry.disabled === true) {
        return entry;
      }
      if (onMenuAction === undefined) return { ...entry, disabled: true };
      return {
        ...entry,
        onSelect: () => onMenuAction({ menu: menu.title, id: entry.id, label: entry.label }),
      };
    }),
  };
}

function nativeDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("weekday")} ${value("month")} ${value("day")}`;
}

function nativeClock(now: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
}

export function DesktopShell({
  appName,
  menuItems = defaultMenuItems,
  appleMenuItems,
  appMenuItems,
  onMenuAction,
  date,
  clock,
  menuBarExtras,
  wallpaper,
  children,
}: DesktopShellProps) {
  const windowManager = useOptionalMacWindowManager();
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const openMenuIndexRef = useRef(openMenuIndex);
  openMenuIndexRef.current = openMenuIndex;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (date !== undefined && clock !== undefined) return;

    let timer: number | undefined;
    function scheduleNextMinute() {
      const delay = 60_000 - (Date.now() % 60_000);
      timer = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextMinute();
      }, delay);
    }
    scheduleNextMinute();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [clock, date]);
  useEffect(() => {
    if (openMenuIndex === null) return;
    function dismissFromOutside(event: PointerEvent) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".menu-left, .mc-menubar-menu-popover") === null) setOpenMenuIndex(null);
    }
    document.addEventListener("pointerdown", dismissFromOutside);
    return () => document.removeEventListener("pointerdown", dismissFromOutside);
  }, [openMenuIndex]);
  useEffect(() => {
    function moveFocusOutOfMenu(event: KeyboardEvent) {
      if (
        event.key !== "Tab"
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.isComposing
        || !(event.target instanceof Element)
        || event.target.closest(".mc-menubar-menu-popover") === null
      ) return;
      const currentIndex = openMenuIndexRef.current;
      const titles = menuBarRef.current?.querySelectorAll<HTMLButtonElement>(".mc-menubar-menu-title");
      if (currentIndex === null || titles === undefined || titles.length === 0) return;
      const targetIndex = (currentIndex + (event.shiftKey ? -1 : 1) + titles.length) % titles.length;
      event.preventDefault();
      // React Aria's FocusScope installs its own document-level Tab handler
      // when a portal opens. This listener is mounted before any menu opens,
      // so stopping the native event here prevents that later handler from
      // restoring the title that originally opened the switched menu.
      event.stopImmediatePropagation();
      titles.item(targetIndex).focus({ preventScroll: true });
      openMenuIndexRef.current = null;
      setOpenMenuIndex(null);
    }
    document.addEventListener("keydown", moveFocusOutOfMenu, true);
    return () => document.removeEventListener("keydown", moveFocusOutOfMenu, true);
  }, []);
  const canvasStyle: DesktopCanvasStyle | undefined = wallpaper
    ? { "--mc-wallpaper": cssImagePattern.test(wallpaper) ? wallpaper : `url("${wallpaper}")` }
    : undefined;
  const menus: readonly MenuBarMenu[] = [
    { title: "Apple", items: appleMenuItems ?? defaultAppleMenu() },
    { title: appName, items: appMenuItems ?? defaultAppMenu(appName) },
    ...menuItems.map(resolveMenu),
  ]
    .map((menu, index) => windowManager === null
      ? menu
      : withManagedWindowCommands(menu, windowManager, onMenuAction, index === 1))
    .map((menu) => withCommandTarget(menu, onMenuAction));
  function adjacentMenuIndex(index: number, offset: -1 | 1) {
    return (index + offset + menus.length) % menus.length;
  }
  return (
    <main className="showcase-viewport">
      <div className="desktop-canvas" style={canvasStyle}>
        <header className="mac-menu-bar">
          <div ref={menuBarRef} className="menu-left">
            {menus.map((item, index) => (
              <MacMenu
                key={`${index}:${item.title}`}
                className={`mc-menubar-menu${index === 0 ? " mc-apple-menu" : ""}${index === 1 ? " mc-app-menu" : ""}`}
                isOpen={openMenuIndex === index}
                triggerClassName="mc-menubar-menu-title"
                triggerLabel={item.title}
                label={`${item.title} menu`}
                trigger={index === 0 ? <span className="apple-mark"><AppleMark /></span> : item.title}
                items={item.items}
                onMenuKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    event.stopPropagation();
                    const targetIndex = adjacentMenuIndex(index, event.key === "ArrowLeft" ? -1 : 1);
                    setOpenMenuIndex(targetIndex);
                  }
                }}
                onOpenChange={(open) => setOpenMenuIndex((current) => open ? index : current === index ? null : current)}
                onTriggerPointerEnter={() => setOpenMenuIndex((current) => current === null ? null : index)}
                popover={{ className: "mc-menubar-menu-popover", placement: "bottom start", offset: 3, nonModal: true }}
              />
            ))}
          </div>
          <div className="menu-right" aria-label="Mac status items">
            {menuBarExtras !== undefined ? <span className="mc-menubar-extras">{menuBarExtras}</span> : null}
            <StatusSymbol label="Battery" name="battery.100percent" status="battery" />
            <StatusSymbol label="Wi-Fi" name="wifi" status="wifi" />
            <StatusSymbol label="Control Center" name="switch.2" status="control-center" />
            <span suppressHydrationWarning>{date ?? nativeDate(now)}</span>
            <span suppressHydrationWarning>{clock ?? nativeClock(now)}</span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
