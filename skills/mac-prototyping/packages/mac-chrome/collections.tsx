"use client";

import { Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import {
  Disclosure,
  DisclosurePanel,
  Button as AriaButton,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  type Key,
  type ListBoxProps,
  type Selection,
} from "react-aria-components";

import { DisclosureIndicator } from "./disclosure-indicator.tsx";
import "./styles/tokens.css";
import "./styles/collections.css";

export type MacListRow = {
  readonly id: string;
  readonly label: ReactNode;
  /** Used for typeahead when label is not a string. Defaults to id. */
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
  /** Accessible section name for opaque, decorative, or generated titles. */
  readonly ariaLabel?: string;
  readonly items: readonly MacListRow[];
};

function rowTextValue(row: MacListRow): string {
  if (row.textValue !== undefined) return row.textValue;
  return typeof row.label === "string" ? row.label : row.id;
}

type NormalizedAccessibleTitle = {
  readonly node: ReactNode;
  readonly renderable: boolean;
  readonly text: string;
};

const normalizedIterableTitles = new WeakMap<object, NormalizedAccessibleTitle>();

function normalizedText(parts: readonly NormalizedAccessibleTitle[]): string {
  return parts.map((part) => part.text).filter((text) => text !== "").join(" ");
}

function normalizedParts(parts: Iterable<ReactNode>): NormalizedAccessibleTitle {
  const normalized = Array.from(parts, normalizeAccessibleTitle);
  return {
    node: normalized.map((part, index) => <Fragment key={index}>{part.node}</Fragment>),
    renderable: normalized.some((part) => part.renderable),
    text: normalizedText(normalized),
  };
}

function normalizeAccessibleTitle(title: ReactNode): NormalizedAccessibleTitle {
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
  if (Array.isArray(title)) return normalizedParts(title);
  if (isValidElement<{ readonly children?: ReactNode }>(title)) {
    if (title.type === Fragment) {
      const children = normalizeAccessibleTitle(title.props.children);
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
      const children = normalizeAccessibleTitle(props.children);
      const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";
      const ownLabel = (props["aria-label"] ?? props.alt ?? "").trim();
      return {
        node: cloneElement(title, undefined, children.node),
        renderable: children.renderable || ownLabel !== "" || props.dangerouslySetInnerHTML !== undefined,
        text: hidden ? "" : ownLabel || children.text,
      };
    }
    // Never invoke opaque custom components to discover their output. Preserve
    // them and let the explicit/compatibility aria-label contract name them.
    return { node: title, renderable: true, text: "" };
  }
  if (typeof title === "object" && Symbol.iterator in title) {
    const cached = normalizedIterableTitles.get(title);
    if (cached !== undefined) return cached;
    const normalized = normalizedParts(title as Iterable<ReactNode>);
    normalizedIterableTitles.set(title, normalized);
    return normalized;
  }
  return { node: title, renderable: true, text: "" };
}

function nonEmptyLabel(label: string | undefined): string | null {
  const normalized = label?.trim() ?? "";
  return normalized === "" ? null : normalized;
}

function accessibleTitleLabel(explicit: string | undefined, derived: string, fallback: string): string {
  return nonEmptyLabel(explicit) ?? nonEmptyLabel(derived) ?? nonEmptyLabel(fallback) ?? "Section";
}

export function MacList({
  ariaLabel,
  className = "",
  emptyState = "No items",
  escapeKeyBehavior = "clearSelection",
  selectedId,
  sections,
  onSelectionChange,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly emptyState?: ReactNode;
  readonly escapeKeyBehavior?: ListBoxProps<MacListRow>["escapeKeyBehavior"];
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
        textValue={rowTextValue(row)}
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
      escapeKeyBehavior={escapeKeyBehavior}
      selectedKeys={selectedId === null ? new Set<Key>() : new Set<Key>([selectedId])}
      onSelectionChange={handleSelectionChange}
      renderEmptyState={() => <div className="mc-list-empty">{emptyState}</div>}
    >
      {sections.flatMap((section) => {
        const sectionRows = rows(section);
        const normalizedTitle = normalizeAccessibleTitle(section.title);
        const explicitLabel = nonEmptyLabel(section.ariaLabel);
        // An unnamed ARIA group gives assistive technology no useful boundary.
        // Headerless API sections without an explicit label are visual/data
        // organization only, so expose their options under the named listbox.
        if (!normalizedTitle.renderable && explicitLabel === null) return sectionRows;
        const accessibleLabel = accessibleTitleLabel(explicitLabel ?? undefined, normalizedTitle.text, section.id);
        return [
          <ListBoxSection
            key={section.id}
            id={section.id}
            aria-label={accessibleLabel}
            className="mc-list-section"
          >
            {normalizedTitle.renderable
              ? (
                <Header aria-label={accessibleLabel} className="mc-list-section-title">
                  {normalizedTitle.node}
                </Header>
              )
              : null}
            {sectionRows}
          </ListBoxSection>,
        ];
      })}
    </ListBox>
  );
}

export function MacDisclosureGroup({
  ariaLabel,
  children,
  className = "",
  disabled = false,
  expanded,
  title,
  onExpandedChange,
}: {
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly expanded: boolean;
  readonly title: ReactNode;
  readonly onExpandedChange: (expanded: boolean) => void;
}) {
  const normalizedTitle = normalizeAccessibleTitle(title);
  const accessibleLabel = accessibleTitleLabel(ariaLabel, normalizedTitle.text, "Disclosure");
  return (
    <Disclosure
      className={`mc-disclosure ${className}`.trim()}
      isDisabled={disabled}
      isExpanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <h3 className="mc-disclosure-heading">
        <AriaButton slot="trigger" aria-label={accessibleLabel} className="mc-disclosure-trigger">
          <DisclosureIndicator expanded={expanded} />
          <span>{normalizedTitle.node}</span>
        </AriaButton>
      </h3>
      <DisclosurePanel className="mc-disclosure-panel">{children}</DisclosurePanel>
    </Disclosure>
  );
}
