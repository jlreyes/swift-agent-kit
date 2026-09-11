// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacApp, MacAppDock, MacWindowManager, type MacAppDefinition } from "../app.tsx";
import { DesktopShell } from "../desktop-shell.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { MacMenu, MacPopover } from "../menu.tsx";
import { MenuBarExtra } from "../menubar-app.tsx";
import { TrafficLights, WindowChrome } from "../window.tsx";
import { MacAlert } from "../presentation.tsx";
import { MacWindowModalHost } from "../window-modal-host.tsx";

vi.mock("html-to-image", () => ({ toPng: vi.fn(async () => "data:image/png;base64,d2luZG93") }));

afterEach(cleanup);

const notes: MacAppDefinition = { id: "notes", name: "Notes", icon: { kind: "systemSymbol", name: "doc.text.fill" } };

function EmbeddedDesktop({ menuBar = true, windowManagement = true }: { readonly menuBar?: boolean; readonly windowManagement?: boolean }) {
  const [count, setCount] = useState(0);
  return (
    <MacEmbeddedPresentation menuBar={menuBar} windowManagement={windowManagement} height={560}>
      <MacWindowManager initialApps={[notes]}>
        <DesktopShell appName="Notes" mobileReviewMode="fixed-desktop" menuItems={["File", "Window"]} menuBarExtras={<MenuBarExtra label="Status details" icon={<span>Status</span>}><p>Status content</p></MenuBarExtra>}>
          <MacApp {...notes}>
            <WindowChrome label="Notes window" frame={{ width: 900, height: 700 }}>
              <div data-window-drag-handle=""><TrafficLights /></div>
              <button type="button" onClick={() => setCount(count + 1)}>Count {count}</button>
              <MacMenu label="Document menu" trigger="Document actions" items={[{ kind: "action", id: "inspect", label: "Inspect" }]} />
              <MacPopover label="Document details" trigger="Details"><p>Details content</p></MacPopover>
            </WindowChrome>
          </MacApp>
          <MacAppDock />
        </DesktopShell>
      </MacWindowManager>
    </MacEmbeddedPresentation>
  );
}

