// @vitest-environment jsdom
import { act, createRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  DesktopShell,
  MacDock,
  MacDetailsMenu,
  MacAlert,
  MacMenu,
  MacPopover,
  MacToolbar,
  MenuBarExtra,
  SystemSymbol,
  ToolbarButton,
  ToolbarCapsule,
  ToolbarGlyph,
  ToolbarSearchBubble,
  ToolbarToggle,
  TrafficLights,
  WindowChrome,
} from "../index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("renders the desktop chrome composition", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <DesktopShell appName="Finder" wallpaper="linear-gradient(180deg, #123456, #234567)">
        <WindowChrome label="Test window" draggable>
          <div data-window-drag-handle>
            <TrafficLights />
            <MacToolbar
              leading={
                <ToolbarCapsule divided label="History">
                  <ToolbarButton label="Back"><ToolbarGlyph name="back" /></ToolbarButton>
                  <ToolbarButton label="Forward" disabled><ToolbarGlyph name="forward" /></ToolbarButton>
                </ToolbarCapsule>
              }
              title="Documents"
              trailing={
                <>
                  <ToolbarToggle label="Show Preview" pressed onPressedChange={() => {}}>
                    <ToolbarGlyph name="inspector" />
                  </ToolbarToggle>
                  <ToolbarSearchBubble label="Search" value="" onValueChange={() => {}} />
                </>
              }
            />
          </div>
          <SystemSymbol name="sparkles" size={16} />
        </WindowChrome>
        <MenuBarExtra icon={<SystemSymbol name="shield.fill" />} badge={2} label="Activity">
          <p>Slotted content</p>
        </MenuBarExtra>
        <MacDock
          items={[
            { id: "finder", label: "Finder", icon: <SystemSymbol name="folder" />, running: true },
            { id: "app", label: "App", icon: "/icon.png", group: "places", draggablePayload: { "text/plain": "App" } },
          ]}
        />
      </DesktopShell>,
    );
  });
  expect(container.querySelector(".mac-menu-bar")).toBeTruthy();
  expect(container.querySelector(".mac-window")).toBeTruthy();
  expect(container.querySelector(".mc-toolbar-title")?.textContent).toBe("Documents");
  expect(container.querySelectorAll(".p0-dock-item")).toHaveLength(2);
  expect(container.querySelector(".p0-dock-divider")).toBeTruthy();
  expect(container.querySelector(".p0-dock-item.is-running")).toBeTruthy();
  expect(container.querySelector(".mc-menubar-badge")?.textContent).toBe("2");
  expect(container.querySelector("[data-system-symbol='sparkles']")).toBeTruthy();
  await act(async () => root.unmount());
  container.remove();
});

it("renders the native default Dock set when items are omitted", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MacDock />);
  });
  expect(Array.from(container.querySelectorAll(".p0-dock-item")).map((item) => item.getAttribute("aria-label"))).toEqual([
    "Finder",
    "App Store",
    "Google Chrome",
    "Downloads",
    "Trash",
  ]);
  expect(container.querySelectorAll(".p0-dock-divider")).toHaveLength(1);
  expect(container.querySelector<HTMLImageElement>("img[src='/mac-assets/dock/finder.png']")).toBeTruthy();
  await act(async () => root.unmount());
  container.remove();
});

