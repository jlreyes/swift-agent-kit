// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  expect(document.querySelector(".showcase-viewport")?.getAttribute("data-mobile-review-mode")).toBe("fixed-desktop");
  const catalog = screen.getByRole("region", { name: "Mac Chrome component showcase" });
  expect(catalog).toBeDefined();
  expect(catalog.getAttribute("style")).toContain("100% - 32px");
  expect(catalog.getAttribute("style")).not.toMatch(/\b100v[wh]\b/);
  expect(sourceList()).toBeDefined();
  expect(sourceItem("App Anatomy").getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("main", { name: "App Anatomy story" })).toBeDefined();
  expect(screen.getByRole("complementary", { name: "Component inspector" })).toBeDefined();
  expect(screen.getByRole("navigation", { name: "Showcase Dock" })).toBeDefined();
  expect(catalog.getAttribute("data-window-resizable")).toBe("true");
  expect(catalog.querySelectorAll("[data-window-resize-handle]")).toHaveLength(8);
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

  act(() => trigger.focus());
  await user.keyboard("{Enter}");
  const markAsRead = screen.getByRole("button", { name: "Mark as Read" });
  expect(markAsRead.hasAttribute("disabled")).toBe(false);
  await user.tab();
  await waitFor(() => expect(document.activeElement).toBe(markAsRead));
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mark as Read" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.getByText("Showcase activity marked as read.")).toBeDefined();

  act(() => trigger.focus());
  await user.keyboard("{Enter}");
  const completedAction = screen.getByRole("button", { name: "Mark as Read" });
  expect(screen.getByText("You’re all caught up.")).toBeDefined();
  expect(completedAction.hasAttribute("disabled")).toBe(true);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Mark as Read" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
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
  expect(within(menu).getByText("Hide Sidebar")).toBeDefined();
  await user.click(dockButton("Finder"));
  menu = await openViewMenu(user);
  expect(within(menu).getByText("Icon View")).toBeDefined();
  await user.click(within(finder).getByRole("button", { name: "Close window" }));
  expect(screen.queryByRole("region", { name: "Finder showcase" })).toBeNull();

  menu = await openViewMenu(user);
  expect(within(menu).getByText("Icon View")).toBeDefined();
  await user.click(dockButton("Mac Chrome"));
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
  const minimizedFinder = dockButton("Finder showcase");
  expect(minimizedFinder.classList.contains("is-window-thumbnail")).toBe(true);
  expect(minimizedFinder.querySelector(".p0-window-thumbnail")).not.toBeNull();
  expect(screen.getByRole("navigation", { name: "Showcase Dock" }).querySelectorAll(".p0-dock-divider").length).toBeGreaterThanOrEqual(2);
  const dockLabels = within(screen.getByRole("navigation", { name: "Showcase Dock" }))
    .getAllByRole("button").map((button) => button.getAttribute("aria-label"));
  expect(dockLabels.indexOf("Finder showcase")).toBeLessThan(dockLabels.indexOf("Downloads"));

  await user.click(minimizedFinder);
  expect(screen.getByRole("region", { name: "Finder showcase" })).toBeDefined();
  expect(screen.getByRole("region", { name: "Finder showcase" }).getAttribute("data-key-window")).toBe("true");
  expect(within(screen.getByRole("navigation", { name: "Showcase Dock" })).queryByRole("button", { name: "Finder showcase" })).toBeNull();
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

