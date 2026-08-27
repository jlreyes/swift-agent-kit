// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacApp, MacWindowManager } from "../app.tsx";
import { DesktopShell, type MenuBarMenu } from "../desktop-shell.tsx";
import { SystemSymbol } from "../system-symbol.tsx";
import { WindowChrome } from "../window.tsx";

afterEach(cleanup);

const app = {
  id: "managed",
  name: "Managed",
  icon: { kind: "symbol" as const, symbol: <SystemSymbol name="app" /> },
};

function ManagedMenuHarness({
  appName = "Managed",
  appMenuItems,
  menuItems,
  onMenuAction,
  secondaryWindow = false,
  windowId,
}: {
  readonly appName?: string;
  readonly appMenuItems?: MenuBarMenu["items"];
  readonly menuItems: readonly MenuBarMenu[];
  readonly onMenuAction?: (command: { readonly menu: string; readonly id: string; readonly label: string }) => void;
  readonly secondaryWindow?: boolean;
  readonly windowId?: string;
}) {
  return (
    <MacWindowManager initialApps={[app]}>
      <DesktopShell
        appName={appName}
        appMenuItems={appMenuItems}
        menuItems={menuItems}
        onMenuAction={onMenuAction}
      >
        <MacApp {...app}>
          <WindowChrome label="Managed window" windowId={windowId}><p>Managed content</p></WindowChrome>
          {secondaryWindow ? (
            <WindowChrome label="Secondary window" windowId="secondary"><p>Secondary content</p></WindowChrome>
          ) : null}
        </MacApp>
      </DesktopShell>
    </MacWindowManager>
  );
}

async function openMenu(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

async function openMenuButton(button: HTMLElement) {
  fireEvent.click(button);
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

describe("managed menu command composition", () => {
  it("distinguishes an app named File from the actual File menu", async () => {
    render(
      <ManagedMenuHarness
        appName="File"
        menuItems={[{
          title: "File",
          items: [{ kind: "action", id: "close-window", label: "Close Window" }],
        }]}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

    const [applicationMenu, fileMenu] = screen.getAllByRole("button", { name: "File" });
    expect(applicationMenu).toBeTruthy();
    expect(fileMenu).toBeTruthy();
    await openMenuButton(applicationMenu as HTMLElement);
    expect(screen.getByRole("menuitem", { name: "Hide File" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.getByRole("menuitem", { name: "Hide Others" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.getByRole("menuitem", { name: "Quit File" }).getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide Others" }));

    await openMenuButton(fileMenu as HTMLElement);
    fireEvent.click(screen.getByRole("menuitem", { name: "Close Window" }));
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeNull());
  });

  it("preserves a consumer File handler instead of replacing it with close-window behavior", async () => {
    const onSelect = vi.fn();
    render(
      <ManagedMenuHarness
        menuItems={[{
          title: "File",
          items: [{ kind: "action", id: "close-window", label: "Archive Window", onSelect }],
        }]}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

    await openMenu("File");
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive Window" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy();
  });

  it("preserves consumer links and explicit availability on managed command identifiers", async () => {
    render(
      <ManagedMenuHarness
        menuItems={[{
          title: "Window",
          items: [
            { kind: "action", id: "zoom", label: "Zoom Documentation", href: "/zoom-help" },
            { kind: "action", id: "minimize", label: "Pinned Minimize", disabled: false },
            { kind: "action", id: "bring-all-to-front", label: "Unavailable Arrangement", disabled: true },
          ],
        }]}
        onMenuAction={vi.fn()}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

    await openMenu("Window");
    expect(screen.getByRole("menuitem", { name: "Zoom Documentation" }).getAttribute("href")).toBe("/zoom-help");
    expect(screen.getByRole("menuitem", { name: "Pinned Minimize" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.getByRole("menuitem", { name: "Unavailable Arrangement" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("retains custom Window commands while adding the managed window list", async () => {
    const arrange = vi.fn();
    render(
      <ManagedMenuHarness
        menuItems={[{
          title: "Window",
          items: [{ kind: "action", id: "arrange", label: "Arrange Workspace", onSelect: arrange }],
        }]}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

    await openMenu("Window");
    fireEvent.click(screen.getByRole("menuitem", { name: "Arrange Workspace" }));
    expect(arrange).toHaveBeenCalledOnce();

    await openMenu("Window");
    expect(screen.getByRole("menuitemradio", { name: "Managed window" })).toBeTruthy();
  });

  it("reserves a collision-free ID for the generated window-list separator", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <ManagedMenuHarness
          menuItems={[{
            title: "Window",
            items: [{
              kind: "action",
              id: "managed-window-list-separator",
              label: "Consumer Separator Command",
              onSelect: () => undefined,
            }],
          }]}
        />,
      );
      await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

      await openMenu("Window");
      const menu = screen.getByRole("menu", { name: "Window menu" });
      expect(screen.getByRole("menuitem", { name: "Consumer Separator Command" })).toBeTruthy();
      expect(screen.getByRole("menuitemradio", { name: "Managed window" })).toBeTruthy();
      expect(menu.querySelectorAll(".menu-separator")).toHaveLength(1);
      expect(consoleError.mock.calls.flat().join("\n")).not.toMatch(/same key|two children with the same key/i);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps a managed window when its generated command ID collides with a consumer command", async () => {
    const consumerAction = vi.fn();
    render(
      <ManagedMenuHarness
        secondaryWindow
        windowId="main"
        menuItems={[{
          title: "Window",
          items: [{ kind: "action", id: "window-main", label: "Consumer Main Command", onSelect: consumerAction }],
        }]}
      />,
    );
    const mainWindow = await waitFor(() => screen.getByRole("region", { name: "Managed window" }));
    const secondaryWindow = screen.getByRole("region", { name: "Secondary window" });
    fireEvent.pointerDown(secondaryWindow);
    await waitFor(() => expect(secondaryWindow.getAttribute("data-key-window")).toBe("true"));
    expect(mainWindow.getAttribute("data-key-window")).toBe("false");

    await openMenu("Window");
    expect(screen.getByRole("menuitem", { name: "Consumer Main Command" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "Managed window" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Consumer Main Command" }));
    expect(consumerAction).toHaveBeenCalledOnce();
    expect(mainWindow.getAttribute("data-key-window")).toBe("false");

    await openMenu("Window");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Managed window" }));
    await waitFor(() => expect(mainWindow.getAttribute("data-key-window")).toBe("true"));
  });

  it("preserves consumer application-menu lifecycle commands", async () => {
    const quit = vi.fn();
    render(
      <ManagedMenuHarness
        appMenuItems={[{ kind: "action", id: "quit-app", label: "Keep Managed Running", onSelect: quit }]}
        menuItems={[]}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy());

    await openMenu("Managed");
    fireEvent.click(screen.getByRole("menuitem", { name: "Keep Managed Running" }));

    expect(quit).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-window-id='managed:main']")).toBeTruthy();
  });
});
