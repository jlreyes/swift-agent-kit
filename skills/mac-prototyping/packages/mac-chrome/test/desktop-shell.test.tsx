// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopShell, type MenuBarMenu } from "../desktop-shell";
import { MenuBarExtra } from "../menubar-app";
import { SystemSymbol } from "../system-symbol";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const fileMenu: MenuBarMenu = {
  title: "File",
  items: [
    { kind: "action", id: "new", label: "New Window" },
    { kind: "separator", id: "sep" },
    { kind: "action", id: "info", label: "Get Info" },
  ],
};

function renderShell(onPick?: () => void) {
  const items: MenuBarMenu = onPick
    ? { ...fileMenu, items: [{ kind: "action", id: "new", label: "New Window", onSelect: onPick }] }
    : fileMenu;
  return render(
    <DesktopShell appName="Test" menuItems={[items, "Edit", "View", "Window"]} onMenuAction={vi.fn()}>
      <p>Desktop</p>
    </DesktopShell>,
  );
}

async function flushFocus() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("DesktopShell menu bar menus", () => {
  it("renders the Apple, application, and every standard menu as real triggers", () => {
    const { container, getByRole } = renderShell();
    expect(getByRole("button", { name: "Apple" })).toBeTruthy();
    expect(getByRole("button", { name: "Test" })).toBeTruthy();
    expect(getByRole("button", { name: "File" })).toBeTruthy();
    expect(getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(getByRole("button", { name: "View" })).toBeTruthy();
    expect(container.querySelector(".apple-mark [data-system-symbol='apple.logo']")).toBeTruthy();
  });

  it("uses recognizable shared symbols for the native Apple menu commands", async () => {
    const { container, getByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "Apple" }));
    await flushFocus();

    const appleMenu = getByRole("menu", { name: "Apple menu" });
    expect(appleMenu.querySelector("[data-system-symbol='laptopcomputer']")).toBeTruthy();
    expect(appleMenu.querySelector("[data-system-symbol='gear']")).toBeTruthy();
    expect(appleMenu.querySelector("[data-system-symbol='app']")).toBeTruthy();
  });

  it("routes Apple menu commands through the same explicit command target", async () => {
    const onMenuAction = vi.fn();
    const { getByRole } = render(
      <DesktopShell appName="Test" onMenuAction={onMenuAction}>
        <p>Desktop</p>
      </DesktopShell>,
    );
    fireEvent.click(getByRole("button", { name: "Apple" }));
    await flushFocus();
    fireEvent.click(getByRole("menuitem", { name: "System Settings…" }));
    expect(onMenuAction).toHaveBeenCalledWith({
      menu: "Apple",
      id: "system-settings",
      label: "System Settings…",
    });
  });

  it("clicking a title opens its dropdown and highlights the title", async () => {
    const { getByRole, queryByRole } = renderShell();
    const trigger = getByRole("button", { name: "File" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    await flushFocus();
    // aria-expanded=true is the styling hook for the open-title highlight.
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = getByRole("menu", { name: "File menu" });
    expect(menu.querySelectorAll("[role='menuitem']")).toHaveLength(2);
    expect(queryByRole("menuitem", { name: /New Window/ })).toBeTruthy();
  });

  it("arrow keys move focus, Escape closes and restores the trigger", async () => {
    const { getByRole, queryByRole } = renderShell();
    const trigger = getByRole("button", { name: "File" });
    fireEvent.click(trigger);
    await flushFocus();
    const menu = getByRole("menu", { name: "File menu" });
    const items = Array.from(menu.querySelectorAll<HTMLElement>("[role='menuitem']"));
    // react-aria opens with focus on the menu and the first item current, so
    // the first arrow reaches the second item, and navigation wraps.
    expect(document.activeElement).toBe(menu);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1] as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0] as HTMLElement, { key: "Escape" });
    await flushFocus();
    expect(queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("selecting an item runs it and closes; click-away also closes", async () => {
    const picked = vi.fn();
    const { getByRole, queryByRole } = renderShell(picked);
    const trigger = getByRole("button", { name: "File" });
    fireEvent.click(trigger);
    await flushFocus();
    fireEvent.click(getByRole("menuitem", { name: "New Window" }));
    expect(picked).toHaveBeenCalledTimes(1);
    expect(queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    await flushFocus();
    expect(queryByRole("menu")).toBeTruthy();
    // react-aria's outside dismissal completes on the press *release*
    // (pointerdown arms it, click/mouseup outside dismisses).
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    expect(queryByRole("menu")).toBeNull();
  });

  it("switches directly to an adjacent menu while the menu bar is active", async () => {
    const { getByRole, queryByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "File" }));
    await flushFocus();
    expect(getByRole("menu", { name: "File menu" })).toBeTruthy();

    fireEvent.pointerEnter(getByRole("button", { name: "Edit" }));
    await flushFocus();
    expect(queryByRole("menu", { name: "File menu" })).toBeNull();
    expect(getByRole("menu", { name: "Edit menu" })).toBeTruthy();
  });

  it("moves between menu-bar menus with horizontal arrows", async () => {
    const { getByRole, queryByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "File" }));
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "File menu" }), { key: "ArrowRight" });
    await flushFocus();
    expect(queryByRole("menu", { name: "File menu" })).toBeNull();
    expect(getByRole("menu", { name: "Edit menu" })).toBeTruthy();
  });

  it("Tab dismisses the menu and advances to the next menu-bar title", async () => {
    const { getByRole, queryByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "File" }));
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "File menu" }), { key: "Tab" });
    await flushFocus();
    expect(queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(getByRole("button", { name: "Edit" }));
  });

  it("restores Tab and Shift-Tab focus relative to a menu switched while open", async () => {
    const { getByRole, queryByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "File" }));
    await flushFocus();
    fireEvent.pointerEnter(getByRole("button", { name: "Edit" }));
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "Edit menu" }), { key: "ArrowRight" });
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "View menu" }), { key: "Tab" });
    await flushFocus();
    expect(queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(getByRole("button", { name: "Window" }));

    fireEvent.click(getByRole("button", { name: "File" }));
    await flushFocus();
    fireEvent.pointerEnter(getByRole("button", { name: "Edit" }));
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "Edit menu" }), { key: "ArrowRight" });
    await flushFocus();
    fireEvent.keyDown(getByRole("menu", { name: "View menu" }), { key: "Tab", shiftKey: true });
    await flushFocus();
    expect(queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(getByRole("button", { name: "Edit" }));
  });

  it("routes built-in actions to an explicit target and disables them without one", async () => {
    const onMenuAction = vi.fn();
    const targeted = render(
      <DesktopShell appName="Test" onMenuAction={onMenuAction}>
        <p>Desktop</p>
      </DesktopShell>,
    );
    fireEvent.click(targeted.getByRole("button", { name: "Edit" }));
    await flushFocus();
    fireEvent.click(targeted.getByRole("menuitem", { name: /Undo/ }));
    expect(onMenuAction).toHaveBeenCalledWith({ menu: "Edit", id: "undo", label: "Undo" });
    targeted.unmount();

    const untargeted = render(
      <DesktopShell appName="Test">
        <p>Desktop</p>
      </DesktopShell>,
    );
    fireEvent.click(untargeted.getByRole("button", { name: "Edit" }));
    await flushFocus();
    expect(untargeted.getByRole("menuitem", { name: /Undo/ }).getAttribute("aria-disabled")).toBe("true");
  });

  it("shows native-style shortcut columns in the standard menus", async () => {
    const { getByRole } = renderShell();
    fireEvent.click(getByRole("button", { name: "Edit" }));
    await flushFocus();
    const undo = getByRole("menuitem", { name: /Undo/ });
    expect(undo.querySelector(".mc-menu-shortcut")?.textContent).toBe("⌘Z");
  });
});

