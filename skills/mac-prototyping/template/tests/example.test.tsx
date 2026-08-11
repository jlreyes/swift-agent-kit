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
  expect(screen.getByRole("img", { name: "Google Drive" })).toBeDefined();
  expect(screen.getByRole("img", { name: "Notion" })).toBeDefined();
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