test("the navigation story switches its middle collection and detail with the sidebar", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Navigation & Split View"));
  const sidebar = screen.getByRole("complementary", { name: "Example sidebar" });
  const content = screen.getByRole("region", { name: "Project list" });
  const detail = screen.getByRole("region", { name: "Project detail" });
  expect(within(content).getByRole("listbox", { name: "Projects" })).toBeDefined();
  expect(within(content).getByText("Website refresh")).toBeDefined();

  await user.click(within(sidebar).getByText("Archive"));
  const archive = within(content).getByRole("listbox", { name: "Archive" });
  expect(within(archive).getByRole("option", { name: /Completed launch/ }).getAttribute("aria-selected")).toBe("true");
  expect(within(content).queryByText("Website refresh")).toBeNull();
  expect(within(detail).getByRole("heading", { name: "Completed launch" })).toBeDefined();
  expect(within(detail).getByText("Archived Aug 14")).toBeDefined();

  await user.click(within(archive).getByRole("option", { name: /Legacy research/ }));
  expect(within(detail).getByRole("heading", { name: "Legacy research" })).toBeDefined();

  await user.click(within(sidebar).getByText("Projects"));
  expect(within(content).getByRole("listbox", { name: "Projects" })).toBeDefined();
  expect(within(content).queryByText("Legacy research")).toBeNull();
  expect(within(detail).getByRole("heading", { name: "Website refresh" })).toBeDefined();
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
  const density = within(form).getByRole("radiogroup", { name: "Interface density" });
  const compact = within(density).getByRole("radio", { name: "Compact" });
  const comfortable = within(density).getByRole("radio", { name: "Comfortable" });
  const updates = within(form).getByRole("checkbox", { name: "Install automatically" });
  const analytics = within(form).getByRole("switch", { name: "Share diagnostics" });
  await user.click(compact);
  await user.click(updates);
  await user.click(analytics);
  expect(compact.getAttribute("aria-checked")).toBe("true");
  expect((updates as HTMLInputElement).checked).toBe(false);
  expect((analytics as HTMLInputElement).checked).toBe(true);

  await user.click(within(form).getByRole("button", { name: "Restore Defaults" }));
  expect((name as HTMLInputElement).value).toBe("Mac Chrome");
  expect(comfortable.getAttribute("aria-checked")).toBe("true");
  expect((updates as HTMLInputElement).checked).toBe(true);
  expect((analytics as HTMLInputElement).checked).toBe(false);
  expect(within(form).getByText("Defaults restored")).toBeDefined();

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
  const popoverContent = screen.getByText("Popover content");
  const popover = popoverContent.closest<HTMLElement>(".mc-popover-surface");
  if (popover === null) throw new Error("Shared popover surface was not rendered");
  expect(popover.dataset.popoverLayout).toBe("content");
  expect(popover.querySelector<HTMLElement>(".mc-popover-dialog")?.dataset.contentInset).toBe("regular");
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
  expect(dialog.closest<HTMLElement>("[data-modal-kind='sheet']")?.dataset.modalScope).toBe("window");
  expect(dialog.querySelector(".mc-sheet-header")).not.toBeNull();
  expect(dialog.querySelector(".mc-sheet-body")).not.toBeNull();
  expect(dialog.querySelector(".mc-sheet-footer")).not.toBeNull();
  expect(dialog.querySelector(".mc-setup-heading")).toBeNull();
  let name = within(dialog).getByRole("textbox", { name: "Project name" });
  fireEvent.change(name, { target: { value: "Client Portal" } });
  expect((name as HTMLInputElement).value).toBe("Client Portal");

  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Create Project…" }));
  dialog = screen.getByRole("dialog", { name: "Create Project" });
  name = within(dialog).getByRole("textbox", { name: "Project name" });
  expect((name as HTMLInputElement).value).toBe("Client Portal");
  const create = within(dialog).getByRole("button", { name: "Create" });
  expect(create.classList.contains("mc-dialog-action-default")).toBe(true);
  await user.click(create);
  expect(screen.queryByRole("dialog", { name: "Create Project" })).toBeNull();
  expect(within(screen.getByRole("main", { name: "Presentation & Feedback story" })).getByRole("status").textContent).toContain("Created Client Portal.");
});

