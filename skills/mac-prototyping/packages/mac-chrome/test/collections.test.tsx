// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getByRole } from "@testing-library/react";
import { expect, it } from "vitest";

import { MacDisclosureGroup, MacList } from "../collections.tsx";
import { MacContentUnavailable } from "../content-state.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function GeneratedSectionTitle() {
  return <span>Generated</span>;
}

function EmptyCustomSectionTitle() {
  return null;
}

it("renders sectioned rows and reports one selected id", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let selectedId: string | null = "inbox";
  await act(async () => {
    root.render(
      <MacList
        ariaLabel="Mailboxes"
        selectedId={selectedId}
        onSelectionChange={(id) => { selectedId = id; }}
        sections={[
          {
            id: "favorites",
            title: "Favorites",
            items: [
              { id: "inbox", label: "Inbox", secondary: "12" },
              { id: "drafts", label: "Drafts", description: "On My Mac" },
            ],
          },
        ]}
      />,
    );
  });

  const options = container.querySelectorAll<HTMLElement>("[role='option']");
  expect(options).toHaveLength(2);
  expect(options[0]?.getAttribute("aria-selected")).toBe("true");
  await act(async () => options[1]?.click());
  expect(selectedId).toBe("drafts");

  await act(async () => root.unmount());
  container.remove();
});

it("groups only sections whose ReactNode title renders an accessible label", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MacList
        ariaLabel="Documents"
        selectedId={null}
        onSelectionChange={() => undefined}
        sections={[
          { id: "recent", items: [{ id: "draft", label: "Draft" }] },
          { id: "archived", title: null, items: [{ id: "archive", label: "Archive" }] },
          { id: "empty", title: "", items: [{ id: "empty-title", label: "Empty title" }] },
          { id: "whitespace", title: "   ", items: [{ id: "whitespace-title", label: "Whitespace title" }] },
          { id: "false", title: false, items: [{ id: "false-title", label: "False title" }] },
          { id: "true", title: true, items: [{ id: "true-title", label: "True title" }] },
          { id: "empty-array", title: [null, false, ""], items: [{ id: "empty-array-title", label: "Empty array title" }] },
          { id: "blank-host", title: <span>   </span>, items: [{ id: "blank-host-title", label: "Blank host title" }] },
          {
            id: "empty-nested",
            title: <><span><></></span></>,
            items: [{ id: "empty-nested-title", label: "Empty nested title" }],
          },
          {
            id: "empty-iterable",
            title: new Set<ReactNode>([null, false, " "]),
            items: [{ id: "empty-iterable-title", label: "Empty iterable title" }],
          },
          { id: "shared", title: "Shared", items: [{ id: "brief", label: "Brief" }] },
          { id: "zero", title: 0, items: [{ id: "zero-item", label: "Zero item" }] },
          {
            id: "nested",
            title: <span><><strong>Nested</strong></></span>,
            items: [{ id: "nested-item", label: "Nested item" }],
          },
          {
            id: "iterable",
            title: new Set<ReactNode>([null, <span key="iterable">Iterable</span>]),
            items: [{ id: "iterable-item", label: "Iterable item" }],
          },
          {
            id: "custom",
            title: <GeneratedSectionTitle />,
            ariaLabel: "Explicit generated label",
            items: [{ id: "custom-item", label: "Custom item" }],
          },
          {
            id: "opaque-fallback",
            title: <GeneratedSectionTitle />,
            items: [{ id: "opaque-fallback-item", label: "Opaque fallback item" }],
          },
          {
            id: "custom-null",
            title: <EmptyCustomSectionTitle />,
            items: [{ id: "custom-null-item", label: "Custom null item" }],
          },
          {
            id: "named-headerless",
            title: null,
            ariaLabel: "Named without header",
            items: [{ id: "named-headerless-item", label: "Named headerless item" }],
          },
        ]}
      />,
    );
  });

  const listbox = container.querySelector<HTMLElement>("[role='listbox']");
  const groups = container.querySelectorAll<HTMLElement>("[role='group']");
  const options = Array.from(container.querySelectorAll<HTMLElement>("[role='option']"));
  const option = (label: string) => options.find((item) => item.textContent === label);
  expect(listbox?.getAttribute("aria-label")).toBe("Documents");
  expect(groups).toHaveLength(8);
  expect(Array.from(groups, (group) => {
    const labelId = group.getAttribute("aria-labelledby") ?? "";
    return group.getAttribute("aria-label") ?? document.getElementById(labelId)?.textContent;
  })).toEqual([
    "Shared",
    "0",
    "Nested",
    "Iterable",
    "Explicit generated label",
    "opaque-fallback",
    "custom-null",
    "Named without header",
  ]);
  for (const label of [
    "Draft",
    "Archive",
    "Empty title",
    "Whitespace title",
    "False title",
    "True title",
    "Empty array title",
    "Blank host title",
    "Empty nested title",
    "Empty iterable title",
  ]) {
    expect(option(label)?.closest("[role='group']")).toBeNull();
  }
  expect(option("Brief")?.closest("[role='group']")).toBe(groups[0]);
  expect(option("Zero item")?.closest("[role='group']")).toBe(groups[1]);
  expect(option("Nested item")?.closest("[role='group']")).toBe(groups[2]);
  expect(option("Iterable item")?.closest("[role='group']")).toBe(groups[3]);
  expect(option("Custom item")?.closest("[role='group']")).toBe(groups[4]);
  expect(option("Opaque fallback item")?.closest("[role='group']")).toBe(groups[5]);
  expect(option("Custom null item")?.closest("[role='group']")).toBe(groups[6]);
  expect(option("Named headerless item")?.closest("[role='group']")).toBe(groups[7]);
  expect(getByRole(container, "group", { name: "Explicit generated label" })).toBe(groups[4]);
  expect(getByRole(container, "group", { name: "opaque-fallback" })).toBe(groups[5]);
  expect(getByRole(container, "group", { name: "Shared" })).toBe(groups[0]);

  await act(async () => root.unmount());
  container.remove();
});

