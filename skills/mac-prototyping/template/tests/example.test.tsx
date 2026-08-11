// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import ExamplePage from "../app/example/page.tsx";

// In-memory localStorage for jsdom interaction tests (the toolkit's standard
// helper). Install it inside a test, and it is torn down in afterEach.
function installMemoryLocalStorage() {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return storage;
}

afterEach(() => {
  cleanup();
  window.localStorage?.clear();
  Reflect.deleteProperty(window, "localStorage");
});

test("the example surface renders its window title", () => {
  render(<ExamplePage />);

  expect(screen.getByText("Example Window")).toBeDefined();
  expect(screen.getByRole("navigation", { name: "Mac Dock" })).toBeDefined();
  // The menu-bar titles render in both stub (inert) and vendored (dropdown) modes.
  expect(screen.getByText("File")).toBeDefined();
});

test("the example brand icons resolve to real simple-icons paths", () => {
  render(<ExamplePage />);

  // Not just "an element rendered": the installed simple-icons actually
  // resolved the slug to a glyph path (unknown slugs render nothing).
  for (const [name, slug] of [["Google Drive", "googledrive"], ["Notion", "notion"]] as const) {
    const icon = screen.getByRole("img", { name });
    expect(icon.getAttribute("data-brand")).toBe(slug);
    expect(icon.querySelector("path")?.getAttribute("d")).toMatch(/^[Mm]/);
  }
});

test("the finder example window renders with its entries", () => {
  render(<ExamplePage />);

  expect(screen.getByRole("listbox", { name: "Documents" })).toBeDefined();
  expect(screen.getByRole("option", { name: /Roadmap\.md/ })).toBeDefined();
});

test("the in-memory localStorage helper isolates state per test", () => {
  const storage = installMemoryLocalStorage();
  window.localStorage.setItem("example", "value");

  expect(storage.getItem("example")).toBe("value");
  expect(storage.length).toBe(1);
});
