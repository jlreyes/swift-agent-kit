// @vitest-environment jsdom
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { ChooserWindow, createStoredIdList } from "../chooser-window.tsx";

function StoredIdsProbe({ store }: { readonly store: ReturnType<typeof createStoredIdList> }) {
  return <span data-testid="stored-ids">{store.useStoredIds().join(",")}</span>;
}

function menuItemByText(menu: HTMLElement | null, text: string): HTMLElement | undefined {
  return Array.from(menu?.querySelectorAll<HTMLElement>("[role='menuitem'], [role='menuitemradio']") ?? [])
    .find((item) => item.textContent?.includes(text));
}

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
  expect(menuItemByText(menu, "Guided Project")?.querySelector("[data-system-symbol='sparkles']")).toBeTruthy();
  expect(menuItemByText(menu, "Blank Project")?.getAttribute("role")).toBe("menuitemradio");
  expect(menuItemByText(menu, "Blank Project")?.getAttribute("aria-checked")).toBe("true");

  await act(async () => {
    menuItemByText(menu, "Import File…")?.click();
  });
  expect(picked).toBe("file");
  expect(document.querySelector("[role='menu'][aria-label='More Options']")).toBeNull();
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(trigger));

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
  const radio = menuItemByText(menu, "Recommended template");
  const command = menuItemByText(menu, "Import File…");
  expect(radio?.getAttribute("role")).toBe("menuitemradio");
  expect(radio?.getAttribute("aria-checked")).toBe("true");
  expect(command?.getAttribute("role")).toBe("menuitem");
  expect(command?.hasAttribute("aria-checked")).toBe(false);
  expect(menu?.querySelectorAll(".menu-separator")).toHaveLength(1);

  await act(async () => root.unmount());
  container.remove();
});

it("names every chooser menu entry uniquely for adversarial caller ids", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let picked = "";

  await act(async () => {
    root.render(
      <ChooserWindow
        title="Create a project"
        subtitle="Choose a starting point"
        choices={[{ id: "starter", symbol: "doc.text.fill", title: "Starter", caption: "Standard" }]}
        selected="starter"
        onSelect={() => undefined}
        secondaryGroup={{
          label: "Adversarial Options",
          sections: [
            {
              id: "s",
              label: "FIRST",
              commands: [
                { id: "separator", title: "Separator command", onSelect: () => { picked = "separator"; } },
                { id: "separator:separator", title: "Double separator command", onSelect: () => undefined },
                { id: "semantic-boundary:choice", title: "Boundary-named command", onSelect: () => undefined },
                { id: "choice", title: "Radio choice", checked: true, onSelect: () => undefined },
              ],
            },
            {
              id: "s:separator",
              label: "SECOND",
              commands: [{ id: "final", title: "Final command", onSelect: () => undefined }],
            },
          ],
        }}
        footer={<button type="button">Continue</button>}
      />,
    );
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button[aria-label='Adversarial Options']")?.click();
  });

  const menu = document.querySelector<HTMLElement>("[role='menu'][aria-label='Adversarial Options']");
  const keys = Array.from(menu?.querySelectorAll<HTMLElement>("[data-key]") ?? [], (entry) => entry.dataset["key"]);
  expect(keys.length).toBeGreaterThan(0);
  expect(new Set(keys).size).toBe(keys.length);
  await act(async () => menuItemByText(menu, "Separator command")?.click());
  expect(picked).toBe("separator");

  await act(async () => root.unmount());
  container.remove();
});

it("places separators only between non-empty chooser sections", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ChooserWindow
        title="Create a project"
        subtitle="Choose a starting point"
        choices={[{ id: "starter", symbol: "doc.text.fill", title: "Starter", caption: "Standard" }]}
        selected="starter"
        onSelect={() => undefined}
        secondaryGroup={{
          label: "Sparse Options",
          sections: [
            { id: "empty-leading", label: "EMPTY LEADING", commands: [] },
            { id: "one", label: "ONE", commands: [{ id: "one", title: "First command", onSelect: () => undefined }] },
            { id: "empty-middle-a", label: "EMPTY A", commands: [] },
            { id: "empty-middle-b", commands: [] },
            { id: "two", label: "TWO", commands: [{ id: "two", title: "Second command", onSelect: () => undefined }] },
            { id: "empty-trailing", label: "EMPTY TRAILING", commands: [] },
          ],
        }}
        footer={<button type="button">Continue</button>}
      />,
    );
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button[aria-label='Sparse Options']")?.click();
  });

  const menu = document.querySelector<HTMLElement>("[role='menu'][aria-label='Sparse Options']");
  expect(Array.from(menu?.querySelectorAll(".menu-section-label") ?? [], (label) => label.textContent)).toEqual([
    "ONE",
    "TWO",
  ]);
  const separators = menu?.querySelectorAll<HTMLElement>(".menu-separator") ?? [];
  expect(separators).toHaveLength(1);
  expect(separators[0]?.previousElementSibling).toBeTruthy();
  expect(separators[0]?.nextElementSibling).toBeTruthy();
  expect(separators[0]?.previousElementSibling?.classList.contains("menu-separator")).toBe(false);
  expect(separators[0]?.nextElementSibling?.classList.contains("menu-separator")).toBe(false);

  await act(async () => root.unmount());
  container.remove();
});

