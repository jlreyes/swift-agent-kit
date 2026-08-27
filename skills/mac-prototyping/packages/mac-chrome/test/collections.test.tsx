// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { MacDisclosureGroup, MacList } from "../collections.tsx";
import { MacContentUnavailable } from "../content-state.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
          { id: "shared", title: "Shared", items: [{ id: "brief", label: "Brief" }] },
          { id: "zero", title: 0, items: [{ id: "zero-item", label: "Zero item" }] },
        ]}
      />,
    );
  });

  const listbox = container.querySelector<HTMLElement>("[role='listbox']");
  const groups = container.querySelectorAll<HTMLElement>("[role='group']");
  const options = Array.from(container.querySelectorAll<HTMLElement>("[role='option']"));
  const option = (label: string) => options.find((item) => item.textContent === label);
  expect(listbox?.getAttribute("aria-label")).toBe("Documents");
  expect(groups).toHaveLength(2);
  expect(Array.from(groups, (group) => {
    const labelId = group.getAttribute("aria-labelledby") ?? "";
    return document.getElementById(labelId)?.textContent;
  })).toEqual(["Shared", "0"]);
  for (const label of [
    "Draft",
    "Archive",
    "Empty title",
    "Whitespace title",
    "False title",
    "True title",
    "Empty array title",
  ]) {
    expect(option(label)?.closest("[role='group']")).toBeNull();
  }
  expect(option("Brief")?.closest("[role='group']")).toBe(groups[0]);
  expect(option("Zero item")?.closest("[role='group']")).toBe(groups[1]);

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
