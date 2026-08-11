// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import {
  DesktopShell,
  MacDock,
  MacMenu,
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
          { kind: "action", id: "blank", label: "New Blank Vault", detail: "Create an empty Vault.", onSelect: () => { picked = "blank"; } },
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
    trigger?.click();
  });
  const menu = container.querySelector("[role='menu']");
  expect(menu).toBeTruthy();
  expect(menu?.querySelectorAll("[role='menuitem'], [role='menuitemradio']")).toHaveLength(3);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  await act(async () => {
    (document.activeElement as HTMLElement | null)?.click();
  });
  expect(picked).toBe("blank");
  expect(container.querySelector("[role='menu']")).toBeNull();
  await act(async () => root.unmount());
  container.remove();
});