it("opens a MacMenu and moves roving focus with arrows", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let picked = "";
  await act(async () => {
    root.render(
      <MacMenu
        label="Other ways"
        trigger={<span>Other ways</span>}
        items={[
          { kind: "action", id: "blank", label: "New Blank Vault", detail: "Create an empty Vault.", shortcut: "⌘N", onSelect: () => { picked = "blank"; } },
          { kind: "section", id: "more", label: "MORE" },
          { kind: "action", id: "budget", label: "Budget", checked: false, onSelect: () => { picked = "budget"; } },
          { kind: "separator", id: "sep" },
          { kind: "action", id: "gallery", label: "Browse Gallery…", href: "/?view=gallery" },
        ]}
      />,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>(".mc-menu-trigger");
  expect(trigger).toBeTruthy();
  await act(async () => {
    trigger?.focus();
    trigger?.click();
  });
  // react-aria portals the popover to document.body.
  const menu = document.querySelector("[role='menu']");
  expect(menu).toBeTruthy();
  expect(menu?.querySelectorAll("[role='menuitem'], [role='menuitemradio']")).toHaveLength(3);
  expect(menu?.querySelector(".mc-menu-item")?.children).toHaveLength(3);
  expect(menu?.querySelector(".mc-menu-label")?.textContent).toBe("New Blank Vault");
  expect(menu?.querySelector(".mc-menu-shortcut")?.textContent).toBe("⌘N");
  await act(async () => {
    // The menu opens with the first item ("blank") current; the arrow roves to
    // the next item, the radio "budget".
    menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  expect((document.activeElement as HTMLElement | null)?.getAttribute("data-key")).toBe("budget");
  await act(async () => {
    (document.activeElement as HTMLElement | null)?.click();
  });
  expect(picked).toBe("budget");
  expect(document.querySelector("[role='menu']")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));

  await act(async () => trigger?.click());
  const reopenedMenu = document.querySelector<HTMLElement>("[role='menu']");
  expect(reopenedMenu).toBeTruthy();
  await act(async () => {
    if (reopenedMenu !== null) fireEvent.keyDown(reopenedMenu, { code: "Escape", key: "Escape" });
  });
  expect(document.querySelector("[role='menu']")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await act(async () => root.unmount());
  container.remove();
});

it("uses the shared dialog popover for arbitrary toolbar and menu-bar content", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <>
        <MacPopover label="Help" trigger={<span>Help</span>}>
          <p>Popover help content.</p>
        </MacPopover>
        <MacDetailsMenu label="Account menu" summary={<SystemSymbol name="person.crop.circle" />}>
          <button type="button">Account Settings…</button>
        </MacDetailsMenu>
        <MenuBarExtra icon={<SystemSymbol name="shield.fill" />} label="Activity">
          <p>Two component notes are ready.</p>
        </MenuBarExtra>
      </>,
    );
  });

  const accountTrigger = container.querySelector<HTMLButtonElement>("button[aria-label='Account menu']");
  expect(accountTrigger).toBeTruthy();
  await act(async () => {
    accountTrigger?.focus();
    accountTrigger?.click();
  });
  expect(document.querySelector(".mc-details-menu-popover")).toBeTruthy();
  const accountDialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Account menu']");
  expect(accountDialog).toBeTruthy();
  expect(accountDialog?.dataset.contentInset).toBe("compact");
  expect(accountDialog?.closest(".mc-popover-surface")?.getAttribute("data-popover-layout")).toBe("content");

  await act(async () => {
    accountDialog?.focus();
    if (accountDialog !== null) fireEvent.keyDown(accountDialog, { code: "Escape", key: "Escape" });
  });
  expect(document.querySelector("[role='dialog'][aria-label='Account menu']")).toBeNull();
  expect(accountTrigger?.getAttribute("aria-expanded")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(accountTrigger));

  const activityTrigger = container.querySelector<HTMLButtonElement>("button[aria-label='Activity']");
  await act(async () => activityTrigger?.click());
  expect(document.querySelector(".mc-menubar-popover")).toBeTruthy();
  const activityDialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Activity']");
  expect(activityDialog?.textContent).toContain("Two component notes");
  expect(activityDialog?.dataset.contentInset).toBe("flush");
  expect(activityDialog?.closest(".mc-popover-surface")?.getAttribute("data-popover-layout")).toBe("status");

  await act(async () => activityTrigger?.click());
  const helpTrigger = container.querySelector<HTMLButtonElement>("button[aria-label='Help']");
  await act(async () => helpTrigger?.click());
  const helpDialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Help']");
  expect(helpDialog?.dataset.contentInset).toBe("regular");
  expect(helpDialog?.closest(".mc-popover-surface")?.getAttribute("data-popover-layout")).toBe("content");

  await act(async () => root.unmount());
  container.remove();
});

it("lets a controlled MenuBarExtra close before launching another modal", async () => {
  const changes: boolean[] = [];
  const triggerRef = createRef<HTMLButtonElement>();
  function ControlledExtra() {
    const [alertOpen, setAlertOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className="desktop-canvas">
        <MenuBarExtra
          icon={<SystemSymbol name="shield.fill" />}
          isOpen={isOpen}
          label="Controlled activity"
          onOpenChange={(open) => {
            changes.push(open);
            setIsOpen(open);
          }}
          triggerRef={triggerRef}
        >
          <button type="button" onClick={() => {
            setIsOpen(false);
            setAlertOpen(true);
          }}>Show alert</button>
        </MenuBarExtra>
        <MacAlert
          actions={[{ id: "okay", label: "OK", isDefault: true }]}
          fallbackFocusRef={triggerRef}
          message="The activity has been cleared."
          onClose={() => setAlertOpen(false)}
          open={alertOpen}
          presentationScope="desktop"
          title="Activity cleared"
        />
      </div>
    );
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ControlledExtra />));

  const trigger = triggerRef.current;
  expect(trigger).toBe(container.querySelector("button[aria-label='Controlled activity']"));
  await act(async () => {
    trigger?.focus();
    trigger?.click();
  });
  expect(changes).toEqual([true]);
  let dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Controlled activity']");
  expect(dialog).toBeTruthy();

  await act(async () => {
    if (dialog !== null) fireEvent.keyDown(dialog, { code: "Escape", key: "Escape" });
  });
  expect(changes).toEqual([true, false]);
  expect(document.querySelector("[role='dialog'][aria-label='Controlled activity']")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));

  await act(async () => trigger?.click());
  expect(changes).toEqual([true, false, true]);
  dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label='Controlled activity']");
  expect(dialog).toBeTruthy();

  const launchAlert = dialog?.querySelector<HTMLButtonElement>("button");
  await act(async () => launchAlert?.click());
  expect(document.querySelector("[role='dialog'][aria-label='Controlled activity']")).toBeNull();
  const alert = document.querySelector<HTMLElement>("[role='alertdialog']");
  expect(alert).toBeTruthy();
  expect(alert?.querySelector("h2")?.textContent).toBe("Activity cleared");

  await act(async () => alert?.querySelector<HTMLButtonElement>("button")?.click());
  expect(document.querySelector("[role='alertdialog']")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(triggerRef.current));
  expect(triggerRef.current).toBe(trigger);
  expect(container.querySelector(".desktop-canvas")?.getAttribute("aria-hidden")).not.toBe("true");

  await act(async () => root.unmount());
  container.remove();
});
