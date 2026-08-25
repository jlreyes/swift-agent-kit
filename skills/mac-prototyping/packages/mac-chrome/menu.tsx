"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Button, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Separator } from "react-aria-components";

import "./styles/tokens.css";
import "./styles/popover.css";

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
          <svg viewBox="0 0 12 12"><path d="m1.8 6.2 2.5 2.6 5.9-6" /></svg>
        ) : null)}
      </span>
      <span className="mc-menu-copy">
        <strong>{entry.label}</strong>
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
  return (
    <div className={`mc-menu ${className}`.trim()} onPointerEnter={onTriggerPointerEnter}>
      <MenuTrigger {...controlledState} onOpenChange={onOpenChange}>
        <Button aria-label={triggerLabel} className={`mc-menu-trigger ${triggerClassName}`.trim()}>{trigger}</Button>
        <Popover isNonModal={popover?.nonModal} placement={popover?.placement ?? "bottom end"} offset={popover?.offset ?? 7}>
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
        </Popover>
      </MenuTrigger>
    </div>
  );
}

/* Details-based popover: no JS, browser handles open/close; ideal for
   account-style menus whose content is arbitrary. */
export function MacDetailsMenu({ children, className = "", summary }: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly summary: ReactNode;
}) {
  return (
    <details className={`mc-details-menu ${className}`.trim()}>
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