describe("embedded presentation", () => {
  it("defaults to one full-size window with inert traffic lights, no menu bar, and no Dock", () => {
    const callbacks = { close: vi.fn(), minimize: vi.fn(), zoom: vi.fn() };
    const { container } = render(<MacEmbeddedPresentation><MacWindowManager initialApps={[notes]}><DesktopShell appName="Notes"><MacApp {...notes}><WindowChrome label="Static window"><TrafficLights onClose={callbacks.close} onMinimize={callbacks.minimize} onZoom={callbacks.zoom} /></WindowChrome></MacApp><MacAppDock /></DesktopShell></MacWindowManager></MacEmbeddedPresentation>);
    const window = screen.getByRole("region", { name: "Static window" });
    expect(window.style.left).toBe("0px");
    expect(container.querySelector(".mc-embedded-presentation")?.getAttribute("data-embedded-menu-bar")).toBe("false");
    expect(container.querySelector(".mc-embedded-presentation")?.getAttribute("data-embedded-window-management")).toBe("false");
    expect(container.querySelector(".mac-menu-bar")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Dock" })).toBeNull();
    const trafficLights = container.querySelector(".traffic-lights");
    expect(trafficLights?.querySelectorAll("span")).toHaveLength(3);
    expect(trafficLights?.querySelectorAll("button")).toHaveLength(0);
    trafficLights?.querySelectorAll("span").forEach((dot) => fireEvent.click(dot));
    expect(callbacks.close).not.toHaveBeenCalled();
    expect(callbacks.minimize).not.toHaveBeenCalled();
    expect(callbacks.zoom).not.toHaveBeenCalled();
  });

  it("can expose the real menu bar without enabling window-management commands", async () => {
    render(<EmbeddedDesktop windowManagement={false} />);
    const window = screen.getByRole("region", { name: "Notes window" });
    fireEvent.click(screen.getByRole("button", { name: "Window" }));
    const minimize = await screen.findByRole("menuitem", { name: "Minimize" });
    expect(minimize.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Zoom" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(minimize);
    expect(window.hidden).toBe(false);
    fireEvent.keyDown(screen.getByRole("menu", { name: "Window menu" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect((await screen.findByRole("menuitem", { name: "Close Window" })).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(screen.getByRole("menu", { name: "File menu" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect((await screen.findByRole("menuitem", { name: "Quit Notes" })).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Hide Notes" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(screen.getByRole("menu", { name: "Notes menu" }), { key: "Escape" });
    for (const key of ["m", "w", "q"]) fireEvent.keyDown(window, { key, metaKey: true });
    expect(window.hidden).toBe(false);
    expect(window.classList.contains("mc-zoomed")).toBe(false);
    expect(screen.queryByRole("navigation", { name: "Dock" })).toBeNull();
  });

  it("refreshes the clock immediately when a hidden menu bar becomes visible", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-11T10:01:05"));
      const { container, rerender } = render(<EmbeddedDesktop menuBar={false} />);
      const currentTime = new Date("2026-09-11T10:04:12");
      vi.setSystemTime(currentTime);
      rerender(<EmbeddedDesktop menuBar />);
      const expected = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(currentTime);
      expect(container.querySelector(".menu-right > span:last-child")?.textContent).toBe(expected);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders a bounded initial frame without desktop dragging or resize affordances", () => {
    const html = renderToStaticMarkup(<EmbeddedDesktop />);
    expect(html).toContain('height:560px');
    expect(html).toContain('data-embedded-window="true"');
    expect(html).toContain('data-window-resizable="false"');
    expect(html).not.toContain('data-mobile-review-mode="fixed-desktop"');
    expect(html).not.toContain('data-window-resize-handle');
    const { container } = render(<EmbeddedDesktop />);
    const window = screen.getByRole("region", { name: "Notes window" });
    const initialStyle = window.getAttribute("style");
    const handle = window.querySelector("[data-window-drag-handle]");
    expect(handle).not.toBeNull();
    if (handle === null) throw new Error("Missing drag handle");
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 30, clientY: 30 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 180, clientY: 180 });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(window.getAttribute("style")).toBe(initialStyle);
    expect(container.querySelectorAll("[data-window-resize-handle]")).toHaveLength(0);
  });

  it("uses the same registry to zoom, minimize, restore, close, and reopen without discarding state", async () => {
    render(<EmbeddedDesktop />);
    const window = screen.getByRole("region", { name: "Notes window" });
    fireEvent.click(screen.getByRole("button", { name: "Count 0" }));
    fireEvent.click(within(window).getByRole("button", { name: "Zoom window" }));
    expect(window.classList.contains("mc-zoomed")).toBe(true);
    expect(window.style.left).toBe("0px");
    fireEvent.click(within(window).getByRole("button", { name: "Zoom window" }));
    expect(window.classList.contains("mc-zoomed")).toBe(false);
    fireEvent.click(within(window).getByRole("button", { name: "Minimize window" }));
    const dock = screen.getByRole("navigation", { name: "Dock" });
    const restore = await within(dock).findByRole("button", { name: "Notes window" });
    expect(restore.classList.contains("is-window-thumbnail")).toBe(true);
    expect(restore.querySelector("img")?.getAttribute("src")).toContain("data:image/png");
    expect(within(dock).getByRole("button", { name: "Notes" }).classList.contains("is-running")).toBe(true);
    fireEvent.click(restore);
    expect(screen.getByRole("button", { name: "Count 1" })).toBeTruthy();
    fireEvent.click(within(window).getByRole("button", { name: "Close window" }));
    expect(screen.queryByRole("region", { name: "Notes window" })).toBeNull();
    fireEvent.click(within(dock).getByRole("button", { name: "Notes" }));
    expect(screen.getByRole("button", { name: "Count 1" })).toBeTruthy();
  });

  it("keeps optional real menu commands synchronized with the window controls", async () => {
    const { rerender } = render(<EmbeddedDesktop />);
    fireEvent.click(screen.getByRole("button", { name: "Window" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Zoom" }));
    expect(screen.getByRole("region", { name: "Notes window" }).classList.contains("mc-zoomed")).toBe(true);
    rerender(<EmbeddedDesktop menuBar={false} />);
    expect(screen.queryByRole("button", { name: "Window" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Dock" })).toBeTruthy();
  });

  it("keeps initially open window modals inside the embedded root", async () => {
    const { container } = render(<>
      <section className="mac-window" data-key-window="true" data-testid="outside-window" />
      <MacEmbeddedPresentation>
        <section className="mac-window" data-key-window="true" data-testid="inside-window" />
        <MacWindowModalHost open kind="sheet" role="dialog" ariaLabel="Embedded sheet" className="fixture-sheet">
          <button type="button">Sheet action</button>
        </MacWindowModalHost>
      </MacEmbeddedPresentation>
    </>);
    const dialog = await screen.findByRole("dialog", { name: "Embedded sheet" });
    expect(dialog.closest(".mac-window")).toBe(container.querySelector('[data-testid="inside-window"]'));
    expect(container.querySelector('[data-testid="outside-window"]')?.contains(dialog)).toBe(false);
  });

  it("uses its own canvas for an initially open desktop alert", async () => {
    const { container } = render(<>
      <div className="desktop-canvas" data-testid="outside-canvas" />
      <MacEmbeddedPresentation>
        <DesktopShell appName="Embedded"><div>Canvas content</div></DesktopShell>
        <MacAlert open onClose={() => undefined} title="Embedded alert" message="Local canvas" presentationScope="desktop" actions={[{ id: "close", label: "Close" }]} />
      </MacEmbeddedPresentation>
    </>);
    const alert = await screen.findByRole("alertdialog", { name: "Embedded alert" });
    expect(alert.closest(".desktop-canvas")).toBe(container.querySelector(".mc-embedded-presentation .desktop-canvas"));
    expect(container.querySelector('[data-testid="outside-canvas"]')?.contains(alert)).toBe(false);
  });

  it("mounts an initially open popover into the ready embedded root", async () => {
    const { container } = render(
      <MacEmbeddedPresentation>
        <MacPopover isOpen label="Initially open details" trigger="Details"><p>Ready content</p></MacPopover>
      </MacEmbeddedPresentation>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Initially open details" });
    expect(container.querySelector(".mc-embedded-presentation")?.contains(dialog)).toBe(true);
  });

  it.each([
    { trigger: "Document actions", role: "menu", label: "Document menu" },
    { trigger: "Document details", role: "dialog", label: "Document details" },
    { trigger: "Status details", role: "dialog", label: "Status details" },
  ])("portals $label into the embedded root and dismisses with Escape", async ({ trigger, role, label }) => {
    const { container } = render(<EmbeddedDesktop />);
    const root = container.querySelector(".mc-embedded-presentation");
    const button = screen.getByRole("button", { name: trigger });
    act(() => button.focus());
    fireEvent.click(button);
    const overlay = await screen.findByRole(role, { name: label });
    expect(root?.contains(overlay)).toBe(true);
    fireEvent.keyDown(overlay, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole(role, { name: label })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});
