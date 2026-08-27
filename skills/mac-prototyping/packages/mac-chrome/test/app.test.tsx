// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toPng } from "html-to-image";
import { act, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { MacApp, MacAppDock, MacWindowManager, useMacWindowManager } from "../app.tsx";
import { DesktopShell } from "../desktop-shell.tsx";
import { SystemSymbol } from "../system-symbol.tsx";
import { TrafficLights, WindowChrome } from "../window.tsx";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,d2luZG93"),
}));

afterEach(() => {
  cleanup();
  vi.mocked(toPng).mockReset().mockResolvedValue("data:image/png;base64,d2luZG93");
  Reflect.deleteProperty(document, "startViewTransition");
});

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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
      <button type="button" onClick={() => manager.activateWindow("notes:main")}>Menu Activate</button>
      <button type="button" onClick={() => manager.openWindow("notes:main")}>Menu Open</button>
      <button type="button" onClick={() => manager.restoreWindow("notes:main")}>Menu Restore</button>
      <button type="button" onClick={() => manager.activateApp("notes")}>Activate Notes App</button>
      <button type="button" onClick={() => manager.activateApp("showcase")}>Activate Showcase App</button>
      <button type="button" onClick={() => manager.bringAllToFront("notes")}>Bring Notes Front</button>
      <button type="button" onClick={() => manager.bringAllToFront("showcase")}>Bring Showcase Front</button>
      <MacApp id="showcase" name="Showcase" icon={{ kind: "symbol", symbol: <SystemSymbol name="laptopcomputer" /> }}>
        <WindowChrome label="Showcase window">
          <div data-window-drag-handle="">
            <TrafficLights />
            <button type="button" onPointerDown={(event) => event.stopPropagation()}>Showcase action</button>
          </div>
        </WindowChrome>
      </MacApp>
      <MacApp id="notes" name="Notes" defaultRunning={false} icon={{ kind: "symbol", symbol: <SystemSymbol name="doc.text.fill" /> }}>
        <WindowChrome label="Notes window">
          <div data-window-drag-handle=""><TrafficLights /><button type="button">Notes action</button></div>
        </WindowChrome>
      </MacApp>
      <MacApp id="activity" name="Activity" presentation="menuBar" icon={{ kind: "symbol", symbol: <SystemSymbol name="sparkles" /> }}>
        <span data-testid="menu-bar-app-content" />
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

function RegistrationOwnershipHarness() {
  const [duplicateVisible, setDuplicateVisible] = useState(true);
  const [ephemeralVisible, setEphemeralVisible] = useState(true);
  const manifestApp = {
    id: "manifest",
    name: "Manifest",
    icon: { kind: "symbol" as const, symbol: <SystemSymbol name="laptopcomputer" /> },
  };
  return (
    <MacWindowManager initialApps={[manifestApp]}>
      <RegistrationOwnershipContents
        duplicateVisible={duplicateVisible}
        ephemeralVisible={ephemeralVisible}
        manifestApp={manifestApp}
        onHideDuplicate={() => setDuplicateVisible(false)}
        onHideEphemeral={() => setEphemeralVisible(false)}
      />
    </MacWindowManager>
  );
}

function RegistrationOwnershipContents({ duplicateVisible, ephemeralVisible, manifestApp, onHideDuplicate, onHideEphemeral }: {
  readonly duplicateVisible: boolean;
  readonly ephemeralVisible: boolean;
  readonly manifestApp: {
    readonly id: string;
    readonly name: string;
    readonly icon: { readonly kind: "symbol"; readonly symbol: ReactNode };
  };
  readonly onHideDuplicate: () => void;
  readonly onHideEphemeral: () => void;
}) {
  const manager = useMacWindowManager();
  return (
    <>
      <output aria-label="Registry">
        {manager.apps.map((app) => app.id).join(",")}|{manager.windows.map((window) => window.id).join(",")}
      </output>
      <button type="button" onClick={onHideDuplicate}>Hide duplicate</button>
      <button type="button" onClick={onHideEphemeral}>Hide ephemeral</button>
      <MacApp {...manifestApp}>
        <WindowChrome label="Manifest primary" windowId="manifest:main"><span /></WindowChrome>
      </MacApp>
      {duplicateVisible ? (
        <MacApp {...manifestApp}>
          <WindowChrome label="Manifest duplicate" windowId="manifest:main"><span /></WindowChrome>
        </MacApp>
      ) : null}
      {ephemeralVisible ? (
        <MacApp
          id="ephemeral"
          name="Ephemeral"
          icon={{ kind: "symbol", symbol: <SystemSymbol name="doc.text.fill" /> }}
        >
          <WindowChrome label="Ephemeral window" windowId="ephemeral:main"><span /></WindowChrome>
        </MacApp>
      ) : null}
    </>
  );
}

function DynamicWindowMetadataHarness() {
  const [label, setLabel] = useState("Original window");
  const [defaultOpen, setDefaultOpen] = useState(true);
  return (
    <MacWindowManager>
      <DynamicWindowMetadataContents
        defaultOpen={defaultOpen}
        label={label}
        onChangeDefaults={() => setDefaultOpen(false)}
        onRename={() => setLabel("Renamed window")}
      />
    </MacWindowManager>
  );
}

