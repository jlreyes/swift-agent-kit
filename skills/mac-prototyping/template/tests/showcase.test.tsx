// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { coveredExports, ShowcaseDesktop } from "../app/showcase/showcase-desktop.tsx";
import * as MacChrome from "../lib/mac-chrome/index.ts";

afterEach(cleanup);

function sourceList(): HTMLElement {
  const list = document.querySelector<HTMLElement>(".mc-sidebar-tree[aria-label='Component catalog']");
  if (list === null) throw new Error("Component catalog source list was not rendered");
  return list;
}

function sourceItem(name: string): HTMLElement {
  const label = within(sourceList()).getByText(name);
  const item = label.closest<HTMLElement>(".mc-sidebar-item");
  if (item === null) throw new Error(`Source-list item ${name} was not rendered`);
  return item;
}

function dockButton(name: string): HTMLButtonElement {
  return within(screen.getByRole("navigation", { name: "Showcase Dock" })).getByRole("button", { name });
}

type TestUser = ReturnType<typeof userEvent.setup>;

async function openViewMenu(user: TestUser): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  return screen.findByRole("menu", { name: "View menu" });
}

async function openRecipe(user: TestUser, story: "Chat" | "Chooser" | "Setup Assistant"): Promise<void> {
  await user.click(sourceItem(story));
  await user.click(screen.getByRole("button", { name: "Open Example Window" }));
}

test("the showcase opens as a persistent split-view component catalog", () => {
  render(<ShowcaseDesktop />);

  const catalog = screen.getByRole("region", { name: "Mac Chrome component showcase" });
  expect(catalog).toBeDefined();
  expect(catalog.getAttribute("style")).toContain("100% - 32px");
  expect(catalog.getAttribute("style")).not.toMatch(/\b100v[wh]\b/);
  expect(sourceList()).toBeDefined();
  expect(sourceItem("App Anatomy").getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("main", { name: "App Anatomy story" })).toBeDefined();
  expect(screen.getByRole("complementary", { name: "Component inspector" })).toBeDefined();
  expect(screen.getByRole("navigation", { name: "Showcase Dock" })).toBeDefined();
  expect(document.querySelector(".showcase-desktop-status")).toBeNull();
  expect(screen.queryByText(/^Toolbar$/)).toBeNull();
});

test("the Dock retains Mac defaults, exposes composition apps, and normalizes generated icons", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  for (const label of ["Mac Chrome", "Finder", "Workspace Chooser", "Setup Assistant", "Chat", "App Store", "Google Chrome", "Downloads", "Trash"]) {
    expect(dockButton(label)).toBeDefined();
  }
  const showcaseApp = dockButton("Mac Chrome");
  expect(showcaseApp.classList.contains("is-running")).toBe(true);
  expect(showcaseApp.querySelector(".p0-app-icon--tile")).not.toBeNull();
  expect(showcaseApp.querySelector(".showcase-app-icon")).toBeNull();
  expect(within(screen.getByRole("navigation", { name: "Showcase Dock" })).queryByRole("button", { name: "Showcase Activity" })).toBeNull();

  await user.click(showcaseApp);
  expect(screen.getByRole("region", { name: "Mac Chrome component showcase" }).getAttribute("data-key-window")).toBe("true");
});

test("every default Dock item launches a managed app window instead of writing Dock help into the catalog", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);
  const catalog = screen.getByRole("region", { name: "Mac Chrome component showcase" });

  await user.click(dockButton("Finder"));
  expect(screen.getByRole("region", { name: "Finder showcase" })).toBeDefined();
  await user.click(dockButton("Finder"));
  expect(screen.getByRole("region", { name: "Finder showcase" }).getAttribute("data-key-window")).toBe("true");

  for (const label of ["App Store", "Google Chrome", "Downloads", "Trash"] as const) {
    await user.click(dockButton(label));
    expect(screen.getByRole("region", { name: `${label} showcase` }).getAttribute("data-key-window")).toBe("true");
  }
  expect(within(catalog).queryByText(/Google Chrome is already showing/i)).toBeNull();
});

