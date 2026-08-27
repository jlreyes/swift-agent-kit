"use client";

import type { ReactNode } from "react";
import {
  Disclosure,
  DisclosurePanel,
  Button as AriaButton,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  type Key,
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
  readonly items: readonly MacListRow[];
};

function rowTextValue(row: MacListRow): string {
  if (row.textValue !== undefined) return row.textValue;
  return typeof row.label === "string" ? row.label : row.id;
}

export function MacList({
  ariaLabel,
  className = "",
  emptyState = "No items",
  selectedId,
  sections,
  onSelectionChange,
}: {
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
      selectedKeys={selectedId === null ? new Set<Key>() : new Set<Key>([selectedId])}
      onSelectionChange={handleSelectionChange}
      renderEmptyState={() => <div className="mc-list-empty">{emptyState}</div>}
    >
      {sections.flatMap((section) => {
        const sectionRows = rows(section);
        // An unnamed ARIA group gives assistive technology no useful boundary.
        // Headerless API sections are visual/data organization only, so expose
        // their options directly under the named listbox.
        if (section.title === undefined || section.title === null) return sectionRows;
        return [
          <ListBoxSection key={section.id} id={section.id} className="mc-list-section">
            <Header className="mc-list-section-title">{section.title}</Header>
            {sectionRows}
          </ListBoxSection>,
        ];
      })}
    </ListBox>
  );
}

export function MacDisclosureGroup({
  children,
  className = "",
  disabled = false,
  expanded,
  title,
  onExpandedChange,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly expanded: boolean;
  readonly title: ReactNode;
  readonly onExpandedChange: (expanded: boolean) => void;
}) {
  return (
    <Disclosure
      className={`mc-disclosure ${className}`.trim()}
      isDisabled={disabled}
      isExpanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <h3 className="mc-disclosure-heading">
        <AriaButton slot="trigger" className="mc-disclosure-trigger">
          <DisclosureIndicator expanded={expanded} />
          <span>{title}</span>
        </AriaButton>
      </h3>
      <DisclosurePanel className="mc-disclosure-panel">{children}</DisclosurePanel>
    </Disclosure>
  );
}
