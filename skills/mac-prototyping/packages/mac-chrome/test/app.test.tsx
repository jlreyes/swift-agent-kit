// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacApp, MacAppDock, MacWindowManager, useMacWindowManager } from "../app.tsx";
import { DesktopShell } from "../desktop-shell.tsx";
import { SystemSymbol } from "../system-symbol.tsx";
import { TrafficLights, WindowChrome } from "../window.tsx";

afterEach(cleanup);

function ManagedDesktop() {
  return (
    <MacWindowManager>
      <ManagedDesktopContents />
    </MacWindowManager>
  );
}

function ManagedDesktopContents() {
  const manager = useMacWindowManager();
  const keyAppName = manager.apps.find((app) => app.id === manager.keyAppId)?.name ?? "Showcase";
  return (
    <DesktopShell appName={keyAppName} menuItems={["File", "Window"]}>
      <output aria-label="Key window">{manager.keyWindowId ?? "none"}</output>
      <button type="button" onClick={() => manager.toggleZoom("notes:main")}>Menu Zoom</button>
      <button type="button" onClick={() => manager.minimizeWindow("notes:main")}>Menu Minimize</button>
      <MacApp id="showcase" name="Showcase" icon={{ kind: "symbol", symbol: <SystemSymbol name="laptopcomputer" /> }}>
        <WindowChrome label="Showcase window">
          <div data-window-drag-handle=""><TrafficLights /><button type="button">Showcase action</button></div>
        </WindowChrome>
      </MacApp>
      <MacApp id="notes" name="Notes" defaultRunning={false} icon={{ kind: "symbol", symbol: <SystemSymbol name="doc.text.fill" /> }}>
        <WindowChrome label="Notes window">
          <div data-window-drag-handle=""><TrafficLights /><button type="button">Notes action</button></div>
        </WindowChrome>
      </MacApp>
      <MacAppDock
        label="Managed Dock"
        extraItems={[{ id: "trash", label: "Trash", icon: "/trash.png", group: "places", onActivate: () => undefined }]}
      />
    </DesktopShell>
  );
}

function managedWindow(id: string) {
  return document.querySelector<HTMLElement>(`[data-window-id='${id}:main']`);
}

function managedDockButton(name: string) {
  return within(screen.getByRole("navigation", { name: "Managed Dock" })).getByRole("button", { name });
}

describe("Mac app and window management", () => {
  it("launches apps from the Dock and makes pointer- or focus-activated windows key", async () => {
    render(<ManagedDesktop />);

    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    expect(managedWindow("showcase")).toBeTruthy();
    expect(managedWindow("notes")).toBeNull();
    expect(managedDockButton("Showcase").classList.contains("is-running")).toBe(true);
    expect(managedDockButton("Notes").classList.contains("is-running")).toBe(false);

    fireEvent.click(managedDockButton("Notes"));
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("notes:main"));
    const notesWindow = managedWindow("notes");
    const showcaseWindow = managedWindow("showcase");
    expect(notesWindow).toBeTruthy();
    expect(notesWindow?.dataset.keyWindow).toBe("true");
    expect(showcaseWindow?.dataset.keyWindow).toBe("false");
    expect(Number(notesWindow?.style.zIndex)).toBeGreaterThan(Number(showcaseWindow?.style.zIndex));

    if (showcaseWindow) fireEvent.pointerDown(showcaseWindow);
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    expect(managedWindow("showcase")?.dataset.keyWindow).toBe("true");

    fireEvent.keyDown(document, { key: "Tab" });
    act(() => screen.getByRole("button", { name: "Notes action" }).focus());
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("notes:main"));
    expect(managedWindow("notes")?.dataset.keyWindow).toBe("true");
  });

  it("minimizes, closes, restores, and zooms managed windows", async () => {
    vi.useFakeTimers();
    try {
      render(<ManagedDesktop />);
      await act(async () => undefined);
      fireEvent.click(managedDockButton("Notes"));
      await act(async () => undefined);

      const notesWindow = managedWindow("notes");
      expect(notesWindow).toBeTruthy();
      if (!notesWindow) return;
      fireEvent.click(within(notesWindow).getByRole("button", { name: "Minimize window" }));
      expect(notesWindow.classList.contains("mc-minimizing")).toBe(true);
      act(() => vi.advanceTimersByTime(300));
      expect(managedWindow("notes")).toBeNull();
      expect(managedDockButton("Notes").classList.contains("is-running")).toBe(true);

      fireEvent.click(managedDockButton("Notes"));
      expect(managedWindow("notes")).toBeTruthy();
      expect(screen.getByLabelText("Key window").textContent).toBe("notes:main");

      const restoredWindow = managedWindow("notes");
      if (!restoredWindow) return;
      fireEvent.click(within(restoredWindow).getByRole("button", { name: "Close window" }));
      expect(managedWindow("notes")).toBeNull();
      fireEvent.click(managedDockButton("Notes"));
      expect(managedWindow("notes")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Menu Zoom" }));
      expect(managedWindow("notes")?.classList.contains("mc-zoomed")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Menu Zoom" }));
      expect(managedWindow("notes")?.classList.contains("mc-zoomed")).toBe(false);

      fireEvent.click(screen.getByRole("button", { name: "Menu Minimize" }));
      expect(managedWindow("notes")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes the standard File and Window menus to the key managed window", async () => {
    render(<ManagedDesktop />);
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    fireEvent.click(managedDockButton("Notes"));

    fireEvent.click(screen.getByRole("button", { name: "Window" }));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(screen.getByRole("menuitemradio", { name: "Notes window" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitem", { name: "Zoom" }));
    expect(managedWindow("notes")?.classList.contains("mc-zoomed")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Window" }));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    fireEvent.click(screen.getByRole("menuitem", { name: "Minimize" }));
    expect(managedWindow("notes")).toBeNull();

    fireEvent.click(managedDockButton("Notes"));
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close Window" }));
    expect(managedWindow("notes")).toBeNull();
  });

  it("binds the active app menu to hide and quit lifecycle actions", async () => {
    render(<ManagedDesktop />);
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    fireEvent.click(managedDockButton("Notes"));

    const appMenu = screen.getAllByRole("button", { name: "Notes" })
      .find((button) => button.classList.contains("mc-menubar-menu-title"));
    expect(appMenu).toBeTruthy();
    fireEvent.click(appMenu as HTMLButtonElement);
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide Notes" }));
    expect(managedWindow("notes")).toBeNull();
    expect(managedDockButton("Notes").classList.contains("is-running")).toBe(true);

    fireEvent.click(managedDockButton("Notes"));
    const reopenedAppMenu = screen.getAllByRole("button", { name: "Notes" })
      .find((button) => button.classList.contains("mc-menubar-menu-title"));
    fireEvent.click(reopenedAppMenu as HTMLButtonElement);
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    fireEvent.click(screen.getByRole("menuitem", { name: "Quit Notes" }));
    expect(managedWindow("notes")).toBeNull();
    expect(managedDockButton("Notes").classList.contains("is-running")).toBe(false);
  });
});
