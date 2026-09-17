"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref, type RefObject } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  type PopoverProps,
} from "react-aria-components";

import { SystemSymbol } from "./system-symbol.tsx";
import { getVisibleDesktopBounds, useDesktopSpace, viewportPointToLocal } from "./desktop-space.tsx";
import { useEmbeddedPresentation } from "./embedded-presentation.tsx";
import "./styles/tokens.css";
import "./styles/popover.css";

type AnchoredPopoverProps = PopoverProps & {
  readonly placement: "bottom start" | "bottom end";
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
};

type PopoverGeometry = {
  readonly left: number;
  readonly top: number;
  readonly maxHeight: number;
  readonly maxWidth: number;
};

function DesktopPopover({ placement, offset = 6, triggerRef, ...props }: AnchoredPopoverProps) {
  const desktop = useDesktopSpace();
  const embedded = useEmbeddedPresentation();
  const canvas = desktop?.canvas ?? null;
  const logical = desktop?.displaySize != null;
  const portalContainer = logical ? canvas ?? undefined : embedded?.portalContainer ?? canvas ?? undefined;
  const portalReady = logical ? canvas !== null
    : embedded !== null ? embedded.portalContainer !== null : desktop === null || canvas !== null;
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<PopoverGeometry | null>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!logical || canvas === null || overlay === null || trigger === null) return;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const start = viewportPointToLocal(canvas, { x: rect.left, y: rect.top });
      const end = viewportPointToLocal(canvas, { x: rect.right, y: rect.bottom });
      const visible = getVisibleDesktopBounds(canvas);
      const horizontalPadding = Math.min(8, (visible.right - visible.left) / 2);
      const verticalPadding = Math.min(8, (visible.bottom - visible.top) / 2);
      const bounds = {
        left: visible.left + horizontalPadding,
        right: visible.right - horizontalPadding,
        top: visible.top + verticalPadding,
        bottom: visible.bottom - verticalPadding,
      };
      const maxWidth = bounds.right - bounds.left;
      const below = Math.max(0, bounds.bottom - Math.max(bounds.top, end.y + offset));
      const above = Math.max(0, Math.min(bounds.bottom, start.y - offset) - bounds.top);
      const flip = overlay.offsetHeight > below && above > below;
      const maxHeight = flip ? above : below;
      const height = Math.min(overlay.offsetHeight, maxHeight);
      const leading = getComputedStyle(trigger).direction === "rtl" ? placement === "bottom end" : placement === "bottom start";
      const width = Math.min(overlay.offsetWidth, maxWidth);
      const left = Math.min(Math.max(bounds.left, leading ? start.x : end.x - width), bounds.right - width);
      const top = Math.min(Math.max(bounds.top, flip ? start.y - offset - height : end.y + offset), bounds.bottom - height);
      setGeometry((current) => current?.left === left && current.top === top && current.maxHeight === maxHeight && current.maxWidth === maxWidth
        ? current : { left, top, maxHeight, maxWidth });
    };
    update();
    const resize = new ResizeObserver(update);
    resize.observe(trigger);
    resize.observe(overlay);
    resize.observe(canvas);
    // A window can move without changing the trigger's layout dimensions.
    const ancestors = new MutationObserver(update);
    let ancestor: HTMLElement | null = trigger;
    while (ancestor !== null) {
      ancestors.observe(ancestor, { attributes: true, attributeFilter: ["style", "class"] });
      if (ancestor === canvas) break;
      ancestor = ancestor.parentElement;
    }
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      resize.disconnect();
      ancestors.disconnect();
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [canvas, desktop?.revision, logical, offset, overlay, placement, triggerRef]);

  if (!portalReady) return null;
  // React Aria mixes viewport trigger rects with layout overlay sizes under
  // transforms. Keep its focus/dismissal semantics but position in canvas units.
  const style: (CSSProperties & { readonly "--mc-popover-available-height"?: string; readonly "--mc-popover-available-width"?: string }) | undefined = logical ? {
    position: "absolute",
    left: geometry?.left ?? 0,
    top: geometry?.top ?? 0,
    bottom: "auto",
    maxHeight: geometry?.maxHeight,
    maxWidth: geometry?.maxWidth,
    "--mc-popover-available-height": geometry === null ? undefined : `${geometry.maxHeight}px`,
    "--mc-popover-available-width": geometry === null ? undefined : `${geometry.maxWidth}px`,
  } : undefined;
  return <Popover {...props} ref={setOverlay} triggerRef={triggerRef}
    UNSTABLE_portalContainer={portalContainer} placement={placement} offset={offset}
    shouldUpdatePosition={!logical} style={style} />;
}

export interface MenuAction {
  readonly kind: "action";
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  /** Right-aligned macOS shortcut notation, for example `⇧⌘N`. */
  readonly shortcut?: string;
  readonly icon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  /** Renders as a link instead of a button. */
  readonly href?: string;
  readonly target?: string;
  /** When set, renders role=menuitemradio with aria-checked. */
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onSelect?: () => void;
}

export type MenuEntry =
  | MenuAction
  | { readonly kind: "separator"; readonly id: string }
  | { readonly kind: "section"; readonly id: string; readonly label: string };

export type MenuSpec = readonly MenuEntry[];

/** Named content layouts keep arbitrary popovers separate from command menus. */
export type MacPopoverLayout = "content" | "status";

/**
 * Content inset applied by MacPopover. `regular` is the native default;
 * specialized compositions must opt into a denser or edge-to-edge surface.
 */
export type MacPopoverContentInset = "regular" | "compact" | "flush";

