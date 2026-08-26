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