function DynamicWindowMetadataContents({ defaultOpen, label, onChangeDefaults, onRename }: {
  readonly defaultOpen: boolean;
  readonly label: string;
  readonly onChangeDefaults: () => void;
  readonly onRename: () => void;
}) {
  const manager = useMacWindowManager();
  const window = manager.windows.find((candidate) => candidate.id === "metadata:main");
  return (
    <>
      <output aria-label="Window metadata">
        {window === undefined ? "missing" : `${window.label}|${window.state}|${window.zoomed ? "zoomed" : "restored"}`}
      </output>
      <button type="button" onClick={() => manager.toggleZoom("metadata:main")}>Zoom metadata</button>
      <button type="button" onClick={onRename}>Rename metadata</button>
      <button type="button" onClick={onChangeDefaults}>Change metadata defaults</button>
      <MacApp
        id="metadata"
        name="Metadata"
        icon={{ kind: "symbol", symbol: <SystemSymbol name="doc.text.fill" /> }}
      >
        <WindowChrome defaultOpen={defaultOpen} label={label} windowId="metadata:main"><span /></WindowChrome>
      </MacApp>
    </>
  );
}

describe("Mac app and window management", () => {
  it("server-renders the immutable app manifest before registration effects run", () => {
    const html = renderToStaticMarkup(
      <MacWindowManager
        initialApps={[
          { id: "showcase", name: "Showcase", icon: { kind: "symbol", symbol: <SystemSymbol name="laptopcomputer" /> } },
          { id: "notes", name: "Notes", defaultRunning: false, icon: { kind: "symbol", symbol: <SystemSymbol name="doc.text.fill" /> } },
          { id: "activity", name: "Activity", presentation: "menuBar", icon: { kind: "symbol", symbol: <SystemSymbol name="sparkles" /> } },
        ]}
      >
        <MacAppDock label="Boot Dock" />
      </MacWindowManager>,
    );
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.querySelectorAll("[aria-label='Boot Dock'] .p0-dock-item")).toHaveLength(2);
    expect(container.querySelector("[aria-label='Showcase'] [data-system-symbol='laptopcomputer']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Notes'] [data-system-symbol='doc.text.fill']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Activity']")).toBeNull();
  });

  it("releases only the unmounted app and window registrations", async () => {
    render(<RegistrationOwnershipHarness />);
    await waitFor(() => expect(screen.getByLabelText("Registry").textContent).toBe(
      "manifest,ephemeral|manifest:main,ephemeral:main",
    ));

    fireEvent.click(screen.getByRole("button", { name: "Hide duplicate" }));
    await waitFor(() => expect(screen.getByLabelText("Registry").textContent).toBe(
      "manifest,ephemeral|manifest:main,ephemeral:main",
    ));

    fireEvent.click(screen.getByRole("button", { name: "Hide ephemeral" }));
    await waitFor(() => expect(screen.getByLabelText("Registry").textContent).toBe("manifest|manifest:main"));
  });

  it("updates a managed window label and defaults without resetting live state", async () => {
    render(<DynamicWindowMetadataHarness />);
    await waitFor(() => expect(screen.getByLabelText("Window metadata").textContent).toBe(
      "Original window|open|restored",
    ));

    fireEvent.click(screen.getByRole("button", { name: "Zoom metadata" }));
    await waitFor(() => expect(screen.getByLabelText("Window metadata").textContent).toBe(
      "Original window|open|zoomed",
    ));
    fireEvent.click(screen.getByRole("button", { name: "Rename metadata" }));
    fireEvent.click(screen.getByRole("button", { name: "Change metadata defaults" }));

    await waitFor(() => expect(screen.getByLabelText("Window metadata").textContent).toBe(
      "Renamed window|open|zoomed",
    ));
  });

  it("launches apps from the Dock and makes pointer- or focus-activated windows key", async () => {
    render(<ManagedDesktop />);

    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    expect(managedWindow("showcase")).toBeTruthy();
    expect(managedWindow("notes")).toBeNull();
    expect(managedDockButton("Showcase").classList.contains("is-running")).toBe(true);
    expect(managedDockButton("Notes").classList.contains("is-running")).toBe(false);
    expect(screen.queryByRole("button", { name: "Activity" })).toBeNull();
    expect(screen.getByTestId("menu-bar-app-content")).toBeTruthy();

    fireEvent.click(managedDockButton("Notes"));
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("notes:main"));
    const notesWindow = managedWindow("notes");
    const showcaseWindow = managedWindow("showcase");
    expect(notesWindow).toBeTruthy();
    expect(notesWindow?.dataset.keyWindow).toBe("true");
    expect(showcaseWindow?.dataset.keyWindow).toBe("false");
    expect(Number(notesWindow?.style.zIndex)).toBeGreaterThan(Number(showcaseWindow?.style.zIndex));

    fireEvent.pointerDown(screen.getByRole("button", { name: "Showcase action" }));
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    expect(managedWindow("showcase")?.dataset.keyWindow).toBe("true");

    fireEvent.keyDown(document, { key: "Tab" });
    act(() => screen.getByRole("button", { name: "Notes action" }).focus());
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("notes:main"));
    expect(managedWindow("notes")?.dataset.keyWindow).toBe("true");
  });

  it("minimizes, closes, restores, and zooms managed windows", async () => {
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return {};
    });
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: startViewTransition });
    render(<ManagedDesktop />);
    await act(async () => undefined);
    fireEvent.click(managedDockButton("Notes"));
    await act(async () => undefined);

    const notesWindow = managedWindow("notes");
    expect(notesWindow).toBeTruthy();
    if (!notesWindow) return;
    fireEvent.click(within(notesWindow).getByRole("button", { name: "Minimize window" }));
    await waitFor(() => expect(managedWindow("notes")).toBeNull());
    expect(managedDockButton("Notes").classList.contains("is-running")).toBe(true);

    const minimizedItem = managedDockButton("Notes window");
    expect(minimizedItem.classList.contains("is-window-thumbnail")).toBe(true);
    expect(minimizedItem.querySelector<HTMLImageElement>(".p0-window-thumbnail > img")?.src).toContain("data:image/png");
    expect(document.querySelectorAll(".p0-dock-divider")).toHaveLength(2);
    const dockLabels = within(screen.getByRole("navigation", { name: "Managed Dock" }))
      .getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(dockLabels.indexOf("Notes window")).toBeLessThan(dockLabels.indexOf("Trash"));
    expect(startViewTransition).toHaveBeenCalledTimes(1);

    fireEvent.click(minimizedItem);
    await waitFor(() => expect(managedWindow("notes")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Notes window" })).toBeNull();
    expect(screen.getByLabelText("Key window").textContent).toBe("notes:main");
    expect(startViewTransition).toHaveBeenCalledTimes(2);

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
    await waitFor(() => expect(managedWindow("notes")).toBeNull());
    expect(managedDockButton("Notes window")).toBeTruthy();
  });

  it.each(["Menu Activate", "Menu Open", "Menu Restore"])(
    "discards a pending thumbnail when %s supersedes minimization",
    async (commandLabel) => {
      const capture = deferred<string>();
      vi.mocked(toPng).mockReturnValueOnce(capture.promise);
      render(<ManagedDesktop />);
      await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
      fireEvent.click(managedDockButton("Notes"));

      fireEvent.click(screen.getByRole("button", { name: "Menu Minimize" }));
      await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: commandLabel }));
      await act(async () => capture.resolve("data:image/png;base64,c3RhbGU="));

      expect(managedWindow("notes")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Notes window" })).toBeNull();
    },
  );

  it.each(["Activate Notes App", "Bring Notes Front"])(
    "discards a pending thumbnail when %s affects its window",
    async (commandLabel) => {
      const capture = deferred<string>();
      vi.mocked(toPng).mockReturnValueOnce(capture.promise);
      render(<ManagedDesktop />);
      await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
      fireEvent.click(managedDockButton("Notes"));

      fireEvent.click(screen.getByRole("button", { name: "Menu Minimize" }));
      await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: commandLabel }));
      await act(async () => capture.resolve("data:image/png;base64,c3RhbGU="));

      expect(managedWindow("notes")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Notes window" })).toBeNull();
    },
  );

  it.each(["Activate Showcase App", "Bring Showcase Front"])(
    "keeps a pending thumbnail when %s affects only another app",
    async (commandLabel) => {
      const capture = deferred<string>();
      vi.mocked(toPng).mockReturnValueOnce(capture.promise);
      render(<ManagedDesktop />);
      await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
      fireEvent.click(managedDockButton("Notes"));

      fireEvent.click(screen.getByRole("button", { name: "Menu Minimize" }));
      await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: commandLabel }));
      await act(async () => capture.resolve("data:image/png;base64,d2luZG93"));

      await waitFor(() => expect(managedWindow("notes")).toBeNull());
      expect(managedDockButton("Notes window")).toBeTruthy();
    },
  );

  it("discards a pending thumbnail across close and reopen", async () => {
    const capture = deferred<string>();
    vi.mocked(toPng).mockReturnValueOnce(capture.promise);
    render(<ManagedDesktop />);
    await waitFor(() => expect(screen.getByLabelText("Key window").textContent).toBe("showcase:main"));
    fireEvent.click(managedDockButton("Notes"));

    fireEvent.click(screen.getByRole("button", { name: "Menu Minimize" }));
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    const notesWindow = managedWindow("notes");
    expect(notesWindow).toBeTruthy();
    if (!notesWindow) return;
    fireEvent.click(within(notesWindow).getByRole("button", { name: "Close window" }));
    fireEvent.click(managedDockButton("Notes"));
    await act(async () => capture.resolve("data:image/png;base64,c3RhbGU="));

    expect(managedWindow("notes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Notes window" })).toBeNull();
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
    await waitFor(() => expect(managedWindow("notes")).toBeNull());

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
    await waitFor(() => expect(managedWindow("notes")).toBeNull());
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