/** Overlay knobs for MacMenu's popover (react-aria positions and portals it). */
export type MenuPopoverConfig = {
  /** Extra class on the menu surface (alongside `mc-menu-popover`). */
  readonly className?: string;
  /** @default "bottom end" (trailing-aligned under the trigger, the NSMenu default here) */
  readonly placement?: "bottom start" | "bottom end";
  /** Gap between trigger and menu, px. @default 7 */
  readonly offset?: number;
  /** Keep surrounding menu-bar titles interactive while this menu is open. */
  readonly nonModal?: boolean;
};

function MenuActionItem({ entry }: { readonly entry: MenuAction }) {
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
        {entry.icon ?? (entry.checked === true ? (
          <SystemSymbol name="checkmark" />
        ) : null)}
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

type MenuBlock =
  | { readonly kind: "separator"; readonly id: string }
  | { kind: "group"; readonly id: string; readonly label?: string; readonly entries: MenuAction[] };

/* Group the flat MenuSpec for react-aria: a "section" label heads a group that
   runs to the next separator/section; separators split groups. */
function menuBlocks(items: MenuSpec): readonly MenuBlock[] {
  const blocks: MenuBlock[] = [];
  let group: MenuBlock & { kind: "group" } | null = null;
  for (const entry of items) {
    if (entry.kind === "separator") {
      group = null;
      blocks.push({ kind: "separator", id: entry.id });
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

function renderBlock(block: MenuBlock): readonly ReactNode[] {
  if (block.kind === "separator") return [<Separator key={block.id} id={block.id} className="menu-separator" />];
  const items = block.entries.map((entry) => <MenuActionItem key={entry.id} entry={entry} />);
  const hasChecked = block.entries.some((entry) => entry.checked !== undefined);
  if (block.label === undefined && !hasChecked) return items;
  // A group with checked entries becomes a single-selection section, which is
  // what gives its items role=menuitemradio + aria-checked.
  const selectionProps = hasChecked
    ? {
        selectionMode: "single" as const,
        selectedKeys: block.entries.filter((entry) => entry.checked === true).map((entry) => entry.id),
      }
    : {};
  return [
    <MenuSection key={block.id} id={block.id} className="mc-menu-group" {...selectionProps}>
      {block.label !== undefined ? <Header className="menu-section-label">{block.label}</Header> : null}
      {items}
    </MenuSection>,
  ];
}

/* ARIA menu-button on react-aria MenuTrigger/Menu/MenuItem: open/close, Esc and
   outside-press dismissal, focus restore, arrow/Home/End navigation, and
   typeahead are library semantics; the popover.css look stays ours. */
export function MacMenu({
  className = "",
  isOpen,
  items,
  label,
  onMenuKeyDown,
  onOpenChange,
  onTriggerPointerEnter,
  popover,
  trigger,
  triggerClassName = "",
  triggerLabel,
}: {
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className={`mc-menu ${className}`.trim()} onPointerEnter={onTriggerPointerEnter}>
      <MenuTrigger {...controlledState} onOpenChange={onOpenChange}>
        <Button ref={triggerRef} aria-label={triggerLabel} className={`mc-menu-trigger ${triggerClassName}`.trim()}>{trigger}</Button>
        <DesktopPopover triggerRef={triggerRef} isNonModal={popover?.nonModal} placement={popover?.placement ?? "bottom end"} offset={popover?.offset ?? 7}>
          {/* MenuTrigger injects aria-labelledby (the trigger), which would
              outrank the label prop; blank it so `label` names the menu. */}
          <div className="mc-menu-key-scope" onKeyDown={onMenuKeyDown}>
            <Menu
              aria-label={label}
              aria-labelledby=""
              className={`mc-menu-popover ${popover?.className ?? ""}`.trim()}
            >
              {menuBlocks(items).flatMap(renderBlock)}
            </Menu>
          </div>
        </DesktopPopover>
      </MenuTrigger>
    </div>
  );
}

/**
 * Shared arbitrary-content popover machinery. DialogTrigger supplies the
 * same dismissal and focus-return contract as MacMenu without pretending
 * non-menu content is an ARIA menu.
 */
export function MacPopover({
  children,
  className = "",
  contentInset = "regular",
  isOpen,
  label,
  layout = "content",
  offset = 6,
  onOpenChange,
  placement = "bottom end",
  trigger,
  triggerClassName = "",
  triggerRef,
}: {
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
  const localTriggerRef = useRef<HTMLButtonElement>(null);
  const setTrigger = useCallback((element: HTMLButtonElement | null) => {
    localTriggerRef.current = element;
    if (typeof triggerRef === "function") return triggerRef(element);
    if (triggerRef !== undefined && triggerRef !== null) triggerRef.current = element;
  }, [triggerRef]);
  return (
    <DialogTrigger {...controlledState} onOpenChange={onOpenChange}>
      <Button
        ref={setTrigger}
        aria-label={label}
        className={`mc-popover-trigger ${triggerClassName}`.trim()}
      >
        {trigger}
      </Button>
      <DesktopPopover
        triggerRef={localTriggerRef}
        className={`mc-popover-surface ${className}`.trim()}
        data-popover-layout={layout}
        placement={placement}
        offset={offset}
      >
        <Dialog
          aria-label={label}
          className="mc-popover-dialog"
          data-content-inset={contentInset}
        >
          {children}
        </Dialog>
      </DesktopPopover>
    </DialogTrigger>
  );
}

/* Account-style arbitrary content anchored to a toolbar control. */
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