test("Mark as Read becomes disabled once showcase activity is caught up", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);
  const trigger = document.querySelector<HTMLElement>(".mc-menubar-trigger[aria-label='Showcase activity']");
  if (trigger === null) throw new Error("Showcase activity trigger was not rendered");

  await user.click(trigger);
  const markAsRead = screen.getByRole("button", { name: "Mark as Read" }) as HTMLButtonElement;
  expect(markAsRead.disabled).toBe(false);
  await user.click(markAsRead);
  expect(screen.getByText("You’re all caught up.")).toBeDefined();
  expect(markAsRead.disabled).toBe(true);
  expect(screen.getByText("Showcase activity marked as read.")).toBeDefined();

  await user.click(markAsRead);
  expect(markAsRead.disabled).toBe(true);
  expect(screen.getByText("Showcase activity marked as read.")).toBeDefined();
});

test("View menu and toolbar controls share sidebar and inspector visibility", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  let menu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(menu).getByText("Hide Inspector"));
  expect(screen.queryByRole("complementary", { name: "Component inspector" })).toBeNull();
  expect(screen.getByText("Inspector hidden.")).toBeDefined();

  await user.click(screen.getByRole("button", { name: /^View(?: menu)?$/ }));
  menu = await screen.findByRole("menu", { name: "View menu" });
  await user.click(within(menu).getByText("Hide Sidebar"));
  expect(document.querySelector(".mc-sidebar-tree[aria-label='Component catalog']")).toBeNull();
  expect(screen.getByRole("button", { name: "Show Sidebar" })).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Show Sidebar" }));
  expect(sourceList()).toBeDefined();
});

test("Finder View commands target only Finder and stay in sync with its toolbar", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);
  const catalog = screen.getByRole("region", { name: "Mac Chrome component showcase" });

  await user.click(dockButton("Finder"));
  const finder = screen.getByRole("region", { name: "Finder showcase" });
  expect(finder.getAttribute("data-key-window")).toBe("true");
  let menu = await openViewMenu(user);
  expect(within(menu).queryByText("Hide Inspector")).toBeNull();
  await user.click(within(menu).getByText("List View"));
  expect(within(finder).getByRole("button", { name: "List view" }).getAttribute("aria-pressed")).toBe("true");
  expect(finder.getAttribute("data-key-window")).toBe("true");

  await user.click(within(finder).getByRole("button", { name: "Icon view" }));
  expect(finder.getAttribute("data-key-window")).toBe("true");
  menu = await openViewMenu(user);
  expect(within(menu).getByRole("menuitemradio", { name: "Icon View" }).getAttribute("aria-checked")).toBe("true");
  await user.click(within(menu).getByText("Hide Sidebar"));
  expect(finder.querySelector(".mc-finder-sidebar")).toBeNull();
  expect(catalog.querySelector(".mc-sidebar-tree[aria-label='Component catalog']")).not.toBeNull();
  expect(within(catalog).getByRole("complementary", { name: "Component inspector" })).toBeDefined();

  await user.click(within(finder).getByRole("button", { name: "Show sidebar" }));
  expect(finder.querySelector(".mc-finder-sidebar")).not.toBeNull();
  menu = await openViewMenu(user);
  expect(within(menu).getByText("Hide Sidebar")).toBeDefined();
  await user.click(within(menu).getByText("Hide Preview"));
  expect(finder.querySelector(".mc-finder-preview")).toBeNull();
  expect(within(catalog).getByRole("complementary", { name: "Component inspector" })).toBeDefined();

  await user.click(within(finder).getByRole("button", { name: "Show Preview" }));
  expect(finder.querySelector(".mc-finder-preview")).not.toBeNull();
  menu = await openViewMenu(user);
  expect(within(menu).getByText("Hide Preview")).toBeDefined();
});

