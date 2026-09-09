"use client";

// PLACEHOLDER components — replaced wholesale when the real packages/mac-chrome
// is vendored over this directory. The stub keeps the public APIs and common
// interaction contracts honest so template code remains functional before
// vendoring. Advanced window dragging, visual transitions, and screenshot-
// thumbnail machinery remain exclusive to the real package.
import { Fragment, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent as ReactDragEvent, type FormEventHandler, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type RefObject } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator as AriaSeparator,
  ToggleButton,
  ToggleButtonGroup,
  Tree,
  TreeItem,
  TreeItemContent,
  type Key,
  type Selection,
} from "react-aria-components";
import { Group, Panel, Separator as PanelSeparator } from "react-resizable-panels";
import { createPortal } from "react-dom";
import { getSymbol, type SymbolName } from "symbolist";

/* Accepts a full CSS <image> value or a bare URL for the wallpaper prop. */
const stubCssImageFunctions = new Set([
  "url",
  "image",
  "image-set",
  "-webkit-image-set",
  "cross-fade",
  "-webkit-cross-fade",
  "element",
  "paint",
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
  "var",
]);

function stubWallpaperSource(wallpaper: string) {
  const value = wallpaper.trim();
  const functionMatch = /^(-?[a-z][a-z0-9-]*)\(/i.exec(value);
  const functionName = functionMatch?.[1];
  let isImageValue = functionName !== undefined && stubCssImageFunctions.has(functionName.toLowerCase());
  if (isImageValue) {
    let depth = 0;
    let quote: "\"" | "'" | null = null;
    isImageValue = false;
    for (let index = (functionMatch?.[0].length ?? 1) - 1; index < value.length; index += 1) {
      const character = value[index];
      if (quote !== null) {
        if (character === "\\") index += 1;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === "\"" || character === "'") {
        quote = character;
        continue;
      }
      if (character === "/" && value[index + 1] === "*") {
        const commentEnd = value.indexOf("*/", index + 2);
        if (commentEnd === -1) break;
        index = commentEnd + 1;
        continue;
      }
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === "(") {
        depth += 1;
        continue;
      }
      if (character !== ")") continue;
      depth -= 1;
      if (depth < 0) break;
      if (depth === 0) {
        isImageValue = index === value.length - 1;
        break;
      }
    }
  }
  if (isImageValue) return wallpaper;
  const escaped = wallpaper.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `url("${escaped}")`;
}

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

export type MobileReviewMode = "fixed-desktop";