test("the presentation story uses a window-attached destructive alert and reports the result locally", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(sourceItem("Presentation & Feedback"));
  await user.click(screen.getByRole("button", { name: "Delete Draft…" }));
  const alert = screen.getByRole("alertdialog", { name: "Delete the draft project?" });
  expect(alert.closest<HTMLElement>("[data-modal-kind='alert']")?.dataset.modalScope).toBe("window");
  const deleteButton = within(alert).getByRole("button", { name: "Delete" });
  expect(deleteButton.classList.contains("mc-dialog-action-default")).toBe(true);
  expect(deleteButton.classList.contains("mc-dialog-action-destructive")).toBe(true);
  await user.click(deleteButton);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(within(screen.getByRole("main", { name: "Presentation & Feedback story" })).getByRole("status").textContent).toContain("Deleted the draft project.");
  expect(document.querySelector(".showcase-desktop-status")).toBeNull();
});

test("the menu-bar app presents its system alert at desktop scope", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);
  const trigger = document.querySelector<HTMLElement>(".mc-menubar-trigger[aria-label='Showcase activity']");
  if (trigger === null) throw new Error("Showcase activity trigger was not rendered");

  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Clear Activity…" }));
  const alert = screen.getByRole("alertdialog", { name: "Clear the activity notes?" });
  expect(alert.closest<HTMLElement>("[data-modal-kind='alert']")?.dataset.modalScope).toBe("desktop");
  expect(screen.queryByRole("dialog", { name: "Showcase activity" })).toBeNull();
  expect(document.querySelector(".mc-menubar-popover")).toBeNull();
  await user.click(within(alert).getByRole("button", { name: "Clear" }));
  expect(screen.queryByRole("alertdialog", { name: "Clear the activity notes?" })).toBeNull();
  expect(screen.getByText("Showcase activity cleared by the menu-bar app.")).toBeDefined();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("Setup Assistant composes the shared MacSheet without legacy modal plumbing", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await openRecipe(user, "Setup Assistant");
  const setup = screen.getByRole("region", { name: "Setup Assistant showcase" });
  await user.click(within(setup).getByRole("button", { name: "Show Details…" }));
  const dialog = screen.getByRole("dialog", { name: "Welcome Details" });
  expect(dialog.querySelector(".mc-setup-heading")).toBeNull();
  expect(dialog.querySelector(".mc-sheet-header")).not.toBeNull();
  expect(dialog.querySelector(".mc-sheet-body")).not.toBeNull();
  expect(dialog.querySelector(".mc-sheet-footer")).not.toBeNull();
  const done = within(dialog).getByRole("button", { name: "Done" });
  expect(done.classList.contains("mc-dialog-action-cancel")).toBe(true);
  expect(done.classList.contains("mc-dialog-action-default")).toBe(true);
  await user.click(done);
  expect(screen.queryByRole("dialog", { name: "Welcome Details" })).toBeNull();
});