it("materializes a one-shot iterable section title once and reuses its content", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let iterations = 0;
  function* title() {
    iterations += 1;
    yield "Generated";
    yield <strong key="title">Title</strong>;
  }
  const generatedTitle = title();
  const sections = [{
    id: "generated",
    title: generatedTitle,
    items: [{ id: "generated-item", label: "Generated item" }],
  }] as const;

  await act(async () => {
    root.render(
      <MacList
        ariaLabel="Generated documents"
        selectedId={null}
        onSelectionChange={() => undefined}
        sections={sections}
      />,
    );
  });
  expect(container.querySelector("[role='group']")?.getAttribute("aria-label")).toBe("Generated Title");
  expect(container.querySelector(".mc-list-section-title")?.textContent).toBe("GeneratedTitle");
  expect(iterations).toBe(1);

  await act(async () => {
    root.render(
      <MacList
        ariaLabel="Generated documents"
        selectedId={null}
        onSelectionChange={() => undefined}
        sections={sections}
      />,
    );
  });
  expect(container.querySelector("[role='group']")?.getAttribute("aria-label")).toBe("Generated Title");
  expect(container.querySelector(".mc-list-section-title")?.textContent).toBe("GeneratedTitle");
  expect(iterations).toBe(1);

  await act(async () => root.unmount());
  container.remove();
});

it("uses controlled disclosure state and an accessible content-unavailable heading", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let expanded = false;
  await act(async () => {
    root.render(
      <>
        <MacDisclosureGroup expanded={expanded} title="Advanced" onExpandedChange={(value) => { expanded = value; }}>
          <p>Advanced content</p>
        </MacDisclosureGroup>
        <MacContentUnavailable
          icon={<span>!</span>}
          title="No Selection"
          description="Choose an item in the list."
          actions={<button type="button">Refresh</button>}
        />
      </>,
    );
  });

  const trigger = container.querySelector<HTMLButtonElement>(".mc-disclosure-trigger");
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  expect(
    container.querySelector(".mc-disclosure-indicator .mc-system-symbol")?.getAttribute("data-system-symbol"),
  ).toBe("chevron.right");
  expect(container.querySelector(".mc-disclosure-indicator svg")).toBeNull();
  await act(async () => trigger?.click());
  expect(expanded).toBe(true);
  await act(async () => {
    root.render(
      <>
        <MacDisclosureGroup expanded={expanded} title="Advanced" onExpandedChange={(value) => { expanded = value; }}>
          <p>Advanced content</p>
        </MacDisclosureGroup>
        <MacContentUnavailable
          icon={<span>!</span>}
          title="No Selection"
          description="Choose an item in the list."
          actions={<button type="button">Refresh</button>}
        />
      </>,
    );
  });
  expect(
    container.querySelector(".mc-disclosure-indicator .mc-system-symbol")?.getAttribute("data-system-symbol"),
  ).toBe("chevron.down");
  const emptyState = container.querySelector<HTMLElement>(".mc-content-unavailable");
  const heading = container.querySelector<HTMLElement>(".mc-content-unavailable h2");
  expect(emptyState?.getAttribute("aria-labelledby")).toBe(heading?.id);
  expect(emptyState?.textContent).toContain("Choose an item in the list.");

  await act(async () => root.unmount());
  container.remove();
});

it("owns disabled disclosure state at the group while disabling its trigger", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MacDisclosureGroup disabled expanded title="Advanced" onExpandedChange={() => undefined}>
        <p>Advanced content</p>
      </MacDisclosureGroup>,
    );
  });

  const disclosure = container.querySelector<HTMLElement>(".mc-disclosure");
  const trigger = container.querySelector<HTMLButtonElement>(".mc-disclosure-trigger");
  expect(disclosure?.hasAttribute("data-disabled")).toBe(true);
  expect(trigger?.disabled).toBe(true);
  expect(disclosure?.textContent).toContain("Advanced content");

  await act(async () => root.unmount());
  container.remove();
});

it("always gives disclosure triggers a reliable accessible label", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <>
        <MacDisclosureGroup expanded={false} title="" onExpandedChange={() => undefined}>
          Empty title content
        </MacDisclosureGroup>
        <MacDisclosureGroup
          ariaLabel="Formatting options"
          expanded={false}
          title={<span aria-hidden="true">★</span>}
          onExpandedChange={() => undefined}
        >
          Decorative title content
        </MacDisclosureGroup>
        <MacDisclosureGroup
          expanded={false}
          title={<span>Advanced <strong>Options</strong></span>}
          onExpandedChange={() => undefined}
        >
          Nested title content
        </MacDisclosureGroup>
      </>,
    );
  });

  const labels = Array.from(
    container.querySelectorAll<HTMLButtonElement>(".mc-disclosure-trigger"),
    (trigger) => trigger.getAttribute("aria-label"),
  );
  expect(labels).toEqual(["Disclosure", "Formatting options", "Advanced Options"]);

  await act(async () => root.unmount());
  container.remove();
});