test("frontmost-window focus retargets View without removing background apps", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(dockButton("Finder"));
  await openRecipe(user, "Chat");
  const finder = screen.getByRole("region", { name: "Finder showcase" });
  const chat = screen.getByRole("region", { name: "Chat showcase" });
  expect(finder.getAttribute("data-key-window")).toBe("false");
  expect(chat.getAttribute("data-key-window")).toBe("true");
  expect(Number(chat.style.zIndex)).toBeGreaterThan(Number(finder.style.zIndex));
  let menu = await openViewMenu(user);
  expect(within(menu).queryByText("Icon View")).toBeNull();
  expect(within(menu).queryByText("Hide Inspector")).toBeNull();
  await user.click(within(menu).getByText("Hide Sidebar"));
  expect(chat.querySelector(".mc-chat-sidebar")).toBeNull();
  expect(sourceList()).toBeDefined();

  await user.click(within(chat).getByRole("button", { name: "Show sidebar" }));

  fireEvent.pointerDown(finder);
  expect(finder.getAttribute("data-key-window")).toBe("true");
  expect(chat.getAttribute("data-key-window")).toBe("false");
  menu = await openViewMenu(user);
  expect(within(menu).getByText("Icon View")).toBeDefined();

  await user.click(dockButton("Chat"));
  expect(chat.getAttribute("data-key-window")).toBe("true");
  menu = await openViewMenu(user);
  expect(within(menu).getByText("Hide Sidebar")).toBeDefined();
  await user.click(within(chat).getByRole("button", { name: "Close window" }));
  expect(screen.queryByRole("region", { name: "Chat showcase" })).toBeNull();

  menu = await openViewMenu(user);
  expect(within(menu).getByText("Icon View")).toBeDefined();
  await user.click(within(finder).getByRole("button", { name: "Close window" }));
  expect(screen.queryByRole("region", { name: "Finder showcase" })).toBeNull();

  menu = await openViewMenu(user);
  expect(within(menu).getByText("Hide Inspector")).toBeDefined();
});

test("traffic lights minimize managed apps and their Dock items restore them", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(dockButton("Finder"));
  const finder = screen.getByRole("region", { name: "Finder showcase" });
  const controls = within(finder).getByLabelText("Window controls");
  expect(within(controls).getAllByRole("button")).toHaveLength(3);
  await user.click(within(controls).getByRole("button", { name: "Minimize window" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Finder showcase" })).toBeNull());
  expect(dockButton("Finder").classList.contains("is-running")).toBe(true);

  await user.click(dockButton("Finder"));
  expect(screen.getByRole("region", { name: "Finder showcase" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Finder showcase" }).getAttribute("data-key-window")).toBe("true");
});

test.each([
  ["Chooser", "Chooser showcase"],
  ["Setup Assistant", "Setup Assistant showcase"],
] as const)("%s exposes a disabled View menu instead of mutating the catalog", async (story, windowLabel) => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await openRecipe(user, story);
  expect(screen.getByRole("region", { name: windowLabel })).toBeDefined();
  const menu = await openViewMenu(user);
  const label = within(menu).getByText("No View Options");
  const item = label.closest<HTMLElement>("[role='menuitem']");
  if (item === null) throw new Error("Disabled View item was not rendered");
  expect(item.getAttribute("aria-disabled") === "true" || (item as HTMLButtonElement).disabled).toBe(true);
  expect(sourceList()).toBeDefined();
  expect(screen.getByRole("complementary", { name: "Component inspector" })).toBeDefined();
});

test("catalog selection and history navigate stories without replacing the app window", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Navigation & Split View"));
  expect(screen.getByRole("main", { name: "Navigation & Split View story" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Project list" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Project detail" })).toBeDefined();
  expect(screen.getByRole("complementary", { name: "Component inspector" })).toBeDefined();
  expect(screen.getByText("Three navigation columns; inspector separate")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("main", { name: "App Anatomy story" })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "Forward" }));
  expect(screen.getByRole("main", { name: "Navigation & Split View story" })).toBeDefined();
});

test("Window & Toolbar composes the public toolbar surface and controls", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Window & Toolbar"));
  const toolbar = document.querySelector<HTMLElement>(".showcase-toolbar-example > .mc-toolbar.showcase-example-toolbar");
  if (toolbar === null) throw new Error("Public MacToolbar surface was not rendered");
  expect(within(toolbar).getByRole("heading", { name: "Library" })).toBeDefined();
  expect(within(toolbar).getByRole("group", { name: "History" })).toBeDefined();
  expect(within(toolbar).getByRole("button", { name: "Back" })).toBeDefined();
  expect(within(toolbar).getByRole("radiogroup", { name: "Library view" })).toBeDefined();
  expect(within(toolbar).getByRole("button", { name: "Search" })).toBeDefined();
});

test("the controls story exercises the reusable form system", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Controls & Forms"));
  const form = screen.getByRole("form", { name: "Example preferences" });
  const name = within(form).getByRole("textbox", { name: "Workspace name" });
  fireEvent.change(name, { target: { value: "Prototype Kit" } });
  expect((name as HTMLInputElement).value).toBe("Prototype Kit");
  expect(within(form).getByRole("radiogroup", { name: "Interface density" })).toBeDefined();
  expect(within(form).getByRole("checkbox", { name: "Install automatically" })).toBeDefined();
  expect(within(form).getByRole("switch", { name: "Share diagnostics" })).toBeDefined();
  await user.click(within(form).getByRole("button", { name: "Save" }));
  expect(within(form).getByText("Preferences saved")).toBeDefined();
});