it("refreshes stored ids for localStorage.clear but ignores unrelated storage keys", async () => {
  const key = "chooser-test-stored-ids";
  const store = createStoredIdList(key);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const values = new Map<string, string>();
  const storage: Storage = {
    clear: () => values.clear(),
    getItem: (storageKey) => values.get(storageKey) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
    removeItem: (storageKey) => { values.delete(storageKey); },
    setItem: (storageKey, value) => { values.set(storageKey, value); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  window.localStorage.setItem(key, JSON.stringify(["alpha"]));

  await act(async () => {
    root.render(<StoredIdsProbe store={store} />);
  });
  expect(container.querySelector("[data-testid='stored-ids']")?.textContent).toBe("alpha");

  window.localStorage.setItem(key, JSON.stringify(["beta"]));
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));
  });
  expect(container.querySelector("[data-testid='stored-ids']")?.textContent).toBe("alpha");

  window.localStorage.clear();
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
  });
  expect(container.querySelector("[data-testid='stored-ids']")?.textContent).toBe("");

  await act(async () => root.unmount());
  window.localStorage.removeItem(key);
  if (originalLocalStorage === undefined) {
    Reflect.deleteProperty(window, "localStorage");
  } else {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
  }
  container.remove();
});

it.each(["getter", "getItem", "setItem"] as const)("retains reactive stored IDs in memory when localStorage %s is denied", async (deniedOperation) => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const values = new Map<string, string>([["denied-storage", JSON.stringify(["seed"])]]);
  const storage: Storage = {
    clear: () => values.clear(),
    getItem: (key) => {
      if (deniedOperation === "getItem") throw new DOMException("Storage access denied", "SecurityError");
      return values.get(key) ?? null;
    },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
    removeItem: (key) => { values.delete(key); },
    setItem: () => { throw new DOMException("Storage writes denied", "QuotaExceededError"); },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      if (deniedOperation === "getter") throw new DOMException("Opaque origin has no storage", "SecurityError");
      return storage;
    },
  });
  const store = createStoredIdList("denied-storage");
  const initial = deniedOperation === "setItem" ? ["seed"] : [];
  try {
    expect(store.read()).toEqual(initial);
    await act(async () => root.render(<StoredIdsProbe store={store} />));
    expect(container.textContent).toBe(initial.join(","));
    await act(async () => { store.add("alpha"); store.add("alpha"); store.add("beta"); });
    expect(store.read()).toEqual([...initial, "alpha", "beta"]);
    expect(container.textContent).toBe([...initial, "alpha", "beta"].join(","));
    await act(async () => store.remove("alpha"));
    expect(store.read()).toEqual([...initial, "beta"]);
    expect(container.textContent).toBe([...initial, "beta"].join(","));
    const snapshot = store.read();
    expect(store.read()).toBe(snapshot);
    await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: null })));
    expect(store.read()).toEqual([...initial, "beta"]);
    expect(container.textContent).toBe([...initial, "beta"].join(","));
    expect(values.get("denied-storage")).toBe(JSON.stringify(["seed"]));
  } finally {
    await act(async () => root.unmount());
    if (originalLocalStorage === undefined) Reflect.deleteProperty(window, "localStorage");
    else Object.defineProperty(window, "localStorage", originalLocalStorage);
    container.remove();
  }
});

it("propagates unexpected storage accessor and ID validator errors", () => {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const accessorError = new Error("Broken storage adapter");
  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw accessorError; },
    });
    expect(() => createStoredIdList("unexpected-error").read()).toThrow(accessorError);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => JSON.stringify(["alpha"]) },
    });
    const validatorError = new Error("Broken ID validator");
    const store = createStoredIdList("unexpected-error", () => { throw validatorError; });
    expect(() => store.read()).toThrow(validatorError);
    expect(() => store.read()).toThrow(validatorError);
  } finally {
    if (originalLocalStorage === undefined) Reflect.deleteProperty(window, "localStorage");
    else Object.defineProperty(window, "localStorage", originalLocalStorage);
  }
});