const stubStandardMenus: Readonly<Record<string, MenuSpec>> = {
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

function stubAppleMenu(): MenuSpec {
  return [
    { kind: "action", id: "about-this-mac", label: "About This Mac", icon: <SystemSymbol name="laptopcomputer" /> },
    { kind: "separator", id: "apple-separator-1" },
    { kind: "action", id: "system-settings", label: "System Settings…", icon: <SystemSymbol name="gear" /> },
    { kind: "action", id: "app-store", label: "App Store…", icon: <SystemSymbol name="app" /> },
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

function stubAppMenu(appName: string): MenuSpec {
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

function StubMenuActionItem({ entry }: { readonly entry: MenuAction }) {
  return (
    <MenuItem
      id={entry.id}
      textValue={entry.label}
      className="mc-menu-item"
      href={entry.href}
      target={entry.target}
      rel={entry.target === "_blank" ? "noreferrer" : undefined}
      isDisabled={entry.disabled}
      onAction={() => entry.onSelect?.()}
    >
      <span className="mc-menu-icon" aria-hidden="true">
        {entry.icon ?? (entry.checked === true ? <SystemSymbol name="checkmark" /> : null)}
      </span>
      <span className="mc-menu-copy">
        <span className="mc-menu-label">{entry.label}</span>
        {entry.detail !== undefined ? <small>{entry.detail}</small> : null}
      </span>
      <span className="mc-menu-trailing" aria-hidden="true">
        {entry.shortcut !== undefined ? <kbd className="mc-menu-shortcut">{entry.shortcut}</kbd> : entry.trailingIcon}
      </span>
    </MenuItem>
  );
}

type StubMenuBlock =
  | { readonly kind: "separator"; readonly id: string }
  | { readonly kind: "group"; readonly id: string; readonly label?: string; readonly entries: MenuAction[] };

function stubMenuBlocks(items: MenuSpec): readonly StubMenuBlock[] {
  const blocks: StubMenuBlock[] = [];
  let group: Extract<StubMenuBlock, { readonly kind: "group" }> | null = null;
  for (const entry of items) {
    if (entry.kind === "separator") {
      group = null;
      blocks.push(entry);
    } else if (entry.kind === "section") {
      group = { kind: "group", id: entry.id, label: entry.label, entries: [] };
      blocks.push(group);
    } else {
      if (group === null) {
        group = { kind: "group", id: `group:${entry.id}`, entries: [] };
        blocks.push(group);
      }
      group.entries.push(entry);
    }
  }
  return blocks;
}

function renderStubMenuBlock(block: StubMenuBlock): readonly ReactNode[] {
  if (block.kind === "separator") return [<AriaSeparator key={block.id} id={block.id} className="menu-separator" />];
  const items = block.entries.map((entry) => <StubMenuActionItem key={entry.id} entry={entry} />);
  const hasChecked = block.entries.some((entry) => entry.checked !== undefined);
  if (block.label === undefined && !hasChecked) return items;
  const selectionProps = hasChecked
    ? { selectionMode: "single" as const, selectedKeys: block.entries.filter((entry) => entry.checked === true).map((entry) => entry.id) }
    : {};
  return [
    <MenuSection key={block.id} id={block.id} className="mc-menu-group" {...selectionProps}>
      {block.label !== undefined ? <Header className="menu-section-label">{block.label}</Header> : null}
      {items}
    </MenuSection>,
  ];
}

export function MacMenu({ className = "", isOpen, items, label, onMenuKeyDown, onOpenChange, onTriggerPointerEnter, popover, trigger, triggerClassName = "", triggerLabel }: {
  readonly className?: string;
  readonly isOpen?: boolean;
  readonly items: MenuSpec;
  readonly label: string;
  readonly onMenuKeyDown?: (event: ReactKeyboardEvent) => void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onTriggerPointerEnter?: () => void;
  readonly popover?: MenuPopoverConfig;
  readonly trigger: ReactNode;
  readonly triggerLabel?: string;
  readonly triggerClassName?: string;
}) {
  const controlledState = isOpen === undefined ? {} : { isOpen };
  return (
    <div className={`mc-menu ${className}`.trim()} onPointerEnter={onTriggerPointerEnter}>
      <MenuTrigger {...controlledState} onOpenChange={onOpenChange}>
        <Button aria-label={triggerLabel} className={`mc-menu-trigger ${triggerClassName}`.trim()}>{trigger}</Button>
        <Popover isNonModal={popover?.nonModal} placement={popover?.placement ?? "bottom end"} offset={popover?.offset ?? 7}>
          <div className="mc-menu-key-scope" onKeyDown={onMenuKeyDown}>
            <Menu aria-label={label} aria-labelledby="" className={`mc-menu-popover ${popover?.className ?? ""}`.trim()}>
              {stubMenuBlocks(items).flatMap(renderStubMenuBlock)}
            </Menu>
          </div>
        </Popover>
      </MenuTrigger>
    </div>
  );
}

export function MacDetailsMenu({ children, className = "", label, summary }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly summary: ReactNode;
}) {
  return (
    <div className={`mc-details-menu ${className}`.trim()}>
      <MacPopover
        className="mc-details-menu-popover"
        contentInset="compact"
        label={label}
        trigger={summary}
        triggerClassName="mc-details-menu-trigger"
      >
        {children}
      </MacPopover>
    </div>
  );
}

export function MacPopover({ children, className = "", contentInset = "regular", isOpen, label, layout = "content", offset = 6, onOpenChange, placement = "bottom end", trigger, triggerClassName = "", triggerRef }: {
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
  const controlledState = isOpen === undefined ? {} : { isOpen };
  return (
    <DialogTrigger {...controlledState} onOpenChange={onOpenChange}>
      <Button ref={triggerRef} aria-label={label} className={`mc-popover-trigger ${triggerClassName}`.trim()}>{trigger}</Button>
      <Popover className={`mc-popover-surface ${className}`.trim()} data-popover-layout={layout} placement={placement} offset={offset}>
        <Dialog aria-label={label} className="mc-popover-dialog" data-content-inset={contentInset}>{children}</Dialog>
      </Popover>
    </DialogTrigger>
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
export type WindowMobilePresentation = "authored" | "maximized";

const stubResizeEdges = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
type StubResizeEdge = typeof stubResizeEdges[number];

const genericDefaultSize: WindowSize = { width: 720, height: 480 };
const genericMinimumSize: WindowSize = { width: 420, height: 280 };
const finderDefaultSize: WindowSize = { width: 940, height: 580 };

type StubWindowGeometry = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
type StubWindowBounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number; readonly minWidth: number; readonly minHeight: number };
const stubWindowSafeInsets = { top: 28, right: 24, bottom: 88, left: 24 } as const;

function stubContractedInsets(length: number, leading: number, trailing: number): readonly [number, number] {
  const total = leading + trailing;
  if (length <= 0 || total <= 0) return [0, 0];
  const scale = Math.min(1, length / (total * 2));
  return [leading * scale, trailing * scale];
}

function stubSafeBounds(width: number, height: number, minSize: WindowSize): StubWindowBounds | null {
  if (width <= 0 || height <= 0) return null;
  const [leftInset, rightInset] = stubContractedInsets(width, stubWindowSafeInsets.left, stubWindowSafeInsets.right);
  const [topInset, bottomInset] = stubContractedInsets(height, stubWindowSafeInsets.top, stubWindowSafeInsets.bottom);
  const left = leftInset;
  const right = width - rightInset;
  const top = topInset;
  const bottom = height - bottomInset;
  return {
    left,
    top,
    right,
    bottom,
    minWidth: Math.min(Math.max(0, minSize.width), right - left),
    minHeight: Math.min(Math.max(0, minSize.height), bottom - top),
  };
}

function stubClampedGeometry(geometry: StubWindowGeometry, bounds: StubWindowBounds): StubWindowGeometry {
  const width = Math.min(Math.max(geometry.width, bounds.minWidth), bounds.right - bounds.left);
  const height = Math.min(Math.max(geometry.height, bounds.minHeight), bounds.bottom - bounds.top);
  return {
    left: Math.min(Math.max(geometry.left, bounds.left), bounds.right - width),
    top: Math.min(Math.max(geometry.top, bounds.top), bounds.bottom - height),
    width,
    height,
  };
}

function stubResizedGeometry(origin: StubWindowGeometry, edge: StubResizeEdge, deltaX: number, deltaY: number, bounds: StubWindowBounds): StubWindowGeometry {
  let left = origin.left;
  let right = origin.left + origin.width;
  let top = origin.top;
  let bottom = origin.top + origin.height;
  if (edge.includes("w")) left = Math.min(Math.max(origin.left + deltaX, bounds.left), right - bounds.minWidth);
  else if (edge.includes("e")) right = Math.min(Math.max(right + deltaX, left + bounds.minWidth), bounds.right);
  if (edge.includes("n")) top = Math.min(Math.max(origin.top + deltaY, bounds.top), bottom - bounds.minHeight);
  else if (edge.includes("s")) bottom = Math.min(Math.max(bottom + deltaY, top + bounds.minHeight), bounds.bottom);
  return { left, top, width: right - left, height: bottom - top };
}

function stubInlineLength(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  /** Returns whether this app supports a handler-less menu command. */
  readonly canPerformMenuAction?: (command: MenuCommand) => boolean;
  readonly date?: string;
  readonly clock?: string;
  /** MenuBarExtra elements rendered in flow beside the status items. */
  readonly menuBarExtras?: ReactNode;
  /** Keep the 1200x750 Mac canvas fixed on phone/coarse-pointer viewports. */
  readonly mobileReviewMode?: MobileReviewMode;
  /** CSS image value (url(...), gradient, var(...)) or a bare image URL. */
  readonly wallpaper?: string;
  readonly children: ReactNode;
}

function stubNativeDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("weekday")} ${value("month")} ${value("day")}`;
}

function stubNativeClock(now: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
}

function stubWithManagedWindowCommands(
  menu: MenuBarMenu,
  manager: MacWindowManagerValue,
  onMenuAction: DesktopShellProps["onMenuAction"],
  isApplicationMenu: boolean,
): MenuBarMenu {
  const keyWindow = manager.windows.find((window) => window.id === manager.keyWindowId);
  const keyApp = manager.apps.find((app) => app.id === manager.keyAppId);
  const keyAppWindows = manager.windows.filter((window) => window.appId === manager.keyAppId && window.state !== "closed");
  function command(id: string, label: string, action: () => void) {
    return () => {
      action();
      onMenuAction?.({ menu: menu.title, id, label });
    };
  }
  function managedCommand(entry: MenuAction, disabled: boolean, action: () => void): MenuAction {
    if (entry.onSelect !== undefined || entry.href !== undefined || entry.disabled !== undefined) return entry;
    return { ...entry, disabled, onSelect: disabled ? undefined : command(entry.id, entry.label, action) };
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
        if (entry.id === "quit-app") return managedCommand(entry, false, () => manager.quitApp(keyApp.id));
        return entry;
      }),
    };
  }
  if (menu.title === "File") {
    return {
      ...menu,
      items: menu.items.map((entry) => entry.kind === "action" && entry.id === "close-window"
        ? managedCommand(entry, keyWindow === undefined, () => { if (keyWindow !== undefined) manager.closeWindow(keyWindow.id); })
        : entry),
    };
  }
  if (menu.title !== "Window") return menu;

  const managedItems = menu.items.map((entry) => {
    if (entry.kind !== "action") return entry;
    if (entry.id === "minimize") {
      return managedCommand(entry, keyWindow === undefined, () => { if (keyWindow !== undefined) manager.minimizeWindow(keyWindow.id); });
    }
    if (entry.id === "zoom") {
      return managedCommand(entry, keyWindow === undefined, () => { if (keyWindow !== undefined) manager.toggleZoom(keyWindow.id); });
    }
    if (entry.id === "bring-all-to-front") {
      return managedCommand(entry, manager.keyAppId === null, () => manager.bringAllToFront(manager.keyAppId ?? undefined));
    }
    return entry;
  });
  const consumerIds = new Set(managedItems.map((entry) => entry.id));
  const managedWindows = keyAppWindows.filter((window) => !consumerIds.has(`window-${window.id}`));
  return {
    ...menu,
    items: [
      ...managedItems,
      ...(managedItems.length === 0 || managedWindows.length === 0 ? [] : [{ kind: "separator" as const, id: "managed-window-list-separator" }]),
      ...managedWindows.map((window) => ({
        kind: "action" as const,
        id: `window-${window.id}`,
        label: window.label,
        checked: window.isKeyWindow,
        onSelect: command(`window-${window.id}`, window.label, () => manager.restoreWindow(window.id)),
      })),
    ],
  };
}

function stubWithCommandTarget(
  menu: MenuBarMenu,
  onMenuAction: DesktopShellProps["onMenuAction"],
  canPerformMenuAction: DesktopShellProps["canPerformMenuAction"],
): MenuBarMenu {
  return {
    ...menu,
    items: menu.items.map((entry) => {
      if (entry.kind !== "action" || entry.onSelect !== undefined || entry.href !== undefined || entry.disabled === true) return entry;
      const command = { menu: menu.title, id: entry.id, label: entry.label };
      if (onMenuAction === undefined || canPerformMenuAction?.(command) !== true) return { ...entry, disabled: true };
      return { ...entry, onSelect: () => onMenuAction(command) };
    }),
  };
}

export function DesktopShell({
  appName,
  menuItems = ["File", "Edit", "View", "Window", "Help"],
  appleMenuItems,
  appMenuItems,
  onMenuAction,
  canPerformMenuAction,
  date,
  clock,
  menuBarExtras,
  mobileReviewMode,
  wallpaper,
  children,
}: DesktopShellProps) {
  const windowManager = useContext(StubManagerContext);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: number | null = null;
    const delay = 60_000 - (Date.now() % 60_000);
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, delay);
    return () => {
      window.clearTimeout(timeout);
      if (interval !== null) window.clearInterval(interval);
    };
  }, []);
  const menus: readonly MenuBarMenu[] = [
    { title: "Apple", items: appleMenuItems ?? stubAppleMenu() },
    { title: appName, items: appMenuItems ?? stubAppMenu(appName) },
    ...menuItems.map((item): MenuBarMenu => typeof item === "string"
      ? { title: item, items: stubStandardMenus[item] ?? [{ kind: "action", id: "unavailable", label: "No Commands Available", disabled: true }] }
      : item),
  ]
    .map((menu, index) => windowManager === null ? menu : stubWithManagedWindowCommands(menu, windowManager, onMenuAction, index === 1))
    .map((menu) => stubWithCommandTarget(menu, onMenuAction, canPerformMenuAction));
  const canvasStyle = wallpaper
    ? ({ "--mc-wallpaper": stubWallpaperSource(wallpaper) } as CSSProperties)
    : undefined;
  return (
    <main className="showcase-viewport" data-mobile-review-mode={mobileReviewMode}>
      <div className="desktop-canvas" style={canvasStyle}>
        <header className="mac-menu-bar">
          <div ref={menuBarRef} className="menu-left">
            {menus.map((menu, index) => (
              <MacMenu
                key={`${index}:${menu.title}`}
                className={`mc-menubar-menu${index === 0 ? " mc-apple-menu" : ""}${index === 1 ? " mc-app-menu" : ""}`}
                isOpen={openMenuIndex === index}
                triggerClassName="mc-menubar-menu-title"
                trigger={index === 0 ? <span className="apple-mark"><SystemSymbol name="apple.logo" /></span> : menu.title}
                triggerLabel={menu.title}
                label={`${menu.title} menu`}
                items={menu.items}
                onMenuKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  event.stopPropagation();
                  const offset = event.key === "ArrowLeft" ? -1 : 1;
                  setOpenMenuIndex((index + offset + menus.length) % menus.length);
                }}
                onOpenChange={(open) => setOpenMenuIndex((current) => open ? index : current === index ? null : current)}
                onTriggerPointerEnter={() => setOpenMenuIndex((current) => current === null ? null : index)}
                popover={{ className: "mc-menubar-menu-popover", placement: "bottom start", offset: 3, nonModal: true }}
              />
            ))}
          </div>
          <div className="menu-right" aria-label="Mac status items">
            {menuBarExtras !== undefined ? <span className="mc-menubar-extras">{menuBarExtras}</span> : null}
            <span className="mc-status-symbol" data-status-icon="battery" aria-label="Battery" role="img"><SystemSymbol name="battery.100percent" /></span>
            <span className="mc-status-symbol" data-status-icon="wifi" aria-label="Wi-Fi" role="img"><SystemSymbol name="wifi" /></span>
            <span className="mc-status-symbol" data-status-icon="control-center" aria-label="Control Center" role="img"><SystemSymbol name="switch.2" /></span>
            <span suppressHydrationWarning>{date ?? stubNativeDate(now)}</span>
            <span suppressHydrationWarning>{clock ?? stubNativeClock(now)}</span>
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
export interface MacAppDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup?: "apps" | "places";
  readonly defaultRunning?: boolean;
  readonly presentation?: MacAppPresentation;
}
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

type StubAppRegistration = {
  readonly id: string;
  readonly name: string;
  readonly icon: DockIconSource;
  readonly dockGroup: "apps" | "places";
  readonly defaultRunning: boolean;
  readonly presentation: MacAppPresentation;
};
type StubWindowRegistration = {
  readonly id: string;
  readonly appId: string;
  readonly label: string;
  readonly defaultOpen: boolean;
};
type StubRegistrationOwner = symbol;
type StubAppRecord = Omit<MacManagedApp, "windowIds"> & {
  readonly order: number;
  readonly fromManifest: boolean;
  readonly manifest?: StubAppRegistration;
  readonly registrations: readonly { readonly owner: StubRegistrationOwner; readonly registration: StubAppRegistration }[];
};
type StubWindowRecord = Omit<MacManagedWindow, "isKeyWindow" | "zIndex"> & {
  readonly order: number;
  readonly registrations: readonly { readonly owner: StubRegistrationOwner; readonly registration: StubWindowRegistration }[];
};
type StubManagerState = {
  readonly apps: readonly StubAppRecord[];
  readonly windows: readonly StubWindowRecord[];
  readonly nextOrder: number;
  readonly activeAppId: string | null;
};
type StubManagerContextValue = MacWindowManagerValue & {
  readonly registerApp: (app: StubAppRegistration, owner: StubRegistrationOwner) => void;
  readonly unregisterApp: (appId: string, owner: StubRegistrationOwner) => void;
  readonly registerWindow: (window: StubWindowRegistration, owner: StubRegistrationOwner) => void;
  readonly unregisterWindow: (windowId: string, owner: StubRegistrationOwner) => void;
  readonly updateWindowLabel: (windowId: string, owner: StubRegistrationOwner, label: string) => void;
  readonly consumeKeyboardWindowFocusIntent: () => boolean;
};
type StubAppContextValue = { readonly id: string; readonly defaultRunning: boolean };

const StubManagerContext = createContext<StubManagerContextValue | null>(null);
const StubAppContext = createContext<StubAppContextValue | null>(null);

function stubFallbackActiveAppId(state: StubManagerState, excludingAppId?: string): string | null {
  const runningAppIds = new Set(state.apps
    .filter((app) => app.running && app.id !== excludingAppId)
    .map((app) => app.id));
  const topVisibleAppId = state.windows
    .filter((window) => window.state === "open" && runningAppIds.has(window.appId))
    .slice()
    .sort((left, right) => left.order - right.order)
    .at(-1)?.appId;
  if (topVisibleAppId !== undefined) return topVisibleAppId;
  return state.apps
    .filter((app) => runningAppIds.has(app.id))
    .slice()
    .sort((left, right) => left.order - right.order)
    .at(0)?.id ?? null;
}

export function MacWindowManager({ children, initialApps = [] }: {
  readonly children: ReactNode;
  readonly initialApps?: readonly MacAppDefinition[];
}) {
  const initialAppsRef = useRef(initialApps);
  const [state, setState] = useState<StubManagerState>(() => ({
    apps: initialAppsRef.current.map((app, index) => {
      const manifest: StubAppRegistration = {
        id: app.id,
        name: app.name,
        icon: app.icon,
        dockGroup: app.dockGroup ?? "apps",
        defaultRunning: app.defaultRunning ?? true,
        presentation: app.presentation ?? "windowed",
      };
      return {
        id: manifest.id,
        name: manifest.name,
        icon: manifest.icon,
        dockGroup: manifest.dockGroup,
        presentation: manifest.presentation,
        running: manifest.defaultRunning,
        order: index + 1,
        fromManifest: true,
        manifest,
        registrations: [],
      };
    }),
    windows: [],
    nextOrder: initialAppsRef.current.length + 1,
    activeAppId: initialAppsRef.current.find((app) => app.defaultRunning !== false)?.id ?? null,
  }));
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
  const registerApp = useCallback((app: StubAppRegistration, owner: StubRegistrationOwner) => {
    setState((current) => {
      const existing = current.apps.find((candidate) => candidate.id === app.id);
      if (existing !== undefined) {
        const registrations = [...existing.registrations.filter((entry) => entry.owner !== owner), { owner, registration: app }];
        const activeAppId = current.activeAppId ?? (existing.running ? existing.id : null);
        return { ...current, activeAppId, apps: current.apps.map((candidate) => candidate.id === app.id ? { ...candidate, name: app.name, icon: app.icon, dockGroup: app.dockGroup, presentation: app.presentation, registrations } : candidate) };
      }
      const launchesVisibleWindow = app.defaultRunning && current.windows.some((window) => (
        window.appId === app.id && window.state === "open"
      ));
      return {
        ...current,
        apps: [...current.apps, { id: app.id, name: app.name, icon: app.icon, dockGroup: app.dockGroup, presentation: app.presentation, running: app.defaultRunning, order: current.nextOrder, fromManifest: false, registrations: [{ owner, registration: app }] }],
        nextOrder: current.nextOrder + 1,
        activeAppId: (current.activeAppId === null && app.defaultRunning) || launchesVisibleWindow
          ? app.id
          : current.activeAppId,
      };
    });
  }, []);
  const unregisterApp = useCallback((appId: string, owner: StubRegistrationOwner) => {
    setState((current) => {
      const existing = current.apps.find((app) => app.id === appId);
      if (existing === undefined) return current;
      const registrations = existing.registrations.filter((entry) => entry.owner !== owner);
      if (registrations.length === existing.registrations.length) return current;
      const surviving = registrations.at(-1)?.registration ?? existing.manifest;
      if (surviving !== undefined) {
        return {
          ...current,
          apps: current.apps.map((app) => app.id === appId ? {
            ...app,
            name: surviving.name,
            icon: surviving.icon,
            dockGroup: surviving.dockGroup,
            presentation: surviving.presentation,
            registrations,
          } : app),
        };
      }
      const next = { ...current, apps: current.apps.filter((app) => app.id !== appId), windows: current.windows.filter((window) => window.appId !== appId) };
      return { ...next, activeAppId: current.activeAppId === appId ? stubFallbackActiveAppId(next) : current.activeAppId };
    });
  }, []);
  const registerWindow = useCallback((window: StubWindowRegistration, owner: StubRegistrationOwner) => {
    setState((current) => {
      const existing = current.windows.find((candidate) => candidate.id === window.id);
      if (existing !== undefined) {
        const registrations = [...existing.registrations.filter((entry) => entry.owner !== owner), { owner, registration: window }];
        return { ...current, windows: current.windows.map((candidate) => candidate.id === window.id ? { ...candidate, label: window.label, registrations } : candidate) };
      }
      const activatesApp = window.defaultOpen && current.apps.find((app) => app.id === window.appId)?.running === true;
      return {
        ...current,
        windows: [...current.windows, { id: window.id, appId: window.appId, label: window.label, state: window.defaultOpen ? "open" : "closed", zoomed: false, order: window.defaultOpen ? current.nextOrder : 0, registrations: [{ owner, registration: window }] }],
        nextOrder: window.defaultOpen ? current.nextOrder + 1 : current.nextOrder,
        activeAppId: activatesApp ? window.appId : current.activeAppId,
      };
    });
  }, []);
  const unregisterWindow = useCallback((windowId: string, owner: StubRegistrationOwner) => {
    setState((current) => {
      const existing = current.windows.find((window) => window.id === windowId);
      if (existing === undefined) return current;
      const registrations = existing.registrations.filter((entry) => entry.owner !== owner);
      if (registrations.length === existing.registrations.length) return current;
      const surviving = registrations.at(-1)?.registration;
      return surviving === undefined
        ? { ...current, windows: current.windows.filter((window) => window.id !== windowId) }
        : { ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, label: surviving.label, registrations } : window) };
    });
  }, []);
  const updateWindowLabel = useCallback((windowId: string, owner: StubRegistrationOwner, label: string) => setState((current) => {
    const existing = current.windows.find((window) => window.id === windowId);
    if (existing === undefined) return current;
    const registrationIndex = existing.registrations.findIndex((entry) => entry.owner === owner);
    const registrationEntry = existing.registrations[registrationIndex];
    if (registrationEntry === undefined || registrationEntry.registration.label === label) return current;
    const registrations = existing.registrations.map((entry, index) => index === registrationIndex
      ? { ...entry, registration: { ...entry.registration, label } }
      : entry);
    const ownsCurrentMetadata = registrationIndex === registrations.length - 1;
    return { ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, label: ownsCurrentMetadata ? label : window.label, registrations } : window) };
  }), []);
  const activateWindow = useCallback((windowId: string) => setState((current) => {
    const target = current.windows.find((window) => window.id === windowId);
    if (target === undefined) return current;
    return {
      ...current,
      apps: current.apps.map((app) => app.id === target.appId ? { ...app, running: true } : app),
      windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "open", order: current.nextOrder, thumbnail: undefined } : window),
      nextOrder: current.nextOrder + 1,
      activeAppId: target.appId,
    };
  }), []);
  const activateApp = useCallback((appId: string) => setState((current) => {
    const app = current.apps.find((candidate) => candidate.id === appId);
    if (app === undefined) return current;
    const registeredWindows = current.windows.filter((window) => window.appId === appId);
    const stackedWindows = registeredWindows.slice().sort((left, right) => right.order - left.order);
    const target = stackedWindows.find((window) => window.state !== "closed") ?? registeredWindows[0];
    return {
      ...current,
      apps: current.apps.map((app) => app.id === appId ? { ...app, running: true } : app),
      windows: target === undefined ? current.windows : current.windows.map((window) => window.id === target.id ? { ...window, state: "open", order: current.nextOrder, thumbnail: undefined } : window),
      nextOrder: target === undefined ? current.nextOrder : current.nextOrder + 1,
      activeAppId: appId,
    };
  }), []);
  const closeWindow = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "closed", thumbnail: undefined } : window) })), []);
  const minimizeWindow = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, state: "minimized", thumbnail: { width: 720, height: 480 } } : window) })), []);
  const toggleZoom = useCallback((windowId: string) => setState((current) => ({ ...current, windows: current.windows.map((window) => window.id === windowId ? { ...window, zoomed: !window.zoomed } : window) })), []);
  const bringAllToFront = useCallback((appId?: string) => setState((current) => {
    const targets = current.windows
      .filter((window) => window.state === "open" && current.apps.find((app) => app.id === window.appId)?.running)
      .slice()
      .sort((left, right) => left.order - right.order)
      .filter((window) => appId === undefined || window.appId === appId);
    const activatedApp = appId === undefined
      ? undefined
      : current.apps.find((app) => app.id === appId && app.running);
    if (targets.length === 0) {
      return activatedApp === undefined || current.activeAppId === activatedApp.id
        ? current
        : { ...current, activeAppId: activatedApp.id };
    }
    const orders = new Map(targets.map((window, index) => [window.id, current.nextOrder + index]));
    return {
      ...current,
      windows: current.windows.map((window) => {
        const order = orders.get(window.id);
        return order === undefined ? window : { ...window, order };
      }),
      nextOrder: current.nextOrder + targets.length,
      activeAppId: activatedApp?.id ?? current.activeAppId,
    };
  }), []);
  const quitApp = useCallback((appId: string) => setState((current) => {
    const app = current.apps.find((candidate) => candidate.id === appId);
    if (app === undefined) return current;
    const next = {
      ...current,
      apps: current.apps.map((app) => app.id === appId ? { ...app, running: false } : app),
      windows: current.windows.map((window) => window.appId === appId ? { ...window, state: "closed" as const } : window),
    };
    return { ...next, activeAppId: current.activeAppId === appId ? stubFallbackActiveAppId(next, appId) : current.activeAppId };
  }), []);
  const visible = state.windows.filter((window) => window.state === "open" && state.apps.find((app) => app.id === window.appId)?.running).slice().sort((left, right) => left.order - right.order);
  const activeApp = state.apps.find((app) => app.id === state.activeAppId && app.running);
  const keyWindow = activeApp === undefined ? undefined : visible.filter((window) => window.appId === activeApp.id).at(-1);
  const windows: readonly MacManagedWindow[] = state.windows.map(({ registrations: _registrations, order: _order, ...window }) => ({ ...window, isKeyWindow: window.id === keyWindow?.id, zIndex: 10 + visible.findIndex((candidate) => candidate.id === window.id) }));
  const apps: readonly MacManagedApp[] = state.apps.map(({ fromManifest: _fromManifest, manifest: _manifest, registrations: _registrations, order: _order, ...app }) => ({ ...app, windowIds: state.windows.filter((window) => window.appId === app.id).map((window) => window.id) }));
  const value = useMemo<StubManagerContextValue>(() => ({
    apps,
    windows,
    keyWindowId: keyWindow?.id ?? null,
    keyAppId: activeApp?.id ?? null,
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
    updateWindowLabel,
    consumeKeyboardWindowFocusIntent,
  }), [activateApp, activateWindow, activeApp?.id, apps, bringAllToFront, closeWindow, consumeKeyboardWindowFocusIntent, keyWindow?.id, minimizeWindow, quitApp, registerApp, registerWindow, toggleZoom, unregisterApp, unregisterWindow, updateWindowLabel, windows]);
  return <StubManagerContext.Provider value={value}>{children}</StubManagerContext.Provider>;
}

export function useMacWindowManager() {
  const manager = useContext(StubManagerContext);
  if (manager === null) throw new Error("useMacWindowManager must be used inside MacWindowManager");
  return manager;
}

export function MacApp({ children, defaultRunning = true, dockGroup = "apps", icon, id, name, presentation = "windowed" }: MacAppDefinition & {
  readonly children: ReactNode;
}) {
  const manager = useMacWindowManager();
  const initial = useRef({ id, name, icon, dockGroup, defaultRunning, presentation });
  const registrationOwner = useRef<StubRegistrationOwner>(Symbol("MacApp registration"));
  useEffect(() => {
    manager.registerApp(initial.current, registrationOwner.current);
    return () => manager.unregisterApp(initial.current.id, registrationOwner.current);
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
  minSize = genericMinimumSize,
  mobilePresentation = "authored",
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
  readonly mobilePresentation?: WindowMobilePresentation;
  readonly resizable?: boolean;
  readonly style?: CSSProperties;
  readonly windowId?: string;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const manager = useContext(StubManagerContext);
  const app = useContext(StubAppContext);
  const windowRef = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState<StubWindowGeometry | null>(null);
  const resizeRef = useRef<{ readonly edge: StubResizeEdge; readonly pointerId: number; readonly startX: number; readonly startY: number; readonly origin: StubWindowGeometry; readonly bounds: StubWindowBounds } | null>(null);
  const resolvedWindowId = manager !== null && app !== null ? windowId ?? `${app.id}:main` : null;
  const registerWindow = manager?.registerWindow;
  const unregisterWindow = manager?.unregisterWindow;
  const updateWindowLabel = manager?.updateWindowLabel;
  const registrationOwner = useRef<StubRegistrationOwner>(Symbol("managed window registration"));
  useEffect(() => {
    if (registerWindow === undefined || unregisterWindow === undefined || app === null || resolvedWindowId === null) return;
    registerWindow({ id: resolvedWindowId, appId: app.id, label, defaultOpen }, registrationOwner.current);
    return () => unregisterWindow(resolvedWindowId, registrationOwner.current);
  }, [app, defaultOpen, registerWindow, resolvedWindowId, unregisterWindow]);
  useEffect(() => {
    if (updateWindowLabel === undefined || resolvedWindowId === null) return;
    updateWindowLabel(resolvedWindowId, registrationOwner.current, label);
  }, [label, resolvedWindowId, updateWindowLabel]);
  const managedWindow = resolvedWindowId === null ? undefined : manager?.windows.find((window) => window.id === resolvedWindowId);
  const appRunning = app === null ? true : manager?.apps.find((candidate) => candidate.id === app.id)?.running ?? app.defaultRunning;
  const visible = manager === null || resolvedWindowId === null || (appRunning && (managedWindow?.state === "open" || managedWindow === undefined && defaultOpen));
  const controls: StubWindowControls = {
    close: () => { onClose?.(); if (resolvedWindowId !== null) manager?.closeWindow(resolvedWindowId); },
    minimize: () => { onMinimize?.(); if (resolvedWindowId !== null) manager?.minimizeWindow(resolvedWindowId); },
    zoom: () => { onZoom?.(); if (resolvedWindowId !== null) manager?.toggleZoom(resolvedWindowId); },
  };

  function resizeContext(element: HTMLElement) {
    const canvas = element.closest<HTMLElement>(".desktop-canvas");
    const rect = canvas?.getBoundingClientRect();
    const width = rect?.width ?? window.innerWidth;
    const height = rect?.height ?? window.innerHeight;
    const bounds = stubSafeBounds(width, height, minSize);
    return bounds === null ? null : { bounds, originLeft: rect?.left ?? 0, originTop: rect?.top ?? 0 };
  }

  function beginResize(edge: StubResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    if (!resizable || event.pointerType === "touch" || event.button !== 0 || event.isPrimary === false) return;
    const element = windowRef.current;
    if (element === null) return;
    const context = resizeContext(element);
    if (context === null) return;
    const rect = element.getBoundingClientRect();
    const origin = stubClampedGeometry({
      left: rect.left - context.originLeft,
      top: rect.top - context.originTop,
      width: rect.width || stubInlineLength(element.style.width, minSize.width),
      height: rect.height || stubInlineLength(element.style.height, minSize.height),
    }, context.bounds);
    resizeRef.current = { edge, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin, bounds: context.bounds };
    setGeometry(origin);
    event.preventDefault();
    event.stopPropagation();
    element.setPointerCapture?.(event.pointerId);
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLElement>) {
    const resize = resizeRef.current;
    if (resize === null || resize.pointerId !== event.pointerId) return;
    setGeometry(stubResizedGeometry(resize.origin, resize.edge, event.clientX - resize.startX, event.clientY - resize.startY, resize.bounds));
  }

  function finishResize(event: ReactPointerEvent<HTMLElement>) {
    const resize = resizeRef.current;
    const element = windowRef.current;
    if (resize === null || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (element?.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture?.(event.pointerId);
  }

  if (!visible) return null;
  const windowStyle: CSSProperties = {
    ...framePlacement(frame, defaultSize),
    ...style,
    ...(managedWindow?.zoomed || geometry === null ? undefined : geometry),
    zIndex: managedWindow?.zIndex ?? style?.zIndex,
    viewTransitionName: resolvedWindowId === null ? undefined : `mc-window-${resolvedWindowId.replaceAll(":", "-3a-")}`,
  };
  return (
    <StubWindowControlsContext.Provider value={controls}>
      <section
        ref={windowRef}
        className={`mac-window ${className}${managedWindow?.zoomed ? " mc-zoomed" : ""}`.trim()}
        aria-label={label}
        data-app-id={app?.id}
        data-key-window={managedWindow === undefined ? undefined : managedWindow.isKeyWindow ? "true" : "false"}
        data-mobile-presentation={mobilePresentation}
        data-window-id={resolvedWindowId ?? undefined}
        data-window-resizable={resizable ? "true" : "false"}
        data-window-state={managedWindow?.state}
        onPointerDownCapture={() => { if (resolvedWindowId !== null) manager?.activateWindow(resolvedWindowId); }}
        onFocusCapture={() => {
          if (resolvedWindowId !== null && manager?.consumeKeyboardWindowFocusIntent()) manager.activateWindow(resolvedWindowId);
        }}
        onPointerMove={handleResizeMove}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        style={windowStyle}
      >
        {children}
        {resizable && !managedWindow?.zoomed ? stubResizeEdges.map((edge) => <span aria-hidden="true" className={`mc-window-resize-handle mc-window-resize-${edge}`} data-window-resize-handle={edge} key={edge} onPointerDown={(event) => beginResize(edge, event)} />) : null}
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
  | { readonly kind: "systemSymbol"; readonly name: SystemSymbolName; readonly background?: string; readonly foreground?: string }
  | { readonly kind: "artwork"; readonly artwork: ReactNode; readonly background?: string; readonly foreground?: string }
  /** @deprecated Use `systemSymbol` for SF Symbols or `artwork` for custom artwork. */
  | { readonly kind: "symbol"; readonly symbol: ReactNode; readonly background?: string; readonly foreground?: string };

export type DockIconSource = DockIcon | ReactNode | string;

export interface MacDockAppIconProps {
  readonly icon: DockIconSource;
  readonly label?: string;
}

function stubDockIcon(icon: DockIconSource): DockIcon {
  if (typeof icon === "string") return { kind: "asset", src: icon };
  if (typeof icon === "object" && icon !== null && "kind" in icon) return icon as DockIcon;
  return { kind: "artwork", artwork: icon };
}

export function MacDockAppIcon({ icon, label }: MacDockAppIconProps) {
  const normalized = stubDockIcon(icon);
  return (
    <span className={`p0-app-icon p0-app-icon--${normalized.kind === "asset" ? "asset" : "tile"}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span
        className="p0-app-icon-artwork"
        style={normalized.kind === "asset" ? undefined : { backgroundColor: normalized.background, color: normalized.foreground }}
      >
        {normalized.kind === "asset"
          ? <img className="p0-app-icon-image" src={normalized.src} alt="" draggable={false} loading="lazy" fetchPriority="low" decoding="async" />
          : (
              <span className={`p0-app-icon-glyph p0-app-icon-glyph--${normalized.kind === "systemSymbol" ? "system-symbol" : "artwork"}`}>
                {normalized.kind === "systemSymbol"
                  ? <SystemSymbol name={normalized.name} size={20} />
                  : normalized.kind === "artwork"
                    ? normalized.artwork
                    : normalized.symbol}
              </span>
            )}
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

interface StubDockTooltipPosition {
  readonly itemId: string;
  readonly left: number;
  readonly visible: boolean;
}

const stubWindowThumbnailGeometry = {
  maxWidth: 48,
  maxHeight: 44,
} as const;

const stubDockTooltipViewportInset = 8;

function stubContainedThumbnailSize(thumbnail: MacWindowThumbnail) {
  const sourceWidth = Number.isFinite(thumbnail.width) && thumbnail.width > 0 ? thumbnail.width : 720;
  const sourceHeight = Number.isFinite(thumbnail.height) && thumbnail.height > 0 ? thumbnail.height : 480;
  const scale = Math.min(
    stubWindowThumbnailGeometry.maxWidth / sourceWidth,
    stubWindowThumbnailGeometry.maxHeight / sourceHeight,
  );
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

function stubDockItemsLayoutKey(items: readonly DockItem[]) {
  return JSON.stringify(items.map((item) => [item.id, item.label, item.group ?? null]));
}

export const defaultDockItems: readonly DockItem[] = [
  { id: "finder", label: "Finder", icon: { kind: "systemSymbol", name: "face.smiling", background: "#0a84ff" }, running: true, group: "apps" },
  { id: "app-store", label: "App Store", icon: { kind: "systemSymbol", name: "app.gift.fill", background: "#1597f4" }, group: "apps" },
  { id: "chrome", label: "Google Chrome", icon: { kind: "systemSymbol", name: "globe", background: "#4385f5" }, group: "apps" },
  { id: "downloads", label: "Downloads", icon: { kind: "systemSymbol", name: "folder.fill", background: "#58baf5" }, group: "places" },
  { id: "trash", label: "Trash", icon: { kind: "systemSymbol", name: "trash.fill", background: "#8e969e" }, group: "places" },
];

export function MacDock({ items = defaultDockItems, label = "Dock" }: {
  readonly items?: readonly DockItem[];
  readonly label?: string;
}) {
  const dockRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const hoveredItemIdRef = useRef<string | null>(null);
  const focusedItemIdRef = useRef<string | null>(null);
  const tooltipId = useId();
  const [activeTooltipItemId, setActiveTooltipItemId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<StubDockTooltipPosition | null>(null);
  const activeTooltipItem = activeTooltipItemId === null
    ? undefined
    : items.find((item) => item.id === activeTooltipItemId);
  const itemsLayoutKey = stubDockItemsLayoutKey(items);

  const positionTooltip = useCallback((itemId: string) => {
    const dock = dockRef.current;
    const scrollport = scrollRef.current;
    const tooltip = tooltipRef.current;
    const item = itemRefs.current.get(itemId);
    if (dock === null || scrollport === null || tooltip === null || item === undefined) return;

    const dockRect = dock.getBoundingClientRect();
    const scrollportRect = scrollport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const visible = itemRect.right > scrollportRect.left && itemRect.left < scrollportRect.right;
    const availableWidth = Math.max(0, window.innerWidth - stubDockTooltipViewportInset * 2);
    const tooltipWidth = Math.min(tooltipRect.width, availableWidth);
    const minimumCenter = stubDockTooltipViewportInset + tooltipWidth / 2;
    const maximumCenter = window.innerWidth - stubDockTooltipViewportInset - tooltipWidth / 2;
    const itemCenter = (itemRect.left + itemRect.right) / 2;
    const viewportCenter = minimumCenter <= maximumCenter
      ? Math.min(Math.max(itemCenter, minimumCenter), maximumCenter)
      : window.innerWidth / 2;
    const nextPosition = {
      itemId,
      left: viewportCenter - dockRect.left,
      visible,
    } satisfies StubDockTooltipPosition;
    setTooltipPosition((current) => (
      current?.itemId === nextPosition.itemId
        && current.left === nextPosition.left
        && current.visible === nextPosition.visible
        ? current
        : nextPosition
    ));
  }, []);

  useLayoutEffect(() => {
    if (activeTooltipItemId === null || activeTooltipItem !== undefined) return;
    hoveredItemIdRef.current = null;
    focusedItemIdRef.current = null;
    setActiveTooltipItemId(null);
    setTooltipPosition(null);
  }, [activeTooltipItem, activeTooltipItemId]);

  useLayoutEffect(() => {
    if (activeTooltipItemId === null || activeTooltipItem === undefined) return;
    const scrollport = scrollRef.current;
    if (scrollport === null) return;
    const reposition = () => positionTooltip(activeTooltipItemId);
    reposition();
    scrollport.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition);
    return () => {
      scrollport.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [activeTooltipItem, activeTooltipItemId, itemsLayoutKey, positionTooltip]);

  function stopHovering(itemId: string) {
    if (hoveredItemIdRef.current === itemId) hoveredItemIdRef.current = null;
    setActiveTooltipItemId(focusedItemIdRef.current);
  }

  function stopFocusing(itemId: string) {
    if (focusedItemIdRef.current === itemId) focusedItemIdRef.current = null;
    setActiveTooltipItemId(hoveredItemIdRef.current);
  }

  const hasPositionedActiveTooltip = tooltipPosition?.itemId === activeTooltipItemId;
  return (
    <nav ref={dockRef} className="p0-mac-dock" aria-label={label}>
      <span ref={scrollRef} className="p0-dock-scroll">
        {items.map((item, index) => {
          const previousItem = items[index - 1];
          const startsGroup = previousItem !== undefined && previousItem.group !== item.group;
          const payload = item.draggablePayload;
          const draggable = payload !== undefined && Object.keys(payload).length > 0;
          const thumbnailSize = item.windowThumbnail === undefined
            ? undefined
            : stubContainedThumbnailSize(item.windowThumbnail);
          return (
            <span className="p0-dock-item-wrap" key={item.id}>
              {startsGroup ? <i className="p0-dock-divider" aria-hidden="true" /> : null}
              <button
                ref={(element) => {
                  if (element === null) itemRefs.current.delete(item.id);
                  else itemRefs.current.set(item.id, element);
                }}
                className={`p0-dock-item${item.running ? " is-running" : ""}${item.windowThumbnail ? " is-window-thumbnail" : ""}${draggable ? " can-drag" : ""}`}
                type="button"
                aria-label={item.label}
                aria-describedby={activeTooltipItemId === item.id ? tooltipId : undefined}
                data-hover-effect="lift"
                draggable={draggable}
                onClick={item.onActivate}
                onPointerEnter={() => {
                  hoveredItemIdRef.current = item.id;
                  setActiveTooltipItemId(item.id);
                }}
                onPointerLeave={() => stopHovering(item.id)}
                onFocus={() => {
                  focusedItemIdRef.current = item.id;
                  setActiveTooltipItemId(item.id);
                }}
                onBlur={() => stopFocusing(item.id)}
                onDragStart={(event: ReactDragEvent<HTMLButtonElement>) => {
                  if (payload === undefined) return;
                  for (const [type, data] of Object.entries(payload)) event.dataTransfer.setData(type, data);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                {item.windowThumbnail && thumbnailSize ? (
                  <span className="p0-window-thumbnail-slot">
                    <span className="p0-window-thumbnail" style={{ width: thumbnailSize.width, height: thumbnailSize.height, viewTransitionName: item.viewTransitionName }}>
                      {item.windowThumbnail.src ? <img src={item.windowThumbnail.src} alt="" draggable={false} /> : <span className="p0-window-thumbnail-fallback"><MacDockAppIcon icon={item.icon} /></span>}
                    </span>
                  </span>
                ) : <MacDockAppIcon icon={item.icon} />}
                <span className="p0-dock-running-dot" aria-hidden="true" />
              </button>
            </span>
          );
        })}
      </span>
      {activeTooltipItem === undefined ? null : (
        <span
          ref={tooltipRef}
          id={tooltipId}
          className="p0-dock-tooltip"
          role="tooltip"
          data-visible={hasPositionedActiveTooltip && tooltipPosition.visible ? "true" : "false"}
          style={{ left: hasPositionedActiveTooltip ? tooltipPosition.left : undefined }}
        >
          {activeTooltipItem.label}
        </span>
      )}
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

const stubSidebarSizing = { minSize: 160, defaultSize: 220, maxSize: 320 } satisfies Required<MacNavigationColumnSizing>;
const stubContentSizing = { minSize: 220, defaultSize: 280, maxSize: 420 } satisfies Required<MacNavigationColumnSizing>;
const stubDetailSizing = { minSize: 280, defaultSize: 520, maxSize: "100%" } satisfies Required<MacNavigationColumnSizing>;
const stubPanelStyle: CSSProperties = { display: "flex", overflow: "hidden" };

function stubPanelSizing(sizing: MacNavigationColumnSizing | undefined, defaults: Required<MacNavigationColumnSizing>): Required<MacNavigationColumnSizing> {
  return {
    minSize: sizing?.minSize ?? defaults.minSize,
    defaultSize: sizing?.defaultSize ?? defaults.defaultSize,
    maxSize: sizing?.maxSize ?? defaults.maxSize,
  };
}

type StubLayoutUnit = "%" | "em" | "px" | "rem" | "vh" | "vw";
type StubLayoutSize = { readonly unit: StubLayoutUnit; readonly value: number };

function stubLayoutUnit(unit: string | undefined): StubLayoutUnit | null {
  switch (unit) {
    case undefined:
    case "%":
      return "%";
    case "em":
    case "px":
    case "rem":
    case "vh":
    case "vw":
      return unit;
    default:
      return null;
  }
}

function stubLayoutSize(size: number | string): StubLayoutSize | null {
  if (typeof size === "number") return Number.isFinite(size) && size >= 0 ? { unit: "px", value: size } : null;
  const match = /^([0-9]+(?:\.[0-9]+)?)(%|px|rem|em|vh|vw)?$/.exec(size.trim());
  if (match?.[1] === undefined) return null;
  const value = Number(match[1]);
  const unit = stubLayoutUnit(match[2]);
  return Number.isFinite(value) && unit !== null ? { unit, value } : null;
}

function stubNormalizedLayout(entries: readonly (readonly [string, number | string])[]): Readonly<Record<string, number>> | undefined {
  const parsed = entries.map(([id, size]) => [id, stubLayoutSize(size)] as const);
  const firstUnit = parsed[0]?.[1]?.unit;
  if (firstUnit === undefined || parsed.some(([, size]) => size === null || size.unit !== firstUnit)) return undefined;
  const total = parsed.reduce((sum, [, size]) => sum + (size?.value ?? 0), 0);
  if (total <= 0) return undefined;
  return Object.fromEntries(parsed.map(([id, size]) => [id, ((size?.value ?? 0) / total) * 100]));
}

export function MacNavigationSplitView({
  sidebar,
  content,
  detail,
  sidebarVisible = true,
  sidebarLabel = "Sidebar",
  contentLabel = "Content",
  detailLabel = "Detail",
  sidebarSizing,
  contentSizing,
  detailSizing,
  className = "",
  id,
}: MacNavigationSplitViewProps) {
  const generatedId = useId().replaceAll(":", "");
  const idPrefix = id ?? `mc-navigation-${generatedId}`;
  const resolvedSidebarSizing = stubPanelSizing(sidebarSizing, stubSidebarSizing);
  const resolvedContentSizing = stubPanelSizing(contentSizing, stubContentSizing);
  const resolvedDetailSizing = stubPanelSizing(detailSizing, stubDetailSizing);
  const hasContent = content !== undefined;
  const defaultLayout = useMemo(() => stubNormalizedLayout([
    ...(sidebarVisible ? [[`${idPrefix}-sidebar`, resolvedSidebarSizing.defaultSize] as const] : []),
    ...(hasContent ? [[`${idPrefix}-content`, resolvedContentSizing.defaultSize] as const] : []),
    [`${idPrefix}-detail`, resolvedDetailSizing.defaultSize] as const,
  ]), [hasContent, idPrefix, resolvedContentSizing.defaultSize, resolvedDetailSizing.defaultSize, resolvedSidebarSizing.defaultSize, sidebarVisible]);

  const leadingColumns: ReactNode[] = [];
  if (sidebarVisible) {
    leadingColumns.push(
      <Panel
        key="sidebar"
        id={`${idPrefix}-sidebar`}
        className="mc-navigation-panel"
        minSize={resolvedSidebarSizing.minSize}
        defaultSize={resolvedSidebarSizing.defaultSize}
        maxSize={resolvedSidebarSizing.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        style={stubPanelStyle}
      >
        <aside className="mc-navigation-column mc-navigation-sidebar" aria-label={sidebarLabel}>{sidebar}</aside>
      </Panel>,
      <PanelSeparator key="sidebar-separator" className="mc-navigation-separator" aria-label={`Resize ${sidebarLabel}`} />,
    );
  }
  if (content !== undefined) {
    leadingColumns.push(
      <Panel
        key="content"
        id={`${idPrefix}-content`}
        className="mc-navigation-panel"
        minSize={resolvedContentSizing.minSize}
        defaultSize={resolvedContentSizing.defaultSize}
        maxSize={resolvedContentSizing.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        style={stubPanelStyle}
      >
        <section className="mc-navigation-column mc-navigation-content" aria-label={contentLabel}>{content}</section>
      </Panel>,
      <PanelSeparator key="content-separator" className="mc-navigation-separator" aria-label={`Resize ${contentLabel}`} />,
    );
  }
  return (
    <Group id={`${idPrefix}-group`} className={`mc-navigation-split-view ${className}`.trim()} defaultLayout={defaultLayout} orientation="horizontal">
      {leadingColumns}
      <Panel
        id={`${idPrefix}-detail`}
        className="mc-navigation-panel"
        minSize={resolvedDetailSizing.minSize}
        defaultSize={resolvedDetailSizing.defaultSize}
        maxSize={resolvedDetailSizing.maxSize}
        style={stubPanelStyle}
      >
        <section className="mc-navigation-column mc-navigation-detail" aria-label={detailLabel}>{detail}</section>
      </Panel>
    </Group>
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

function stubPixelWidth(width: number | string): number | undefined {
  if (typeof width === "number") return width;
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(width.trim());
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

type StubInspectorDrag = { readonly pointerId: number; readonly startX: number; readonly startWidth: number };

export function MacInspector({ children, className = "", label = "Inspector", visible = true, width, defaultWidth = 260, minWidth = 220, maxWidth = 360, onWidthChange }: MacInspectorProps) {
  const minimum = Math.min(minWidth, maxWidth);
  const maximum = Math.max(minWidth, maxWidth);
  const clamp = (next: number) => Math.min(Math.max(next, minimum), maximum);
  const [internalWidth, setInternalWidth] = useState(() => clamp(defaultWidth));
  const inspectorRef = useRef<HTMLElement>(null);
  const renderedWidth = width ?? internalWidth;
  const knownPixelWidth = stubPixelWidth(renderedWidth);
  const measurementKey = knownPixelWidth === undefined ? `${renderedWidth}|${minimum}|${maximum}` : null;
  const [measurement, setMeasurement] = useState<{ readonly key: string; readonly width: number } | null>(null);
  const measuredWidth = measurementKey !== null && measurement?.key === measurementKey ? measurement.width : undefined;
  const reportedWidth = knownPixelWidth === undefined ? measuredWidth : clamp(knownPixelWidth);
  const drag = useRef<StubInspectorDrag | null>(null);
  const inspectorId = `mc-inspector-${useId().replaceAll(":", "")}`;

  useLayoutEffect(() => {
    if (measurementKey === null || !visible) return;
    const element = inspectorRef.current;
    if (element === null) return;
    const measuredElement = element;
    const currentMeasurementKey = measurementKey;
    function measure() {
      const nextWidth = measuredElement.getBoundingClientRect().width;
      if (nextWidth <= 0) return;
      setMeasurement((current) => current?.key === currentMeasurementKey && current.width === nextWidth
        ? current
        : { key: currentMeasurementKey, width: nextWidth });
    }
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(measuredElement);
    return () => observer.disconnect();
  }, [measurementKey, visible]);

  function resize(next: number) {
    const resized = clamp(next);
    if (width === undefined) setInternalWidth(resized);
    onWidthChange?.(resized);
  }

  function currentWidth(): number {
    const measured = inspectorRef.current?.getBoundingClientRect().width ?? 0;
    return measured > 0 ? measured : (reportedWidth ?? internalWidth);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: currentWidth() };
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current === null || drag.current.pointerId !== event.pointerId) return;
    resize(drag.current.startWidth + drag.current.startX - event.clientX);
  }

  function finishPointerResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current === null || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const next = event.key === "ArrowLeft" ? currentWidth() + 10 : event.key === "ArrowRight" ? currentWidth() - 10 : event.key === "Home" ? minimum : event.key === "End" ? maximum : undefined;
    if (next === undefined) return;
    event.preventDefault();
    resize(next);
  }

  if (!visible) return null;
  return <><div role="separator" aria-controls={inspectorId} aria-label={`Resize ${label}`} aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={reportedWidth} className="mc-navigation-separator mc-inspector-separator" tabIndex={0} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointerResize} onPointerCancel={finishPointerResize} /><aside ref={inspectorRef} id={inspectorId} className={`mc-inspector ${className}`.trim()} aria-label={label} style={{ width: cssLength(renderedWidth), minWidth: cssLength(minimum), maxWidth: cssLength(maximum) }}>{children}</aside></>;
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
  readonly selectable?: boolean;
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
  readonly selectedSectionId?: string | null;
  readonly onSectionSelectionChange?: (id: string) => void;
  readonly expandedSectionIds?: ReadonlySet<string>;
  readonly onExpandedSectionIdsChange?: (ids: ReadonlySet<string>) => void;
};

function stubSectionKey(id: string): string { return `section:${id}`; }
function stubItemKey(id: string): string { return `item:${id}`; }

export function MacSourceList({ sections, label = "Sidebar", className = "", selectedId, onSelectionChange, selectedSectionId, onSectionSelectionChange, expandedSectionIds, onExpandedSectionIdsChange }: MacSourceListProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());
  const collapsibleIds = sections.filter((section) => section.title !== undefined && (section.collapsible ?? false)).map((section) => section.id);
  const controlledExpandedIds = expandedSectionIds === undefined ? undefined : new Set(expandedSectionIds);
  const expandedIds = collapsibleIds.filter((id) => controlledExpandedIds === undefined ? !collapsedIds.has(id) : controlledExpandedIds.has(id));
  const expandedKeys = expandedIds.map(stubSectionKey);
  const selectedSection = sections.find((section) => section.selectable === true && section.id === selectedSectionId);
  let selectedKey: Key | undefined = selectedSection === undefined ? undefined : stubSectionKey(selectedSection.id);
  if (selectedKey === undefined) {
    for (const section of sections) {
      if (section.items.some((item) => item.id === selectedId)) {
        selectedKey = stubItemKey(selectedId ?? "");
        break;
      }
    }
  }

  function handleSelectionChange(selection: Selection) {
    if (selection === "all") return;
    const key = [...selection][0];
    for (const section of sections) {
      if (section.selectable === true && key === stubSectionKey(section.id)) {
        onSectionSelectionChange?.(section.id);
        return;
      }
      const item = section.items.find((candidate) => key === stubItemKey(candidate.id));
      if (item !== undefined) {
        onSelectionChange(item.id);
        return;
      }
    }
  }

  function handleExpandedChange(keys: Set<Key>) {
    const nextExpandedIds = new Set(collapsibleIds.filter((id) => keys.has(stubSectionKey(id))));
    if (expandedSectionIds === undefined) setCollapsedIds(new Set(collapsibleIds.filter((id) => !nextExpandedIds.has(id))));
    onExpandedSectionIdsChange?.(nextExpandedIds);
  }

  function itemRows(section: MacSourceListSection): readonly ReactNode[] {
    return section.items.map((item, index) => {
      const leadClass = section.title === undefined && index === 0
        ? `mc-sidebar-section${section.className !== undefined ? ` ${section.className}` : ""} `
        : "";
      return (
        <TreeItem
          key={item.id}
          id={stubItemKey(item.id)}
          textValue={item.label}
          className={`${leadClass}mc-sidebar-item${selectedId === item.id ? " mc-selected" : ""}${item.indent ? " mc-indent" : ""}`}
          onPress={(event) => { if (event.pointerType !== "keyboard" && event.target instanceof HTMLElement) event.target.focus(); }}
        >
          <TreeItemContent>
            {item.icon !== undefined ? <span className="mc-sidebar-item-icon" aria-hidden="true">{item.icon}</span> : null}
            <span className="mc-sidebar-item-label">{item.label}</span>
            {item.badge !== undefined ? <small className="mc-sidebar-item-badge">{item.badge}</small> : null}
          </TreeItemContent>
        </TreeItem>
      );
    });
  }

  return (
    <Tree
      aria-label={label}
      className={`mc-sidebar-tree ${className}`.trim()}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={selectedKey === undefined ? [] : [selectedKey]}
      onSelectionChange={handleSelectionChange}
      expandedKeys={expandedKeys}
      onExpandedChange={handleExpandedChange}
    >
      {sections.flatMap((section) => {
        if (section.title === undefined) return itemRows(section);
        const title = section.title;
        const collapsible = section.collapsible ?? false;
        const expanded = expandedIds.includes(section.id);
        const extraClass = section.className !== undefined ? ` ${section.className}` : "";
        const header = (
          <TreeItem
            key={`section-${section.id}`}
            id={stubSectionKey(section.id)}
            textValue={title}
            className={`mc-sidebar-section mc-sidebar-section-header${section.selectable === true && selectedSectionId === section.id ? " mc-selected" : ""}${extraClass}`}
            onPress={(event) => { if (event.pointerType !== "keyboard" && event.target instanceof HTMLElement) event.target.focus(); }}
          >
            <TreeItemContent>
              <span className="mc-sidebar-section-label"><strong>{title}</strong>{section.count !== undefined ? <small>{section.count}</small> : null}</span>
              {section.action}
              {collapsible ? (
                <Button slot="chevron" className="mc-sidebar-disclosure-button" aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}>
                  <span className="mc-sidebar-disclosure" data-expanded={expanded ? "" : undefined} aria-hidden="true" />
                </Button>
              ) : null}
            </TreeItemContent>
            {collapsible ? itemRows(section) : null}
          </TreeItem>
        );
        return collapsible ? [header] : [header, ...itemRows(section)];
      })}
    </Tree>
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
  readonly ariaLabel?: string;
  readonly items: readonly MacListRow[];
};

function stubRowTextValue(row: MacListRow): string {
  if (row.textValue !== undefined) return row.textValue;
  return typeof row.label === "string" ? row.label : row.id;
}

type StubNormalizedAccessibleTitle = {
  readonly node: ReactNode;
  readonly renderable: boolean;
  readonly text: string;
};

const stubNormalizedIterableTitles = new WeakMap<object, StubNormalizedAccessibleTitle>();

function stubNormalizedTitleText(parts: readonly StubNormalizedAccessibleTitle[]) {
  return parts.map((part) => part.text).filter((text) => text !== "").join(" ");
}

function stubNormalizeTitleParts(parts: Iterable<ReactNode>): StubNormalizedAccessibleTitle {
  const normalized = Array.from(parts, stubNormalizeAccessibleTitle);
  return {
    node: normalized.map((part, index) => <Fragment key={index}>{part.node}</Fragment>),
    renderable: normalized.some((part) => part.renderable),
    text: stubNormalizedTitleText(normalized),
  };
}

function stubNormalizeAccessibleTitle(title: ReactNode): StubNormalizedAccessibleTitle {
  if (title === null || title === undefined || typeof title === "boolean") {
    return { node: title, renderable: false, text: "" };
  }
  if (typeof title === "string") {
    const text = title.trim();
    return { node: title, renderable: text !== "", text };
  }
  if (typeof title === "number" || typeof title === "bigint") {
    return { node: title, renderable: true, text: String(title) };
  }
  if (Array.isArray(title)) return stubNormalizeTitleParts(title);
  if (isValidElement<{ readonly children?: ReactNode }>(title)) {
    if (title.type === Fragment) {
      const children = stubNormalizeAccessibleTitle(title.props.children);
      return { ...children, node: cloneElement(title, undefined, children.node) };
    }
    if (typeof title.type === "string") {
      const props = title.props as {
        readonly "aria-hidden"?: boolean | string;
        readonly "aria-label"?: string;
        readonly alt?: string;
        readonly children?: ReactNode;
        readonly dangerouslySetInnerHTML?: unknown;
      };
      const children = stubNormalizeAccessibleTitle(props.children);
      const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";
      const ownLabel = (props["aria-label"] ?? props.alt ?? "").trim();
      return {
        node: cloneElement(title, undefined, children.node),
        renderable: children.renderable || ownLabel !== "" || props.dangerouslySetInnerHTML !== undefined,
        text: hidden ? "" : ownLabel || children.text,
      };
    }
    return { node: title, renderable: true, text: "" };
  }
  if (typeof title === "object" && Symbol.iterator in title) {
    const cached = stubNormalizedIterableTitles.get(title);
    if (cached !== undefined) return cached;
    const normalized = stubNormalizeTitleParts(title as Iterable<ReactNode>);
    stubNormalizedIterableTitles.set(title, normalized);
    return normalized;
  }
  return { node: title, renderable: true, text: "" };
}

function stubNonEmptyLabel(label: string | undefined) {
  const normalized = label?.trim() ?? "";
  return normalized === "" ? null : normalized;
}

function stubAccessibleTitleLabel(explicit: string | undefined, derived: string, fallback: string) {
  return stubNonEmptyLabel(explicit) ?? stubNonEmptyLabel(derived) ?? stubNonEmptyLabel(fallback) ?? "Section";
}

export function MacList({ ariaLabel, className = "", emptyState = "No items", selectedId, sections, onSelectionChange }: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly emptyState?: ReactNode;
  readonly selectedId: string | null;
  readonly sections: readonly MacListSection[];
  readonly onSelectionChange: (id: string | null) => void;
}) {
  function handleSelectionChange(selection: Selection) {
    if (selection === "all") return;
    const next = [...selection][0];
    onSelectionChange(typeof next === "string" ? next : null);
  }

  function rows(section: MacListSection): readonly ReactNode[] {
    return section.items.map((row) => (
      <ListBoxItem
        key={row.id}
        id={row.id}
        textValue={stubRowTextValue(row)}
        className="mc-list-row"
        isDisabled={row.disabled}
        onAction={row.onAction}
      >
        {row.icon !== undefined ? <span className="mc-list-row-icon" aria-hidden="true">{row.icon}</span> : null}
        <span className="mc-list-row-copy">
          <span className="mc-list-row-label">{row.label}</span>
          {row.description !== undefined ? <small>{row.description}</small> : null}
        </span>
        {row.secondary !== undefined ? <span className="mc-list-row-secondary">{row.secondary}</span> : null}
        {row.accessory !== undefined ? <span className="mc-list-row-accessory">{row.accessory}</span> : null}
      </ListBoxItem>
    ));
  }

  return (
    <ListBox
      aria-label={ariaLabel}
      className={`mc-list ${className}`.trim()}
      selectionMode="single"
      selectionBehavior="replace"
      selectedKeys={selectedId === null ? new Set<Key>() : new Set<Key>([selectedId])}
      onSelectionChange={handleSelectionChange}
      renderEmptyState={() => <div className="mc-list-empty">{emptyState}</div>}
    >
      {sections.flatMap((section) => {
        const sectionRows = rows(section);
        const normalizedTitle = stubNormalizeAccessibleTitle(section.title);
        const explicitLabel = stubNonEmptyLabel(section.ariaLabel);
        if (!normalizedTitle.renderable && explicitLabel === null) return sectionRows;
        const accessibleLabel = stubAccessibleTitleLabel(explicitLabel ?? undefined, normalizedTitle.text, section.id);
        return [
          <ListBoxSection key={section.id} id={section.id} aria-label={accessibleLabel} className="mc-list-section">
            {normalizedTitle.renderable ? <Header aria-label={accessibleLabel} className="mc-list-section-title">{normalizedTitle.node}</Header> : null}
            {sectionRows}
          </ListBoxSection>,
        ];
      })}
    </ListBox>
  );
}

export function MacDisclosureGroup({ ariaLabel, children, className = "", disabled = false, expanded, title, onExpandedChange }: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly expanded: boolean;
  readonly title: ReactNode;
  readonly onExpandedChange: (expanded: boolean) => void;
}) {
  const normalizedTitle = stubNormalizeAccessibleTitle(title);
  const accessibleLabel = stubAccessibleTitleLabel(ariaLabel, normalizedTitle.text, "Disclosure");
  return (
    <section className={`mc-disclosure ${className}`.trim()} data-expanded={expanded ? "" : undefined}>
      <h3 className="mc-disclosure-heading"><button type="button" aria-label={accessibleLabel} className="mc-disclosure-trigger" disabled={disabled} aria-expanded={expanded} onClick={() => onExpandedChange(!expanded)}><span className="mc-disclosure-chevron" aria-hidden="true" /><span>{normalizedTitle.node}</span></button></h3>
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
  const [focusedOptionId, setFocusedOptionId] = useState<string | null>(null);
  const enabledFocusedId = options.find(
    (option) => option.id === focusedOptionId && !(option.disabled ?? false),
  )?.id;
  const selectedTabStopId = disabled
    ? undefined
    : options.find((option) => option.id === value && !(option.disabled ?? false))?.id
      ?? options.find((option) => !(option.disabled ?? false))?.id;
  const tabStopId = disabled ? undefined : enabledFocusedId ?? selectedTabStopId;

  function handleSelectionChange(selection: Selection) {
    if (selection === "all") return;
    const next = [...selection][0];
    if (typeof next === "string" && next !== value) onChange(next);
  }

  return (
    <ToggleButtonGroup
      aria-label={ariaLabel}
      className={`mc-segmented-control ${className}`.trim()}
      isDisabled={disabled}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set<Key>([value])}
      onSelectionChange={handleSelectionChange}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="mc-segmented-option"
          excludeFromTabOrder={option.id !== tabStopId}
          isDisabled={option.disabled}
          onFocus={() => setFocusedOptionId(option.id)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.parentElement?.contains(nextTarget)) {
              setFocusedOptionId(null);
            }
          }}
        >
          {option.icon !== undefined ? <span className="mc-segmented-icon" aria-hidden="true">{option.icon}</span> : null}
          <span>{option.label}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
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

function stubFinderIdPart(id: string): string {
  let encoded = "";
  for (let index = 0; index < id.length; index += 1) encoded += id.charCodeAt(index).toString(16).padStart(4, "0");
  return encoded;
}

function stubFinderSectionId(id: string): string { return `finder-section-${stubFinderIdPart(id)}`; }
function stubFinderItemId(sectionId: string, itemId: string): string { return `finder-item-${stubFinderIdPart(sectionId)}-${stubFinderIdPart(itemId)}`; }

// Finder shell mirroring the real package's rendered structure (window label,
// sidebar header/sections, listbox/option roles, and mc-finder-* classes).
export function FinderWindow({ sidebar, sidebarHeader, sidebarVisible, onSidebarVisibleChange, entries, mode, onModeChange, search, selection, onOpen, preview, previewVisible, onPreviewVisibleChange, statusBar, toolbarExtras, title, label, frame, onClose, onMinimize, onZoom, iconColumns }: {
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
  const [uncontrolledPreviewVisible, setUncontrolledPreviewVisible] = useState(true);
  const isPreviewVisible = previewVisible ?? uncontrolledPreviewVisible;
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(() => new Set());
  const [quickLookId, setQuickLookId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const keyboardFocusPending = useRef<string | null>(null);
  const sourceListSections: readonly MacSourceListSection[] = sidebar.map((section) => ({
    id: stubFinderSectionId(section.id),
    title: section.title,
    selectable: section.selected === true || section.onTitleSelect !== undefined,
    collapsible: section.collapsible,
    count: section.count,
    action: section.action,
    className: section.className,
    items: section.items.map((item) => ({ id: stubFinderItemId(section.id, item.id), icon: item.icon, label: item.label, badge: item.badge, indent: item.indent })),
  }));
  const collapsibleSectionIds = sourceListSections.filter((section) => section.title !== undefined && section.collapsible === true).map((section) => section.id);
  const expandedSectionIds = new Set(collapsibleSectionIds.filter((id) => !collapsedSectionIds.has(id)));
  const selectedSectionId = sidebar.find((section) => section.title !== undefined && section.selected)?.id;
  const selectedEntry = entries.find((entry) => entry.id === selection.selectedId) ?? null;
  const quickLookEntry = quickLookId === null ? null : entries.find((entry) => entry.id === quickLookId) ?? null;
  const tabStopId = selectedEntry?.id ?? entries[0]?.id;
  let selectedItemId: string | null = null;
  for (const section of sidebar) {
    const selectedItem = section.items.find((item) => item.selected);
    if (selectedItem !== undefined) {
      selectedItemId = stubFinderItemId(section.id, selectedItem.id);
      break;
    }
  }
  function setSidebarVisibility(visible: boolean) {
    if (sidebarVisible === undefined) setUncontrolledSidebarVisible(visible);
    onSidebarVisibleChange?.(visible);
  }
  function setPreviewVisibility(visible: boolean) {
    if (previewVisible === undefined) setUncontrolledPreviewVisible(visible);
    onPreviewVisibleChange?.(visible);
  }
  function handleSourceSelection(id: string) {
    for (const section of sidebar) {
      if (id === stubFinderSectionId(section.id)) {
        section.onTitleSelect?.();
        return;
      }
      const item = section.items.find((candidate) => id === stubFinderItemId(section.id, candidate.id));
      if (item !== undefined) {
        item.onSelect();
        return;
      }
    }
  }
  function handleExpandedChange(expanded: ReadonlySet<string>) {
    setCollapsedSectionIds(new Set(collapsibleSectionIds.filter((id) => !expanded.has(id))));
  }
  useEffect(() => {
    const pending = keyboardFocusPending.current;
    if (pending === null) return;
    keyboardFocusPending.current = null;
    const content = contentRef.current;
    if (content === null) return;
    if (pending === " content") {
      content.focus();
      return;
    }
    for (const option of content.querySelectorAll<HTMLElement>("[data-mc-entry-id]")) {
      if (option.dataset["mcEntryId"] === pending) {
        option.focus();
        return;
      }
    }
    content.focus();
  });
  function columnsForNavigation(): number {
    if (mode === "list") return 1;
    if (iconColumns !== undefined && iconColumns >= 1) return Math.floor(iconColumns);
    const content = contentRef.current;
    if (content === null) return 1;
    const tracks = window.getComputedStyle(content).gridTemplateColumns.split(" ").filter((track) => track !== "" && track !== "none");
    if (tracks.length > 0) return tracks.length;
    const options = content.querySelectorAll<HTMLElement>("[data-mc-entry-id]");
    const first = options[0];
    if (first === undefined) return 1;
    let columns = 0;
    for (const option of options) {
      if (option.offsetTop !== first.offsetTop) break;
      columns += 1;
    }
    return Math.max(columns, 1);
  }
  function handleContentKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const index = entries.findIndex((entry) => entry.id === selection.selectedId);
    const selected = index >= 0 ? entries[index] : undefined;
    if (event.metaKey && event.key === "ArrowDown") {
      if (selected !== undefined) {
        event.preventDefault();
        keyboardFocusPending.current = " content";
        contentRef.current?.focus();
        onOpen(selected);
      }
      return;
    }
    if (event.key === " ") {
      if (selected !== undefined) {
        event.preventDefault();
        setQuickLookId(selected.id);
      }
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = finderKeyTarget(event.key, index, columnsForNavigation(), entries.length);
    if (next === null) return;
    const entry = entries[next];
    if (entry === undefined) return;
    keyboardFocusPending.current = entry.id;
    selection.onSelect(entry.id);
  }
  return (
    <WindowChrome className="mc-finder-window" label={label ?? title ?? "Finder"} frame={frame} defaultSize={finderDefaultSize} onClose={onClose} onMinimize={onMinimize} onZoom={onZoom}>
      {isSidebarVisible ? <aside className="mc-finder-sidebar">
        <div className="mc-finder-sidebar-top" data-window-drag-handle="">
          <TrafficLights />
        </div>
        {sidebarHeader !== undefined ? <div className="mc-finder-sidebar-header">{sidebarHeader}</div> : null}
        <nav aria-label="Sidebar">
          <MacSourceList
            sections={sourceListSections}
            selectedId={selectedItemId}
            selectedSectionId={selectedSectionId === undefined ? null : stubFinderSectionId(selectedSectionId)}
            onSelectionChange={handleSourceSelection}
            onSectionSelectionChange={handleSourceSelection}
            expandedSectionIds={expandedSectionIds}
            onExpandedSectionIdsChange={handleExpandedChange}
          />
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
                  label={isPreviewVisible ? "Hide Preview" : "Show Preview"}
                  pressed={isPreviewVisible}
                  onPressedChange={setPreviewVisibility}
                >
                  <SystemSymbol name="sidebar.trailing" />
                </ToolbarToggle>
              ) : null}
              <ToolbarSearchBubble value={search.value} onChange={search.onChange} />
            </>
          }
        />
        <div ref={contentRef} role="listbox" aria-label={title ?? "Files"} tabIndex={-1} className={`mc-finder-content mc-${mode}`} onKeyDown={handleContentKeyDown}>
          {entries.map((entry) => (
            <button
              type="button"
              role="option"
              key={entry.id}
              className={`mc-finder-entry${selection.selectedId === entry.id ? " mc-selected" : ""}`}
              aria-selected={selection.selectedId === entry.id}
              tabIndex={entry.id === tabStopId ? 0 : -1}
              data-mc-entry-id={entry.id}
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
      {preview !== undefined && isPreviewVisible ? <aside className="mc-finder-preview">{preview(entries.find((entry) => entry.id === selection.selectedId) ?? null)}</aside> : null}
      {quickLookEntry !== null ? <QuickLook entry={quickLookEntry} onClose={() => setQuickLookId(null)} /> : null}
    </WindowChrome>
  );
}

export function QuickLook({ entry, detail, onClose }: {
  readonly entry: FinderEntry;
  readonly detail?: ReactNode;
  readonly onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const handleModalKeyDown = useModalFocusTrap({ dialogRef: panelRef, onCancel: onClose });
  const metadata = [entry.modified, entry.size].filter((part) => part !== undefined).join(" · ");
  return (
    <div className="mc-quicklook-scrim" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={panelRef} className="mc-quicklook-panel" role="dialog" aria-modal="true" aria-label={`Quick Look ${entry.name}`} onKeyDown={handleModalKeyDown}>
        <header><button type="button" onClick={onClose} aria-label="Close Quick Look">×</button><strong>{entry.name}</strong></header>
        <div>{entry.icon}<h2>{entry.name}</h2>{detail}{metadata ? <small>{metadata}</small> : null}</div>
      </section>
    </div>
  );
}

export function finderKeyTarget(key: string, index: number, columns: number, count: number): number | null {
  if (count === 0) return null;
  if (index < 0 || index >= count) {
    return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" ? 0 : null;
  }
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

function stubChooserSecondaryMenuItems(group: ChooserSecondaryGroup): MenuSpec {
  const items: MenuEntry[] = [];
  for (const [sectionIndex, section] of group.sections.entries()) {
    if (sectionIndex > 0) items.push({ kind: "separator", id: `chooser:${section.id}:separator` });
    if (section.label !== undefined) items.push({ kind: "section", id: `chooser:${section.id}`, label: section.label });
    let previousIsRadio: boolean | undefined;
    for (const [commandIndex, command] of section.commands.entries()) {
      const isRadio = command.checked !== undefined;
      if (commandIndex > 0 && isRadio !== previousIsRadio) {
        items.push({ kind: "separator", id: `chooser:${section.id}:semantic-boundary:${command.id}` });
      }
      items.push({
        kind: "action",
        id: `chooser:${section.id}:${command.id}`,
        label: command.title,
        detail: command.caption,
        checked: command.checked,
        icon: command.checked === true || command.symbol === undefined ? undefined : <SystemSymbol name={command.symbol} />,
        onSelect: command.onSelect,
      });
      previousIsRadio = isRadio;
    }
  }
  return items;
}

function StubChooserSecondaryMenu({ group }: { readonly group: ChooserSecondaryGroup }) {
  const hasActiveCommand = group.sections.some((section) => section.commands.some((command) => command.checked === true));
  return (
    <MacMenu
      className={`mc-chooser-secondary${hasActiveCommand ? " is-selected" : ""}`}
      items={stubChooserSecondaryMenuItems(group)}
      label={group.label}
      popover={{ className: "mc-chooser-secondary-menu", placement: "bottom end" }}
      trigger={(
        <>
          <SystemSymbol name="square.grid.2x2" />
          <span>
            <strong>{group.label}</strong>
            {hasActiveCommand && group.activeCaption !== undefined
              ? <small>{group.activeCaption}</small>
              : group.caption !== undefined ? <small>{group.caption}</small> : null}
          </span>
          <SystemSymbol name="chevron.down" />
        </>
      )}
      triggerClassName="mc-chooser-secondary-trigger"
      triggerLabel={group.label}
    />
  );
}

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
  function handleStorage(event: StorageEvent) {
    if (event.key === key || event.key === null) notify();
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
    try { window.localStorage.setItem(key, JSON.stringify(ids)); } catch { /* storage is optional */ }
    notify();
  }
  return {
    key,
    useStoredIds: () => useSyncExternalStore(subscribe, read, () => empty),
    read,
    add: (id) => { const ids = read(); if (!ids.includes(id)) write([...ids, id]); },
    remove: (id) => { const ids = read(); if (ids.includes(id)) write(ids.filter((candidate) => candidate !== id)); },
  };
}

export function ChooserWindow({ title, subtitle, finePrint, windowTitle, toolbarExtras, choices, selected, onSelect, onActivate, secondaryGroup, footer, label, frame, onClose, onMinimize, onZoom }: {
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
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(selected ?? choices[0]?.id ?? null);
  const active = choices.find((choice) => choice.id === selected) ?? null;
  const resolvedFocusId = choices.some((choice) => choice.id === focusedId) ? focusedId : choices[0]?.id ?? null;
  function focusChoice(id: string) {
    window.requestAnimationFrame(() => {
      const list = listRef.current;
      if (list === null) return;
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
    if (next === undefined) return;
    onSelect(next.id);
    setFocusedId(next.id);
    focusChoice(next.id);
  }
  return (
    <WindowChrome className="mc-chooser-window" label={label ?? title} frame={frame} onClose={onClose} onMinimize={onMinimize} onZoom={onZoom}>
      <header className="mc-chooser-toolbar" data-window-drag-handle=""><TrafficLights /><strong>{windowTitle ?? ""}</strong><div className="mc-chooser-toolbar-actions">{toolbarExtras}</div></header>
      <header className="mc-chooser-heading"><h1>{title}</h1><p>{subtitle}</p>{finePrint !== undefined ? <small>{finePrint}</small> : null}</header>
      <div className="mc-chooser-body">
        <div className={`mc-chooser-catalog${secondaryGroup !== undefined ? " mc-has-secondary" : ""}`}>
          <div ref={listRef} className="mc-chooser-filmstrip" role="listbox" aria-label={title}>
            {choices.map((choice) => (
              <button
                type="button"
                role="option"
                aria-selected={choice.id === selected}
                tabIndex={choice.id === resolvedFocusId ? 0 : -1}
                data-mc-choice-id={choice.id}
                className="mc-chooser-choice"
                key={choice.id}
                onClick={() => { onSelect(choice.id); setFocusedId(choice.id); }}
                onDoubleClick={() => onActivate?.(choice.id)}
                onKeyDown={(event) => handleChoiceKeyDown(event, choice.id)}
              >
                <SystemSymbol name={choice.symbol} /><span className="mc-chooser-choice-copy"><strong>{choice.title}</strong><small>{choice.caption}</small></span>
              </button>
            ))}
          </div>
          {secondaryGroup !== undefined ? <StubChooserSecondaryMenu group={secondaryGroup} /> : null}
        </div>
        <section className="mc-chooser-detail" aria-live="polite">{active?.preview}</section>
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

type StubWindowModalKind = "alert" | "sheet";
type StubModalOwner = { readonly element: HTMLElement; readonly scope: "desktop" | "window" };
type StubSuppressionAttribute = "aria-hidden" | "inert";
type StubSuppressionState = {
  count: number;
  readonly baselineAriaHidden: string | null;
  readonly baselineInert: string | null;
  readonly changedAttributes: Set<StubSuppressionAttribute>;
  readonly observer: MutationObserver;
};
type StubModalOwnerStack = {
  readonly layers: HTMLDivElement[];
  readonly owner: StubModalOwner;
  readonly suppressed: Set<HTMLElement>;
  readonly ownerObserver: MutationObserver;
  readonly bodyObserver: MutationObserver | null;
};

const stubSuppressionStates = new WeakMap<HTMLElement, StubSuppressionState>();
const stubModalOwnerStacks = new WeakMap<HTMLElement, StubModalOwnerStack>();

function stubRecordSuppressionMutations(state: StubSuppressionState, records: readonly MutationRecord[]) {
  for (const record of records) {
    if (record.attributeName === "aria-hidden" || record.attributeName === "inert") {
      state.changedAttributes.add(record.attributeName);
    }
  }
}

function stubRestoreAttribute(element: HTMLElement, name: StubSuppressionAttribute, value: string | null) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function stubSuppress(element: HTMLElement) {
  const state = stubSuppressionStates.get(element);
  if (state !== undefined) {
    state.count += 1;
    return;
  }
  const baselineAriaHidden = element.getAttribute("aria-hidden");
  const baselineInert = element.getAttribute("inert");
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
  const changedAttributes = new Set<StubSuppressionAttribute>();
  const nextState: StubSuppressionState = {
    count: 1,
    baselineAriaHidden,
    baselineInert,
    changedAttributes,
    observer: new MutationObserver((records) => stubRecordSuppressionMutations(nextState, records)),
  };
  stubSuppressionStates.set(element, nextState);
  nextState.observer.observe(element, {
    attributeFilter: ["aria-hidden", "inert"],
    attributes: true,
  });
}

function stubRestore(element: HTMLElement) {
  const state = stubSuppressionStates.get(element);
  if (state === undefined) return;
  state.count -= 1;
  if (state.count > 0) return;
  stubSuppressionStates.delete(element);
  stubRecordSuppressionMutations(state, state.observer.takeRecords());
  state.observer.disconnect();
  if (!state.changedAttributes.has("inert") && element.getAttribute("inert") === "") {
    stubRestoreAttribute(element, "inert", state.baselineInert);
  }
  if (!state.changedAttributes.has("aria-hidden") && element.getAttribute("aria-hidden") === "true") {
    stubRestoreAttribute(element, "aria-hidden", state.baselineAriaHidden);
  }
}

function stubReconcileModalStack(stack: StubModalOwnerStack) {
  const topLayer = stack.layers.at(-1);
  const desired = new Set<HTMLElement>();
  for (const child of stack.owner.element.children) {
    if (child instanceof HTMLElement && child !== topLayer) desired.add(child);
  }
  if (stack.owner.scope === "desktop" && stack.owner.element !== document.body) {
    let branch: HTMLElement = stack.owner.element;
    while (branch.parentElement !== null && branch.parentElement !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) desired.add(sibling);
      }
      branch = branch.parentElement;
    }
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === branch || child.contains(stack.owner.element)) continue;
      desired.add(child);
    }
  }

  for (const element of stack.suppressed) {
    if (!desired.has(element)) {
      stubRestore(element);
      stack.suppressed.delete(element);
    }
  }
  for (const element of desired) {
    if (!stack.suppressed.has(element)) {
      stubSuppress(element);
      stack.suppressed.add(element);
    }
  }
}

function stubRegisterModalLayer(owner: StubModalOwner, layer: HTMLDivElement) {
  let stack = stubModalOwnerStacks.get(owner.element);
  if (stack === undefined) {
    const ownerObserver = new MutationObserver(() => {
      const current = stubModalOwnerStacks.get(owner.element);
      if (current !== undefined) stubReconcileModalStack(current);
    });
    const bodyObserver = owner.scope === "desktop" && owner.element !== document.body
      ? new MutationObserver(() => {
          const current = stubModalOwnerStacks.get(owner.element);
          if (current !== undefined) stubReconcileModalStack(current);
        })
      : null;
    stack = { layers: [], owner, suppressed: new Set(), ownerObserver, bodyObserver };
    stubModalOwnerStacks.set(owner.element, stack);
    ownerObserver.observe(owner.element, { childList: true });
    bodyObserver?.observe(document.body, { childList: true, subtree: true });
  }
  stack.layers.push(layer);
  stubReconcileModalStack(stack);

  return () => {
    const current = stubModalOwnerStacks.get(owner.element);
    if (current === undefined) return;
    const index = current.layers.lastIndexOf(layer);
    if (index !== -1) current.layers.splice(index, 1);
    if (current.layers.length > 0) {
      stubReconcileModalStack(current);
      return;
    }
    current.ownerObserver.disconnect();
    current.bodyObserver?.disconnect();
    for (const element of current.suppressed) stubRestore(element);
    current.suppressed.clear();
    stubModalOwnerStacks.delete(owner.element);
  };
}

function stubManagedKeyWindow(windowId: string | null): HTMLElement | null {
  if (windowId === null) return null;
  return [...document.querySelectorAll<HTMLElement>(".mac-window[data-window-id]")]
    .find((candidate) => candidate.dataset.windowId === windowId) ?? null;
}

function stubResolveModalOwner({ allowDesktopFallback, anchor, fallbackFocus, keyWindowId, presentationScope }: {
  readonly allowDesktopFallback: boolean;
  readonly anchor: HTMLElement | null;
  readonly fallbackFocus: HTMLElement | null;
  readonly keyWindowId: string | null;
  readonly presentationScope: "automatic" | "desktop";
}): StubModalOwner | null {
  if (presentationScope === "automatic") {
    const nearestWindow = fallbackFocus?.closest<HTMLElement>(".mac-window")
      ?? anchor?.closest<HTMLElement>(".mac-window")
      ?? stubManagedKeyWindow(keyWindowId)
      ?? document.querySelector<HTMLElement>('.mac-window[data-key-window="true"]');
    if (nearestWindow !== null) return { element: nearestWindow, scope: "window" };
  }
  if (!allowDesktopFallback) return null;
  return { element: document.querySelector<HTMLElement>(".desktop-canvas") ?? document.body, scope: "desktop" };
}

function stubIsContentEditableTarget(target: Element) {
  const editingBoundary = target.closest<HTMLElement>("[contenteditable]");
  if (editingBoundary === null) return target instanceof HTMLElement && target.isContentEditable;
  const value = editingBoundary.getAttribute("contenteditable")?.toLowerCase();
  if (value === "false") return false;
  if (value === "" || value === "true" || value === "plaintext-only") return true;
  return editingBoundary.isContentEditable;
}

function StubModalLayer({ ariaDescribedBy, ariaLabel, ariaLabelledBy, children, className, dialogRef, fallbackFocusRef, initialFocusSelector, kind, onCancel, onDefault, owner, role }: {
  readonly ariaDescribedBy?: string;
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly kind: StubWindowModalKind;
  readonly onCancel?: () => void;
  readonly onDefault?: () => void;
  readonly owner: StubModalOwner;
  readonly role: "alertdialog" | "dialog";
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const handleFocusTrapKeyDown = useModalFocusTrap({
    dialogRef,
    fallbackFocusRef,
    ...(initialFocusSelector === undefined ? {} : { initialFocusSelector }),
    ownerElement: owner.element,
    onCancel: onCancel ?? (() => {}),
  });
  useEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    return stubRegisterModalLayer(owner, layer);
  }, [owner]);
  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const target = event.target instanceof Element ? event.target : null;
    const consumesReturn = target !== null && (
      target.closest("button, select, textarea, a[href]") instanceof HTMLElement
      || stubIsContentEditableTarget(target)
    );
    if (event.key === "Enter" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !consumesReturn && onDefault !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onDefault();
      return;
    }
    handleFocusTrapKeyDown(event);
  }
  return (
    <div
      ref={layerRef}
      className={`mc-window-modal-layer mc-window-modal-layer-${kind} mc-window-modal-layer-${owner.scope}`}
      data-modal-kind={kind}
      data-modal-scope={owner.scope}
    >
      <div className="mc-window-modal-scrim" role="presentation" />
      <section
        ref={dialogRef}
        className={className}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

function StubWindowModalHost({ allowDesktopFallback = false, ariaDescribedBy, ariaLabel, ariaLabelledBy, children, className, fallbackFocusRef, initialFocusSelector, kind, onCancel, onDefault, open, presentationScope = "automatic", role }: {
  readonly allowDesktopFallback?: boolean;
  readonly ariaDescribedBy?: string;
  readonly ariaLabel?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly kind: StubWindowModalKind;
  readonly onCancel?: () => void;
  readonly onDefault?: () => void;
  readonly open: boolean;
  readonly presentationScope?: "automatic" | "desktop";
  readonly role: "alertdialog" | "dialog";
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const manager = useContext(StubManagerContext);
  const [owner, setOwner] = useState<StubModalOwner | null>(null);
  useEffect(() => {
    if (!open) {
      setOwner(null);
      return;
    }
    setOwner(stubResolveModalOwner({
      allowDesktopFallback,
      anchor: anchorRef.current,
      fallbackFocus: fallbackFocusRef?.current ?? null,
      keyWindowId: manager?.keyWindowId ?? null,
      presentationScope,
    }));
  }, [allowDesktopFallback, fallbackFocusRef, manager?.keyWindowId, open, presentationScope]);
  return (
    <>
      <span ref={anchorRef} className="mc-window-modal-anchor" aria-hidden="true" />
      {!open || owner === null ? null : createPortal(
        <StubModalLayer
          ariaDescribedBy={ariaDescribedBy}
          ariaLabel={ariaLabel}
          ariaLabelledBy={ariaLabelledBy}
          className={className}
          dialogRef={dialogRef}
          fallbackFocusRef={fallbackFocusRef}
          initialFocusSelector={initialFocusSelector}
          kind={kind}
          onCancel={onCancel}
          onDefault={onDefault}
          owner={owner}
          role={role}
        >
          {children}
        </StubModalLayer>,
        owner.element,
      )}
    </>
  );
}

export function Sheet({ open, onClose, label, fallbackFocusRef, initialFocusSelector, children }: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly label?: string;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly initialFocusSelector?: string;
  readonly children: ReactNode;
}) {
  return <StubWindowModalHost allowDesktopFallback className="mc-sheet mc-sheet-legacy" role="dialog" ariaLabel={label} fallbackFocusRef={fallbackFocusRef} initialFocusSelector={initialFocusSelector} kind="sheet" onCancel={onClose} open={open}>{children}</StubWindowModalHost>;
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

function stubEnabledAction(actions: readonly StubDialogAction[], predicate: (action: StubDialogAction) => boolean) {
  return actions.find((action) => action.disabled !== true && predicate(action));
}

function stubPerformAndClose(action: StubDialogAction | undefined, onClose: () => void) {
  if (action === undefined) return;
  action.onPress?.();
  onClose();
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

export function MacSheet({ actions, children, fallbackFocusRef, initialFocusSelector, onClose, open, title }: {
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
  const cancelAction = stubEnabledAction(actions, (action) => action.role === "cancel");
  const defaultAction = stubEnabledAction(actions, stubActionIsDefault);
  const resolvedInitialFocus = initialFocusSelector
    ?? (defaultAction === undefined ? ".mc-dialog-action-cancel:not([disabled]), .mc-dialog-action:not([disabled])" : ".mc-dialog-action-default:not([disabled])");
  return (
    <StubWindowModalHost
      className="mc-sheet"
      role="dialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={bodyId}
      fallbackFocusRef={fallbackFocusRef}
      initialFocusSelector={resolvedInitialFocus}
      kind="sheet"
      onCancel={cancelAction === undefined ? undefined : () => stubPerformAndClose(cancelAction, onClose)}
      onDefault={defaultAction === undefined ? undefined : () => stubPerformAndClose(defaultAction, onClose)}
      open={open}
    >
      <header className="mc-sheet-header"><h2 id={titleId}>{title}</h2></header>
      <div className="mc-sheet-body" id={bodyId}>{children}</div>
      <footer className="mc-sheet-footer"><StubDialogActions actions={actions} onClose={onClose} /></footer>
    </StubWindowModalHost>
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
  const cancelAction = stubEnabledAction(actions, (action) => action.role === "cancel");
  const defaultAction = stubEnabledAction(actions, stubActionIsDefault);
  return (
    <StubWindowModalHost
      allowDesktopFallback
      className={`mc-alert${icon === undefined ? " mc-alert-no-icon" : ""}`}
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={messageId}
      fallbackFocusRef={fallbackFocusRef}
      initialFocusSelector={defaultAction === undefined ? ".mc-dialog-action-cancel:not([disabled]), .mc-dialog-action:not([disabled])" : ".mc-dialog-action-default:not([disabled])"}
      kind="alert"
      onCancel={cancelAction === undefined ? undefined : () => stubPerformAndClose(cancelAction, onClose)}
      onDefault={defaultAction === undefined ? undefined : () => stubPerformAndClose(defaultAction, onClose)}
      open={open}
      presentationScope={presentationScope}
    >
      {icon === undefined ? null : <div className="mc-alert-icon" aria-hidden="true">{icon}</div>}
      <div className="mc-alert-copy">{applicationName === undefined ? null : <div className="mc-alert-application">{applicationName}</div>}<h2 id={titleId}>{title}</h2><div className="mc-alert-message" id={messageId}>{message}</div></div>
      <footer className="mc-alert-footer"><StubDialogActions actions={actions} onClose={onClose} /></footer>
    </StubWindowModalHost>
  );
}

export function SetupAssistant({ steps, currentStep, furthestIndex, onSelectStep, onBack, backLabel = "Back", onContinue, continueLabel = "Continue", continueDisabled = false, modalOpen = false, label, frame, onClose, onMinimize, onZoom, children }: {
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
  const currentName = currentIndex >= 0 ? steps[currentIndex]?.name : undefined;
  return (
    <WindowChrome className="mc-setup-window" label={label ?? "Setup Assistant"} frame={frame} onClose={onClose} onMinimize={onMinimize} onZoom={onZoom}>
      <div className="mc-setup-titlebar"><TrafficLights /></div>
      <div className="mc-setup-underlay" inert={modalOpen ? true : undefined} aria-hidden={modalOpen || undefined}>
        <span className="mc-visually-hidden" aria-live="polite">{currentName}</span>
        <nav className="mc-setup-progress" aria-label="Steps" data-window-drag-handle="">
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isComplete = index < currentIndex || index < furthestIndex;
            return (
              <button
                type="button"
                key={step.id}
                data-no-window-drag=""
                className={isCurrent ? "mc-current" : isComplete ? "mc-complete" : ""}
                disabled={index > furthestIndex}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelectStep(step.id)}
              >
                {step.symbol !== undefined ? <span aria-hidden="true"><SystemSymbol name={step.symbol} /></span> : null}
                {step.name}
              </button>
            );
          })}
        </nav>
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

function StubChatMessageRow({ message }: { readonly message: ChatMessage }) {
  if (message.author.role === "owner") {
    return <div className="mc-chat-message mc-owner"><p className="mc-chat-bubble">{message.body}<small>{message.at}</small></p>{message.status !== undefined ? <small className="mc-chat-status">{message.status}</small> : null}</div>;
  }
  if (message.author.role === "agent") {
    return <div className="mc-chat-message mc-agent">{message.author.icon !== undefined ? <span className="mc-chat-author-icon" aria-hidden="true">{message.author.icon}</span> : <span className="mc-chat-author-icon mc-placeholder" aria-hidden="true" />}<div><span className="mc-chat-author-name">{message.author.name}</span><p className="mc-chat-bubble">{message.body}<small>{message.at}</small></p>{message.status !== undefined ? <small className="mc-chat-status">{message.status}</small> : null}</div></div>;
  }
  return <div className="mc-chat-message mc-system"><p>{message.body}</p><small>{message.at}</small></div>;
}

export function ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", sidebarVisible, onSidebarVisibleChange, toolbarExtras, emptyTranscript, label, frame, onClose, onMinimize, onZoom }: {
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
    <WindowChrome className="mc-chat-window" label={label ?? active?.title ?? "Chat"} frame={frame} onClose={onClose} onMinimize={onMinimize} onZoom={onZoom}>
      {isSidebarVisible ? <aside className="mc-chat-sidebar" aria-label={sidebarLabel}><div className="mc-chat-sidebar-top"><TrafficLights /></div><nav>{conversations.map((conversation) => <button type="button" key={conversation.id} aria-current={conversation.id === activeConversationId ? "true" : undefined} onClick={() => onSelectConversation(conversation.id)}>{conversation.icon}<strong>{conversation.title}</strong></button>)}</nav></aside> : null}
      <section className="mc-chat-main">
        <MacToolbar leading={<>{!isSidebarVisible ? <TrafficLights /> : null}<ToolbarButton label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"} pressed={isSidebarVisible} onClick={() => setSidebarVisibility(!isSidebarVisible)}><SystemSymbol name="sidebar.left" /></ToolbarButton></>} title={active?.title} trailing={<>{search !== undefined ? <ToolbarSearchBubble value={search.value} onChange={search.onChange} label="Search conversation" /> : null}{toolbarExtras}</>} />
        <div className="mc-chat-transcript" role="log" aria-label="Conversation">{active?.messages.length ? active.messages.map((message) => <StubChatMessageRow key={message.id} message={message} />) : emptyTranscript}</div>
        <form className="mc-chat-composer" onSubmit={(event) => { event.preventDefault(); if (composer.value.trim()) composer.onSend(); }}>{composer.accessory}<textarea aria-label={composer.placeholder ?? "Message"} value={composer.value} placeholder={composer.placeholder} onChange={(event) => composer.onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={!composer.value.trim()} aria-label="Send message"><SystemSymbol name="arrow.up" /></button></form>
      </section>
    </WindowChrome>
  );
}

export function useWindowDrag<T extends HTMLElement>(
  _enabled: boolean,
  _handleSelector: string = "[data-window-drag-handle]",
) {
  const windowRef = useRef<T>(null);
  const noop = () => undefined;
  return { windowRef, style: {}, onPointerDown: noop, onPointerMove: noop, onPointerUp: noop, onPointerCancel: noop };
}

const stubFocusableSelector = "button, input, select, textarea, a[href], summary, [contenteditable='true'], [tabindex]";

function stubHasHiddenOrInertAncestor(element: HTMLElement, boundary: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current !== null) {
    if (current.hidden || current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true") return true;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return true;
    if (current === boundary) return false;
    current = current.parentElement;
  }
  return true;
}

function stubIsTabbable(element: HTMLElement, boundary: HTMLElement) {
  if (!element.isConnected || !boundary.contains(element)) return false;
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false;
  if (element instanceof HTMLInputElement && element.type === "hidden") return false;
  if (element.tabIndex < 0) return false;
  return !stubHasHiddenOrInertAncestor(element, boundary);
}

function stubTabbableElements(root: HTMLElement, selector = stubFocusableSelector) {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((element) => stubIsTabbable(element, root));
}

function stubInitialFocusTarget(dialog: HTMLElement, selector: string) {
  return stubTabbableElements(dialog, selector)[0] ?? stubTabbableElements(dialog)[0] ?? dialog;
}

function stubActiveModalDialogs(ownerElement?: HTMLElement) {
  const candidates = ownerElement === undefined
    ? [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    : [...ownerElement.children]
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("mc-window-modal-layer"))
        .flatMap((layer) => [...layer.querySelectorAll<HTMLElement>('[aria-modal="true"]')]);
  return candidates.filter((dialog) => dialog.closest('[inert], [aria-hidden="true"]') === null);
}

function stubFocusTargetOrActiveModal(target: HTMLElement | null, ownerElement?: HTMLElement) {
  const activeDialogs = stubActiveModalDialogs(ownerElement);
  const topDialog = activeDialogs.at(-1);
  if (topDialog !== undefined) {
    if (target !== null && (topDialog === target || topDialog.contains(target))) target.focus();
    else stubInitialFocusTarget(topDialog, stubFocusableSelector).focus();
    return;
  }
  target?.focus();
}

export function useModalFocusTrap({ dialogRef, fallbackFocusRef, focusVersion, initialFocusSelector = stubFocusableSelector, ownerElement, onCancel }: {
  readonly dialogRef: RefObject<HTMLElement | null>;
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
  readonly focusVersion?: string;
  readonly initialFocusSelector?: string;
  /** Limits stacked-modal focus ownership to one window or desktop canvas. */
  readonly ownerElement?: HTMLElement;
  readonly onCancel: () => void;
}) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const fallbackTarget = fallbackFocusRef?.current;
      const target = fallbackTarget?.isConnected ? fallbackTarget : openerRef.current?.isConnected ? openerRef.current : null;
      window.requestAnimationFrame(() => stubFocusTargetOrActiveModal(target, ownerElement));
    };
  }, [fallbackFocusRef, ownerElement]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog === null) return;
      stubInitialFocusTarget(dialog, initialFocusSelector).focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogRef, focusVersion, initialFocusSelector]);

  return function handleModalKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const dialog = dialogRef.current;
    const controls = dialog === null ? [] : stubTabbableElements(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      if (dialog !== null) stubInitialFocusTarget(dialog, initialFocusSelector).focus();
      return;
    }
    if (!(document.activeElement instanceof HTMLElement) || !controls.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}

const stubWarnedMissingSystemSymbols = new Set<string>();

function stubSystemSymbolGlyph(name: SystemSymbolName): string {
  const glyph = getSymbol(name);
  if (glyph !== undefined) return glyph;
  if (!stubWarnedMissingSystemSymbols.has(name)) {
    stubWarnedMissingSystemSymbols.add(name);
    console.warn(`[mac-chrome] Unknown SystemSymbol name: ${name}`);
  }
  return "";
}

export function SystemSymbol({ className = "", name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  const style: (CSSProperties & { readonly "--mc-system-symbol-size"?: string }) | undefined = size === undefined
    ? undefined
    : { "--mc-system-symbol-size": `${size}px` };
  return (
    <span aria-hidden="true" className={`mc-system-symbol ${className}`.trim()} data-system-symbol={name} style={style}>{stubSystemSymbolGlyph(name)}</span>
  );
}