describe("DesktopShell status items", () => {
  it("uses native symbolist glyphs inside accessible status wrappers", () => {
    const { container } = renderShell();
    expect(container.querySelector("[data-status-icon='battery'][aria-label='Battery'] [data-system-symbol='battery.100percent']")).toBeTruthy();
    expect(container.querySelector("[data-status-icon='wifi'][aria-label='Wi-Fi'] [data-system-symbol='wifi']")).toBeTruthy();
    expect(container.querySelector("[data-status-icon='control-center'][aria-label='Control Center'] [data-system-symbol='switch.2']")).toBeTruthy();
  });

  it("updates at the next wall-clock minute boundary and stays minute-aligned", () => {
    vi.useFakeTimers();
    const mountedAt = new Date("2026-08-26T16:34:45.250Z");
    vi.setSystemTime(mountedAt);
    const { container } = renderShell();
    const clockText = () => container.querySelector(".menu-right > span:last-child")?.textContent;
    const formatClock = (value: Date) => new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(value);

    expect(clockText()).toBe(formatClock(mountedAt));
    act(() => vi.advanceTimersByTime(14_749));
    expect(clockText()).toBe(formatClock(mountedAt));

    const firstBoundary = new Date(mountedAt.getTime() + 14_750);
    act(() => vi.advanceTimersByTime(1));
    expect(clockText()).toBe(formatClock(firstBoundary));

    act(() => vi.advanceTimersByTime(59_999));
    expect(clockText()).toBe(formatClock(firstBoundary));
    act(() => vi.advanceTimersByTime(1));
    expect(clockText()).toBe(formatClock(new Date(firstBoundary.getTime() + 60_000)));
  });

  it("keeps caller-supplied date and clock values without scheduling refreshes", () => {
    vi.useFakeTimers();
    const { getByText } = render(
      <DesktopShell appName="Test" date="Pinned date" clock="Pinned clock">
        <p>Desktop</p>
      </DesktopShell>,
    );

    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(120_000));
    expect(getByText("Pinned date")).toBeTruthy();
    expect(getByText("Pinned clock")).toBeTruthy();
  });
});

describe("DesktopShell menu-bar extras slot", () => {
  it("renders extras in flow beside the status items instead of overlaying them", () => {
    const { container } = render(
      <DesktopShell
        appName="Test"
        menuBarExtras={
          <MenuBarExtra icon={<SystemSymbol name="shield.fill" />} label="Activity">
            <p>Content</p>
          </MenuBarExtra>
        }
      >
        <p>Desktop</p>
      </DesktopShell>,
    );
    // The extra sits inside the status-item row (flow layout, no collision)...
    expect(container.querySelector(".menu-right .mc-menubar-extras .mc-menubar-layer")).toBeTruthy();
    // ...and standalone extras (outside the slot) keep the absolute fallback.
    expect(container.querySelector(".menu-right > .mc-menubar-layer")).toBeNull();
  });
});