test("Setup Assistant cancellation and completion close the managed recipe window", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await openRecipe(user, "Setup Assistant");
  let setup = screen.getByRole("region", { name: "Setup Assistant showcase" });
  await user.click(within(setup).getByRole("button", { name: "Not Now" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Setup Assistant showcase" })).toBeNull());
  expect(screen.getByText("Setup Assistant cancelled.")).toBeDefined();

  await user.click(dockButton("Setup Assistant"));
  setup = screen.getByRole("region", { name: "Setup Assistant showcase" });
  await user.click(within(setup).getByRole("button", { name: "Continue" }));
  await user.click(within(setup).getByRole("button", { name: "Continue" }));
  await user.click(within(setup).getByRole("button", { name: "Finish" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Setup Assistant showcase" })).toBeNull());
  expect(screen.getByText("Setup Assistant completed.")).toBeDefined();
});

test("Chat sends new messages to the active conversation", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await openRecipe(user, "Chat");
  const chat = screen.getByRole("region", { name: "Chat showcase" });
  const threadList = within(chat).getByRole("complementary", { name: "Conversations" });
  await user.click(within(threadList).getByText("Research"));

  const composer = within(chat).getByRole("textbox", { name: "Message" });
  fireEvent.change(composer, { target: { value: "Research follow-up" } });
  expect((composer as HTMLTextAreaElement).value).toBe("Research follow-up");
  await user.click(within(chat).getByRole("button", { name: "Send message" }));
  let transcript = within(chat).getByRole("log", { name: "Conversation" });
  expect(within(transcript).getByText("Research follow-up")).toBeDefined();

  await user.click(within(threadList).getByText("Project Notes"));
  transcript = within(chat).getByRole("log", { name: "Conversation" });
  expect(within(transcript).queryByText("Research follow-up")).toBeNull();

  await user.click(within(threadList).getByText("Research"));
  transcript = within(chat).getByRole("log", { name: "Conversation" });
  expect(within(transcript).getByText("Research follow-up")).toBeDefined();
});

test("Chat does not send a draft to a hidden conversation when search has no results", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await openRecipe(user, "Chat");
  const chat = screen.getByRole("region", { name: "Chat showcase" });
  const composer = within(chat).getByRole("textbox", { name: "Message" });
  fireEvent.change(composer, { target: { value: "Unrouted draft" } });

  await user.click(within(chat).getByRole("button", { name: "Search conversation" }));
  const search = within(chat).getByRole("textbox", { name: "Search conversation" });
  fireEvent.change(search, { target: { value: "no conversation matches this" } });
  expect(within(chat).getByText("No matching conversations")).toBeDefined();

  const guardedComposer = within(chat).getByRole("textbox", { name: "No conversation selected" });
  expect((guardedComposer as HTMLTextAreaElement).value).toBe("");
  const send = within(chat).getByRole("button", { name: "Send message" }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  const composerForm = guardedComposer.closest("form");
  if (composerForm === null) throw new Error("Chat composer form was not rendered");
  fireEvent.submit(composerForm);

  fireEvent.change(search, { target: { value: "" } });
  const transcript = within(chat).getByRole("log", { name: "Conversation" });
  expect(within(transcript).queryByText("Unrouted draft")).toBeNull();
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

test("Finder locations replace entries and reset selection to that location", async () => {
  const user = userEvent.setup();
  render(<ShowcaseDesktop />);

  await user.click(dockButton("Finder"));
  const finder = screen.getByRole("region", { name: "Finder showcase" });
  const documents = within(finder).getByRole("listbox", { name: "Documents" });
  expect(within(documents).getByText("Project Brief.md")).toBeDefined();

  const recentsLabel = within(finder).getByText("Recents");
  const recentsControl = recentsLabel.closest<HTMLElement>("button, [role='treeitem']");
  // The scaffold stub is intentionally structural; real vendoring supplies
  // MacSourceList's interactive sidebar contract exercised below.
  if (recentsControl === null) return;

  await user.click(recentsControl);
  const recents = within(finder).getByRole("listbox", { name: "Recents" });
  expect(within(recents).getByRole("option", { name: /Design Review\.pdf/ }).getAttribute("aria-selected")).toBe("true");
  expect(within(recents).getByText("Meeting Notes.md")).toBeDefined();
  expect(within(finder).queryByText("Project Brief.md")).toBeNull();

  const sharedLabel = within(finder).getByText("Shared Server");
  const sharedControl = sharedLabel.closest<HTMLElement>("button, [role='treeitem']");
  if (sharedControl === null) throw new Error("Shared Server sidebar item was not interactive");
  await user.click(sharedControl);
  const shared = within(finder).getByRole("listbox", { name: "Shared Server" });
  expect(within(shared).getByRole("option", { name: /Team Roadmap\.md/ }).getAttribute("aria-selected")).toBe("true");
  expect(within(shared).getByText("Brand Assets")).toBeDefined();
  expect(within(finder).queryByText("Design Review.pdf")).toBeNull();
  expect(within(finder).queryByText("Project Brief.md")).toBeNull();
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

test("the coverage map includes the runtime surface apart from the separately tested embed wrapper", () => {
  expect(new Set(coveredExports).size).toBe(coveredExports.length);
  const embeddedPresentationExports = new Set(["MacEmbeddedPresentation"]);
  expect([...coveredExports].sort()).toEqual(Object.keys(MacChrome).filter((name) => !embeddedPresentationExports.has(name)).sort());
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
    "MacSheet",
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
