// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopShell, type MenuBarMenu } from "../desktop-shell";
import { MenuBarExtra } from "../menubar-app";
import { SystemSymbol } from "../system-symbol";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

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
    <DesktopShell appName="Test" menuItems={[items, "Edit", "View"]}>
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
  it("renders string entries inert and menu entries as real triggers", () => {
    const { container, getByRole, queryByRole } = renderShell();
    expect(getByRole("button", { name: "File" })).toBeTruthy();
    expect(queryByRole("button", { name: "Edit" })).toBeNull();
    expect(container.querySelector(".menu-left")?.textContent).toContain("Edit");
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
    fireEvent.mouseDown(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    expect(queryByRole("menu")).toBeNull();
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