test("menus and popovers are distinct shared presentation primitives", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Menus & Popovers"));
  await user.click(screen.getByRole("button", { name: "Actions" }));
  const menu = await screen.findByRole("menu", { name: "Example actions" });
  await user.click(within(menu).getByText("New Folder"));
  expect(screen.getByText("New Folder selected")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Component information" }));
  expect(screen.getByText("Popover content")).toBeDefined();
  expect(screen.getByText("Use this for a small amount of transient functionality, not a list of commands.")).toBeDefined();
});

test("the popover option is controlled and reflects each activation", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Menus & Popovers"));
  await user.click(screen.getByRole("button", { name: "Component information" }));
  const option = screen.getByRole("checkbox", { name: "Example option" });
  expect((option as HTMLInputElement).checked).toBe(true);

  await user.click(option);
  expect((option as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText("Example option disabled")).toBeDefined();

  await user.click(option);
  expect((option as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText("Example option enabled")).toBeDefined();
});

test("the Create Project sheet retains its controlled project name", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Presentation & Feedback"));
  await user.click(screen.getByRole("button", { name: "Create Project…" }));
  let dialog = screen.getByRole("dialog", { name: "Create Project" });
  let name = within(dialog).getByRole("textbox", { name: "Project name" });
  fireEvent.change(name, { target: { value: "Client Portal" } });
  expect((name as HTMLInputElement).value).toBe("Client Portal");

  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Create Project…" }));
  dialog = screen.getByRole("dialog", { name: "Create Project" });
  name = within(dialog).getByRole("textbox", { name: "Project name" });
  expect((name as HTMLInputElement).value).toBe("Client Portal");
});

test("the presentation story exposes the shared system alert and window status bar", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Presentation & Feedback"));
  await user.click(screen.getByRole("button", { name: "Show System Alert" }));
  const alert = screen.getByRole("alertdialog", { name: "Apply the prototype settings?" });
  await user.click(within(alert).getByRole("button", { name: "Apply" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(within(screen.getByRole("main", { name: "Presentation & Feedback story" })).getByRole("status").textContent).toContain("Settings applied.");
});

test("full compositions open in their own window instead of nesting in the catalog", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Finder"));
  expect(screen.getByRole("main", { name: "Finder story" })).toBeDefined();
  expect(screen.queryByRole("listbox", { name: "Documents" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Open Example Window" }));
  expect(screen.getByRole("listbox", { name: "Documents" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Mac Chrome component showcase" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Finder showcase" })).toBeDefined();
});

test("component search filters the persistent source list", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: "Search components" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search components" }), { target: { value: "z" } });
  expect(screen.getByText("No components")).toBeDefined();
  expect(document.querySelector(".mc-sidebar-tree[aria-label='Component catalog']")).toBeNull();
});

test("the Showcase menu mirrors source-list story selection", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(screen.getByRole("button", { name: /^Showcase(?: menu)?$/ }));
  await user.click(within(await screen.findByRole("menu", { name: "Showcase menu" })).getByText("Lists & Collections"));
  expect(screen.getByRole("main", { name: "Lists & Collections story" })).toBeDefined();
  expect(sourceItem("Lists & Collections").getAttribute("aria-selected")).toBe("true");
});

test("the coverage map is unique and includes the complete runtime surface", () => {
  expect(new Set(coveredExports).size).toBe(coveredExports.length);
  expect([...coveredExports].sort()).toEqual(Object.keys(MacChrome).sort());
  for (const exportName of [
    "MacDockAppIcon",
    "MacNavigationSplitView",
    "MacSourceList",
    "MacInspector",
    "MacList",
    "MacDisclosureGroup",
    "MacButton",
    "MacForm",
    "MacMenu",
    "MacPopover",
    "MacContentUnavailable",
    "MacAlert",
    "MacWindowStatusBar",
    "FinderWindow",
    "ChooserWindow",
    "SetupAssistant",
    "ChatWindow",
  ]) {
    expect(coveredExports).toContain(exportName);
  }
});
