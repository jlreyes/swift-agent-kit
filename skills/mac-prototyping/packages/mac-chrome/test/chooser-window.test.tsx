// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { ChooserWindow } from "../chooser-window.tsx";

it("routes secondary chooser commands through the shared Mac menu system", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let picked = "";

  await act(async () => {
    root.render(
      <ChooserWindow
        title="Create a project"
        subtitle="Choose a starting point"
        choices={[{ id: "starter", symbol: "doc.text.fill", title: "Starter", caption: "A standard project" }]}
        selected="starter"
        onSelect={() => {}}
        secondaryGroup={{
          label: "More Options",
          caption: "Import or connect instead",
          activeCaption: "Blank project selected",
          sections: [
            {
              id: "templates",
              label: "TEMPLATES",
              commands: [
                {
                  id: "guided",
                  symbol: "sparkles",
                  title: "Guided Project",
                  caption: "Start with helpful prompts.",
                  checked: false,
                  onSelect: () => { picked = "guided"; },
                },
                {
                  id: "blank",
                  symbol: "doc.text.fill",
                  title: "Blank Project",
                  caption: "Start from an empty project.",
                  checked: true,
                  onSelect: () => { picked = "blank"; },
                },
              ],
            },
            {
              id: "import",
              label: "IMPORT",
              commands: [
                {
                  id: "file",
                  symbol: "arrow.down.doc",
                  title: "Import File…",
                  caption: "Open an existing document.",
                  onSelect: () => { picked = "file"; },
                },
              ],
            },
          ],
        }}
        footer={<button type="button">Continue</button>}
      />,
    );
  });

  const window = container.querySelector<HTMLElement>(".mac-window.mc-chooser-window");
  expect(window).toBeTruthy();
  expect(window?.querySelector(".mc-chooser-toolbar[data-window-drag-handle]")).toBeTruthy();
  expect(window?.querySelectorAll(".traffic-lights button")).toHaveLength(3);
  expect(window?.querySelectorAll("[data-window-resize-handle]")).toHaveLength(8);

  const trigger = container.querySelector<HTMLButtonElement>("button[aria-label='More Options']");
  expect(trigger).toBeTruthy();
  expect(trigger?.textContent).toContain("Blank project selected");
  expect(container.querySelector(".mc-chooser-secondary.is-selected")).toBeTruthy();

  await act(async () => trigger?.click());

  const menu = document.querySelector<HTMLElement>("[role='menu'][aria-label='More Options']");
  expect(menu).toBeTruthy();
  expect(Array.from(menu?.querySelectorAll(".menu-section-label") ?? []).map((label) => label.textContent)).toEqual([
    "TEMPLATES",
    "IMPORT",
  ]);
  expect(menu?.querySelectorAll(".menu-separator")).toHaveLength(1);
  expect(menu?.textContent).toContain("Start with helpful prompts.");
  expect(menu?.querySelector("[data-key='chooser:templates:guided'] [data-system-symbol='sparkles']")).toBeTruthy();
  expect(menu?.querySelector("[data-key='chooser:templates:blank']")?.getAttribute("role")).toBe("menuitemradio");
  expect(menu?.querySelector("[data-key='chooser:templates:blank']")?.getAttribute("aria-checked")).toBe("true");

  await act(async () => {
    menu?.querySelector<HTMLElement>("[data-key='chooser:import:file']")?.click();
  });
  expect(picked).toBe("file");
  expect(document.querySelector("[role='menu'][aria-label='More Options']")).toBeNull();
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);

  await act(async () => root.unmount());
  container.remove();
});

it("keeps ordinary commands out of a sibling radio group", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ChooserWindow
        title="Create a project"
        subtitle="Choose a starting point"
        choices={[{ id: "starter", symbol: "doc.text.fill", title: "Starter", caption: "A standard project" }]}
        selected="starter"
        onSelect={() => {}}
        secondaryGroup={{
          label: "More Options",
          sections: [
            {
              id: "mixed",
              label: "OPTIONS",
              commands: [
                {
                  id: "recommended",
                  title: "Recommended template",
                  checked: true,
                  onSelect: () => {},
                },
                {
                  id: "import",
                  title: "Import File…",
                  onSelect: () => {},
                },
              ],
            },
          ],
        }}
        footer={<button type="button">Continue</button>}
      />,
    );
  });

  await act(async () => {
    container.querySelector<HTMLButtonElement>("button[aria-label='More Options']")?.click();
  });

  const menu = document.querySelector<HTMLElement>("[role='menu'][aria-label='More Options']");
  const radio = menu?.querySelector<HTMLElement>("[data-key='chooser:mixed:recommended']");
  const command = menu?.querySelector<HTMLElement>("[data-key='chooser:mixed:import']");
  expect(radio?.getAttribute("role")).toBe("menuitemradio");
  expect(radio?.getAttribute("aria-checked")).toBe("true");
  expect(command?.getAttribute("role")).toBe("menuitem");
  expect(command?.hasAttribute("aria-checked")).toBe(false);
  expect(menu?.querySelectorAll(".menu-separator")).toHaveLength(1);

  await act(async () => root.unmount());
  container.remove();
});
