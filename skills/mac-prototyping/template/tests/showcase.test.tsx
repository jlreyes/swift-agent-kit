// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { coveredExports, ShowcaseDesktop } from "../app/showcase/showcase-desktop.tsx";
import * as MacChrome from "../lib/mac-chrome/index.ts";

afterEach(cleanup);

test("the showcase opens on the window and toolbar story", () => {
  render(<ShowcaseDesktop />);

  expect(screen.getByText("Library")).toBeDefined();
  expect(screen.queryByText(/^Toolbar$/)).toBeNull();
  expect(screen.getByRole("navigation", { name: "Showcase Dock" })).toBeDefined();
  expect(document.querySelector('[aria-label="Showcase activity"]')).not.toBeNull();
  expect(document.querySelector('[data-showcase-story="toolbar"]')).not.toBeNull();

  const toolbar = document.querySelector<HTMLElement>(".mc-toolbar");
  expect(toolbar).not.toBeNull();
  if (toolbar === null) return;
  const viewGroup = within(toolbar).getByRole("group", { name: "View" });
  expect(viewGroup.hasAttribute("data-divided")).toBe(true);
  expect(toolbar.querySelector(".mc-toolbar-actions")?.lastElementChild?.classList.contains("mc-search-bubble")).toBe(true);

  const storyWindow = screen.getByRole("region", { name: "Window and toolbar showcase" });
  expect(storyWindow.getAttribute("style")).toContain("-154px + 100vh");
});

test("the Dock retains the Mac defaults and identifies the running showcase app", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  for (const label of ["Finder", "App Store", "Google Chrome", "Mac Chrome Showcase", "Downloads", "Trash"]) {
    expect(screen.getByRole("button", { name: label })).toBeDefined();
  }
  const showcaseApp = screen.getByRole("button", { name: "Mac Chrome Showcase" });
  expect(showcaseApp.classList.contains("is-running")).toBe(true);

  await user.click(showcaseApp);
  expect(screen.getByText("Mac Chrome Showcase is already open.")).toBeDefined();
});

test("View menu commands drive the same toolbar state as the window controls", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  let viewMenu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(viewMenu).getByText("as List"));
  expect(document.querySelector(".showcase-library-items.is-list")).not.toBeNull();
  expect(screen.getByText("View › as List")).toBeDefined();

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  viewMenu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(viewMenu).getByText("Hide Inspector"));
  expect(screen.queryByRole("complementary", { name: "Inspector" })).toBeNull();
  expect(screen.getByText("View › Hide Inspector")).toBeDefined();
});

test("the Finder View menu controls mode and Preview through the shared window state", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^Showcase(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Showcase menu" })).getByText("Finder"));

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  let viewMenu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(viewMenu).getByText("as List"));
  expect(screen.getByRole("listbox", { name: "Documents" }).classList.contains("mc-list")).toBe(true);

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  viewMenu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(viewMenu).getByText("Hide Preview"));
  expect(document.querySelector(".mc-finder-preview")).toBeNull();
  expect(screen.getByRole("button", { name: "Show Preview" })).toBeDefined();
  expect(screen.getByText("View › Hide Preview")).toBeDefined();
});

test("built-in menus and toolbar details controls produce observable results", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^Window(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Window menu" })).getByText("Minimize"));
  expect(screen.getByText("Window › Minimize")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Account menu" }));
  expect(screen.getByText("Example Account")).toBeDefined();
  expect(screen.getByText("Local showcase profile")).toBeDefined();
});

test("chat search filters real conversation and transcript data and details opens a shared popover", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^Showcase(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Showcase menu" })).getByText("Chat"));
  await user.click(screen.getByRole("button", { name: "Search conversation" }));
  await user.type(screen.getByRole("textbox", { name: "Search conversation" }), "reference set");

  expect(screen.queryByText("Project Notes")).toBeNull();
  expect(screen.getAllByText("Research")).toHaveLength(2);
  expect(screen.getByText("The reference set is ready.")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Conversation details" }));
  expect(screen.getByText("Participants")).toBeDefined();
  expect(screen.getByText("Assistant · Agent")).toBeDefined();
});

test("the Showcase menu replaces the active full-size surface", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^Showcase(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Showcase menu" })).getByText("Finder"));
  expect(screen.getByRole("listbox", { name: "Documents" })).toBeDefined();
  expect(screen.queryByText("Library")).toBeNull();
  expect(document.querySelector('[data-showcase-story="finder"]')).not.toBeNull();

  await user.click(screen.getByRole("button", { name: /^Showcase(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Showcase menu" })).getByText("Chooser"));
  expect(screen.getByRole("listbox", { name: "Choose a workspace" })).toBeDefined();
  expect(screen.queryByRole("listbox", { name: "Documents" })).toBeNull();
  expect(document.querySelector('[data-showcase-story="chooser"]')).not.toBeNull();
});

test("the coverage map is unique and includes every major surface", () => {
  expect(new Set(coveredExports).size).toBe(coveredExports.length);
  expect([...coveredExports].sort()).toEqual(Object.keys(MacChrome).sort());
  for (const exportName of [
    "DesktopShell",
    "MacDock",
    "MenuBarExtra",
    "WindowChrome",
    "MacToolbar",
    "MacMenu",
    "MacDetailsMenu",
    "FinderWindow",
    "QuickLook",
    "ChooserWindow",
    "SetupAssistant",
    "Sheet",
    "ChatWindow",
  ]) {
    expect(coveredExports).toContain(exportName);
  }
});
