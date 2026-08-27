// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ChatWindow,
  ChooserWindow,
  createStoredIdList,
  defaultDockItems,
  DesktopShell,
  finderKeyTarget,
  FinderWindow,
  MacApp,
  MacAppDock,
  MacDock,
  MacInspector,
  MacMenu,
  MacNavigationSplitView,
  MacPopover,
  MacSheet,
  MacSourceList,
  Sheet,
  SetupAssistant,
  useMacWindowManager,
  MacWindowManager,
  WindowChrome,
} from "../lib/mac-chrome/index.ts";

beforeEach(() => {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  Reflect.deleteProperty(window, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("template stub public behavior", () => {
  test("DesktopShell exposes functional Apple and app menus and switches open menus", async () => {
    const onMenuAction = vi.fn();
    const user = userEvent.setup();
    render(<DesktopShell appName="Prototype" onMenuAction={onMenuAction}><div /></DesktopShell>);

    await user.click(screen.getByRole("button", { name: "Apple" }));
    expect(await screen.findByRole("menuitem", { name: /About This Mac/ })).toBeDefined();

    await user.hover(screen.getByRole("button", { name: "Prototype" }));
    expect(await screen.findByRole("menuitem", { name: /About Prototype/ })).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: /About This Mac/ })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: /About Prototype/ }));
    expect(onMenuAction).toHaveBeenCalledWith({ menu: "Prototype", id: "about-app", label: "About Prototype" });
  });

  test("DesktopShell defaults to live host-local date and time", () => {
    vi.useFakeTimers();
    const initial = new Date(2026, 7, 26, 12, 34, 45, 250);
    vi.setSystemTime(initial);
    render(<DesktopShell appName="Prototype"><div /></DesktopShell>);
    const status = screen.getByLabelText("Mac status items");
    const nativeDate = (date: Date) => {
      const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).formatToParts(date);
      const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
      return `${value("weekday")} ${value("month")} ${value("day")}`;
    };
    const nativeClock = (date: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
    expect(status.textContent).toContain(nativeDate(initial));
    expect(status.textContent).toContain(nativeClock(initial));

    act(() => vi.advanceTimersByTime(14_749));
    expect(status.textContent).toContain(nativeClock(initial));
    const nextMinute = new Date(2026, 7, 26, 12, 35);
    act(() => vi.advanceTimersByTime(1));
    expect(status.textContent).toContain(nativeClock(nextMinute));
    act(() => vi.advanceTimersByTime(59_999));
    expect(status.textContent).toContain(nativeClock(nextMinute));
    const followingMinute = new Date(2026, 7, 26, 12, 36);
    act(() => vi.advanceTimersByTime(1));
    expect(status.textContent).toContain(nativeClock(followingMinute));
  });

  test("DesktopShell standard menus expose the complete built-in command groups", async () => {
    const onMenuAction = vi.fn();
    const user = userEvent.setup();
    render(<DesktopShell appName="Prototype" onMenuAction={onMenuAction}><div /></DesktopShell>);

    await user.click(screen.getByRole("button", { name: "File" }));
    const fileMenu = await screen.findByRole("menu", { name: "File menu" });
    expect(fileMenu.querySelectorAll('[role="separator"]')).toHaveLength(2);
    await user.click(within(fileMenu).getByRole("menuitem", { name: /Get Info/ }));
    expect(onMenuAction).toHaveBeenLastCalledWith({ menu: "File", id: "get-info", label: "Get Info" });

    await user.click(screen.getByRole("button", { name: "Window" }));
    const windowMenu = await screen.findByRole("menu", { name: "Window menu" });
    expect(windowMenu.querySelectorAll('[role="separator"]')).toHaveLength(1);
    await user.click(within(windowMenu).getByRole("menuitem", { name: "Bring All to Front" }));
    expect(onMenuAction).toHaveBeenLastCalledWith({ menu: "Window", id: "bring-all-to-front", label: "Bring All to Front" });

    await user.click(screen.getByRole("button", { name: "Help" }));
    const helpMenu = await screen.findByRole("menu", { name: "Help menu" });
    expect(helpMenu.querySelectorAll('[role="separator"]')).toHaveLength(1);
    await user.click(within(helpMenu).getByRole("menuitem", { name: "Search" }));
    expect(onMenuAction).toHaveBeenLastCalledWith({ menu: "Help", id: "search-help", label: "Search" });
  });

  test("DesktopShell routes File and Window commands through MacWindowManager without an action callback", async () => {
    const app = { id: "managed-menus", name: "Prototype", icon: <span>Icon</span> } as const;
    function ManagedMenuProbe() {
      const manager = useMacWindowManager();
      const windows = manager.windows.map((window) => `${window.id}:${window.state}:${window.zoomed ? "zoomed" : "normal"}`).join(",");
      return <output data-testid="managed-menu-state">{`${manager.keyWindowId ?? "none"}|${windows}`}</output>;
    }
    const user = userEvent.setup();
    render(
      <MacWindowManager initialApps={[app]}>
        <MacApp {...app}>
          <DesktopShell appName="Prototype">
            <WindowChrome label="First Window" windowId="first">First</WindowChrome>
            <WindowChrome label="Second Window" windowId="second">Second</WindowChrome>
            <ManagedMenuProbe />
          </DesktopShell>
        </MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByTestId("managed-menu-state").textContent).toBe("second|first:open:normal,second:open:normal"));

    await user.click(screen.getByRole("button", { name: "Window" }));
    let menu = await screen.findByRole("menu", { name: "Window menu" });
    expect(within(menu).getByRole("menuitemradio", { name: "Second Window" }).getAttribute("aria-checked")).toBe("true");
    await user.click(within(menu).getByRole("menuitem", { name: "Zoom" }));
    expect(screen.getByTestId("managed-menu-state").textContent).toBe("second|first:open:normal,second:open:zoomed");

    await user.click(screen.getByRole("button", { name: "Window" }));
    menu = await screen.findByRole("menu", { name: "Window menu" });
    await user.click(within(menu).getByRole("menuitem", { name: "Bring All to Front" }));
    expect(screen.getByTestId("managed-menu-state").textContent?.startsWith("second|")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Window" }));
    menu = await screen.findByRole("menu", { name: "Window menu" });
    await user.click(within(menu).getByRole("menuitemradio", { name: "First Window" }));
    expect(screen.getByTestId("managed-menu-state").textContent?.startsWith("first|")).toBe(true);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(within(await screen.findByRole("menu", { name: "File menu" })).getByRole("menuitem", { name: /Close Window/ }));
    expect(screen.getByTestId("managed-menu-state").textContent).toBe("second|first:closed:normal,second:open:zoomed");

    await user.click(screen.getByRole("button", { name: "Window" }));
    await user.click(within(await screen.findByRole("menu", { name: "Window menu" })).getByRole("menuitem", { name: /Minimize/ }));
    expect(screen.getByTestId("managed-menu-state").textContent).toBe("none|first:closed:normal,second:minimized:zoomed");
  });

  test("DesktopShell application commands hide, hide others, and quit the key app", async () => {
    const other = { id: "other-app", name: "Other", icon: <span>Other icon</span> } as const;
    const active = { id: "active-app", name: "Prototype", icon: <span>Active icon</span> } as const;
    function ApplicationMenuProbe() {
      const manager = useMacWindowManager();
      const apps = manager.apps.map((app) => `${app.id}:${app.running ? "running" : "quit"}`).join(",");
      const windows = manager.windows.map((window) => `${window.id}:${window.state}`).join(",");
      return (
        <>
          <button type="button" onClick={() => manager.activateApp(active.id)}>Reactivate Prototype</button>
          <output data-testid="application-menu-state">{`${manager.keyWindowId ?? "none"}|${apps}|${windows}`}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <MacWindowManager initialApps={[other, active]}>
        <MacApp {...other}><WindowChrome label="Other Window" windowId="other">Other</WindowChrome></MacApp>
        <MacApp {...active}>
          <DesktopShell appName="Prototype">
            <WindowChrome label="Prototype Window" windowId="active">Active</WindowChrome>
            <ApplicationMenuProbe />
          </DesktopShell>
        </MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByTestId("application-menu-state").textContent?.startsWith("active|")).toBe(true));

    await user.click(screen.getByRole("button", { name: "Prototype" }));
    await user.click(within(await screen.findByRole("menu", { name: "Prototype menu" })).getByRole("menuitem", { name: /Hide Others/ }));
    expect(screen.getByTestId("application-menu-state").textContent).toContain("other:minimized,active:open");

    await user.click(screen.getByRole("button", { name: "Prototype" }));
    await user.click(within(await screen.findByRole("menu", { name: "Prototype menu" })).getByRole("menuitem", { name: /Hide Prototype/ }));
    expect(screen.getByTestId("application-menu-state").textContent?.startsWith("none|")).toBe(true);
    expect(screen.getByTestId("application-menu-state").textContent).toContain("other:minimized,active:minimized");

    await user.click(screen.getByRole("button", { name: "Reactivate Prototype" }));
    expect(screen.getByTestId("application-menu-state").textContent?.startsWith("active|")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Prototype" }));
    await user.click(within(await screen.findByRole("menu", { name: "Prototype menu" })).getByRole("menuitem", { name: /Quit Prototype/ }));
    expect(screen.getByTestId("application-menu-state").textContent).toContain("active-app:quit");
    expect(screen.getByTestId("application-menu-state").textContent).toContain("active:closed");
  });

  test("DesktopShell distinguishes an app named File from the standard File menu", async () => {
    const app = { id: "file-app", name: "File", icon: <span>File icon</span> } as const;
    function FileMenuCollisionProbe() {
      const manager = useMacWindowManager();
      const window = manager.windows.find((candidate) => candidate.id === "file-window");
      return (
        <>
          <button type="button" onClick={() => manager.activateApp(app.id)}>Reactivate File app</button>
          <output data-testid="file-menu-collision-state">
            {`${manager.keyWindowId ?? "none"}|${window?.state ?? "missing"}`}
          </output>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <MacWindowManager initialApps={[app]}>
        <MacApp {...app}>
          <DesktopShell appName="File">
            <WindowChrome label="File Window" windowId="file-window">File content</WindowChrome>
            <FileMenuCollisionProbe />
          </DesktopShell>
        </MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByTestId("file-menu-collision-state").textContent).toBe("file-window|open"));

    let fileTriggers = screen.getAllByRole("button", { name: "File" });
    expect(fileTriggers).toHaveLength(2);
    await user.click(fileTriggers[0]);
    let menu = await screen.findByRole("menu", { name: "File menu" });
    expect(within(menu).queryByRole("menuitem", { name: /Close Window/ })).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: /Hide File/ }));
    expect(screen.getByTestId("file-menu-collision-state").textContent).toBe("none|minimized");

    await user.click(screen.getByRole("button", { name: "Reactivate File app" }));
    expect(screen.getByTestId("file-menu-collision-state").textContent).toBe("file-window|open");
    fileTriggers = screen.getAllByRole("button", { name: "File" });
    await user.click(fileTriggers[1]);
    menu = await screen.findByRole("menu", { name: "File menu" });
    expect(within(menu).queryByRole("menuitem", { name: /Hide File/ })).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: /Close Window/ }));
    expect(screen.getByTestId("file-menu-collision-state").textContent).toBe("none|closed");
  });

  test("MacMenu honors link, detail, checked state, and popover class contracts", async () => {
    const user = userEvent.setup();
    render(
      <MacMenu
        items={[
          { kind: "section", id: "recent", label: "Recent" },
          { kind: "action", id: "docs", label: "Documentation", detail: "Open guide", href: "/guide", target: "_blank", checked: true },
        ]}
        label="Actions"
        popover={{ className: "custom-menu" }}
        trigger="Open"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const menu = await screen.findByRole("menu", { name: "Actions" });
    expect(menu.classList.contains("custom-menu")).toBe(true);
    expect(within(menu).getByText("Open guide")).toBeDefined();
    const item = within(menu).getByRole("menuitemradio", { name: /Documentation/ });
    expect(item.getAttribute("href")).toBe("/guide");
    expect(item.getAttribute("target")).toBe("_blank");
    expect(item.getAttribute("aria-checked")).toBe("true");
  });

  test("MacPopover uses anchored placement, configured offset, and outside dismissal", async () => {
    const user = userEvent.setup();
    render(
      <MacPopover className="positioned-popover" label="Help" layout="status" offset={19} placement="bottom start" trigger="Show help">
        Popover content
      </MacPopover>,
    );
    await user.click(screen.getByRole("button", { name: "Help" }));
    const dialog = await screen.findByRole("dialog", { name: "Help" });
    const surface = dialog.closest<HTMLElement>(".mc-popover-surface");
    expect(surface?.classList.contains("positioned-popover")).toBe(true);
    expect(surface?.dataset.popoverLayout).toBe("status");
    expect(surface?.dataset.placement).toBe("bottom");
    expect(surface?.style.top).toBe("19px");
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Help" })).toBeNull());
  });

  test("navigation split sizing is resizable and SourceList expansion is controlled", async () => {
    const onExpandedChange = vi.fn();
    const onItemSelection = vi.fn();
    const onSectionSelection = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <MacNavigationSplitView
          id="test-split"
          sidebar={<span>Sidebar body</span>}
          sidebarSizing={{ minSize: 180, defaultSize: 240, maxSize: 300 }}
          content={<span>Content body</span>}
          detail={<span>Detail body</span>}
        />
        <MacSourceList
          label="Projects"
          sections={[{ id: "favorites", title: "Favorites", selectable: true, collapsible: true, action: <button type="button">Add</button>, items: [{ id: "one", label: "One" }] }]}
          selectedId="one"
          selectedSectionId={null}
          onSelectionChange={onItemSelection}
          onSectionSelectionChange={onSectionSelection}
          expandedSectionIds={new Set(["favorites"])}
          onExpandedSectionIdsChange={onExpandedChange}
        />
      </>,
    );

    expect(screen.getByRole("separator", { name: "Resize Sidebar" })).toBeDefined();
    expect(screen.getByRole("separator", { name: "Resize Content" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();
    const section = screen.getByRole("row", { name: /Favorites/ });
    expect(section.getAttribute("aria-selected")).toBe("false");
    await user.click(screen.getByRole("button", { name: /Collapse Favorites/ }));
    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect([...onExpandedChange.mock.calls[0][0]]).toEqual([]);
    expect(onSectionSelection).not.toHaveBeenCalled();
    await user.click(section);
    expect(onSectionSelection).toHaveBeenCalledWith("favorites");
    expect(onItemSelection).not.toHaveBeenCalled();
    expect(screen.getByRole("row", { name: "One" })).toBeDefined();
  });

  test("split layout preserves unlike units and Inspector measures non-pixel CSS widths", () => {
    const html = renderToStaticMarkup(
      <MacNavigationSplitView
        id="mixed-units"
        sidebar={<span>Sidebar</span>}
        sidebarSizing={{ defaultSize: "50%" }}
        detail={<span>Detail</span>}
        detailSizing={{ defaultSize: "500px" }}
      />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector<HTMLElement>("#mixed-units-sidebar")?.style.flexBasis).toBe("50%");
    expect(container.querySelector<HTMLElement>("#mixed-units-detail")?.style.flexBasis).toBe("500px");

    let renderedWidth = 315;
    let notifyResize = () => {};
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) { notifyResize = () => callback([], this); }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      return this.classList.contains("mc-inspector") ? new DOMRect(0, 0, renderedWidth, 500) : new DOMRect();
    });
    render(<MacInspector label="Measured Inspector" width="50%">Controls</MacInspector>);
    const separator = screen.getByRole("separator", { name: "Resize Measured Inspector" });
    expect(separator.getAttribute("aria-valuenow")).toBe("315");
    renderedWidth = 340;
    act(() => notifyResize());
    expect(separator.getAttribute("aria-valuenow")).toBe("340");
  });

  test("Inspector reports CSS pixel widths, captures its pointer, and resizes from the rendered width", () => {
    const onWidthChange = vi.fn();
    render(<MacInspector width="300px" onWidthChange={onWidthChange}>Controls</MacInspector>);
    const separator = screen.getByRole("separator", { name: "Resize Inspector" });
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.assign(separator, { setPointerCapture, releasePointerCapture, hasPointerCapture: () => true });

    fireEvent.pointerDown(separator, { button: 0, clientX: 500, isPrimary: true, pointerId: 7 });
    fireEvent.pointerMove(separator, { clientX: 480, pointerId: 7 });
    fireEvent.pointerUp(separator, { pointerId: 7 });

    expect(separator.getAttribute("aria-valuenow")).toBe("300");
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onWidthChange).toHaveBeenCalledWith(320);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  test("Dock serializes each draggable MIME payload", () => {
    const setData = vi.fn();
    const dataTransfer = { effectAllowed: "none", setData };
    render(<MacDock items={[{ id: "doc", label: "Document", icon: "doc.png", draggablePayload: { "text/plain": "Document", "application/x-id": "doc" } }]} />);

    const item = screen.getByRole("button", { name: "Document" });
    expect(item.getAttribute("draggable")).toBe("true");
    fireEvent.dragStart(item, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", "Document");
    expect(setData).toHaveBeenCalledWith("application/x-id", "doc");
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  test("default Dock icons are bundled symbol tiles rather than missing asset URLs", () => {
    expect(defaultDockItems.every((item) => typeof item.icon === "object" && item.icon !== null && "kind" in item.icon && item.icon.kind === "symbol")).toBe(true);
    const { container } = render(<MacDock />);
    const dock = screen.getByRole("navigation", { name: "Dock" });
    const scroller = dock.querySelector<HTMLElement>(":scope > .p0-dock-scroll");
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelectorAll(":scope > .p0-dock-item-wrap")).toHaveLength(defaultDockItems.length);
    expect(dock.querySelectorAll(":scope > .p0-dock-item-wrap")).toHaveLength(0);
    expect(container.querySelectorAll(".p0-app-icon-glyph .mc-system-symbol")).toHaveLength(defaultDockItems.length);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  test("registration cleanup preserves manifest apps and duplicate managed windows", async () => {
    const app = { id: "manifest", name: "Manifest App", icon: <span>Icon</span> } as const;
    function RegistryProbe() {
      const manager = useMacWindowManager();
      return <output data-testid="registry">{`${manager.apps.map((candidate) => candidate.id).join(",")}|${manager.windows.map((window) => window.id).join(",")}`}</output>;
    }
    function Harness() {
      const [showApp, setShowApp] = useState(true);
      const [showFirstWindow, setShowFirstWindow] = useState(true);
      return (
        <MacWindowManager initialApps={[app]}>
          <button type="button" onClick={() => setShowApp(false)}>Remove conditional app</button>
          {showApp ? <MacApp {...app}><span /></MacApp> : null}
          <MacApp {...app}>
            <button type="button" onClick={() => setShowFirstWindow(false)}>Remove first duplicate window</button>
            {showFirstWindow ? <WindowChrome label="First duplicate" windowId="duplicate"><span /></WindowChrome> : null}
            <WindowChrome label="Second duplicate" windowId="duplicate"><span /></WindowChrome>
          </MacApp>
          <RegistryProbe />
        </MacWindowManager>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("registry").textContent).toBe("manifest|duplicate"));
    await user.click(screen.getByRole("button", { name: "Remove conditional app" }));
    expect(screen.getByTestId("registry").textContent).toBe("manifest|duplicate");
    await user.click(screen.getByRole("button", { name: "Remove first duplicate window" }));
    expect(screen.getByTestId("registry").textContent).toBe("manifest|duplicate");
  });

  test("mounted app metadata replaces a manifest icon", async () => {
    const manifest = { id: "manifest-icon", name: "Manifest", icon: <span>Manifest icon</span> } as const;
    render(
      <MacWindowManager initialApps={[manifest]}>
        <MacApp {...manifest} icon={<span>Mounted icon</span>}><MacAppDock /></MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByText("Mounted icon")).toBeDefined());
    expect(screen.queryByText("Manifest icon")).toBeNull();
  });

  test("unmanaged WindowChrome preserves a caller z-index", () => {
    render(<WindowChrome label="Floating utility" style={{ zIndex: 77 }}>Utility</WindowChrome>);
    expect(screen.getByRole("region", { name: "Floating utility" }).style.zIndex).toBe("77");
  });

  test("bringAllToFront preserves the app's current stacking order and key window", async () => {
    const app = { id: "stack", name: "Stack", icon: <span>Icon</span> } as const;
    function StackProbe() {
      const manager = useMacWindowManager();
      const ordered = manager.windows.slice().sort((left, right) => left.zIndex - right.zIndex).map((window) => window.id).join(",");
      return (
        <>
          <button type="button" onClick={() => manager.activateWindow("first")}>Activate first</button>
          <button type="button" onClick={() => manager.bringAllToFront("stack")}>Bring all forward</button>
          <output data-testid="key-window">{manager.keyWindowId}</output>
          <output data-testid="window-order">{ordered}</output>
        </>
      );
    }
    function StackHarness() {
      return (
        <MacWindowManager initialApps={[app]}>
          <MacApp {...app}>
            <WindowChrome label="First" windowId="first">First</WindowChrome>
            <WindowChrome label="Second" windowId="second">Second</WindowChrome>
            <WindowChrome label="Third" windowId="third">Third</WindowChrome>
            <StackProbe />
          </MacApp>
        </MacWindowManager>
      );
    }
    const user = userEvent.setup();
    render(<StackHarness />);
    await waitFor(() => expect(screen.getByTestId("window-order").textContent).toBe("first,second,third"));
    await user.click(screen.getByRole("button", { name: "Activate first" }));
    expect(screen.getByTestId("key-window").textContent).toBe("first");
    expect(screen.getByTestId("window-order").textContent).toBe("second,third,first");
    await user.click(screen.getByRole("button", { name: "Bring all forward" }));
    expect(screen.getByTestId("key-window").textContent).toBe("first");
    expect(screen.getByTestId("window-order").textContent).toBe("second,third,first");
  });

  test("changing a managed window label preserves state without re-registering", async () => {
    const app = { id: "labels", name: "Labels", icon: <span>Icon</span> } as const;
    function WindowProbe() {
      const manager = useMacWindowManager();
      const window = manager.windows.find((candidate) => candidate.id === "main");
      return (
        <>
          <button type="button" onClick={() => manager.minimizeWindow("main")}>Minimize from probe</button>
          <output data-testid="window-metadata">{window === undefined ? "missing" : `${window.label}|${window.state}`}</output>
        </>
      );
    }
    function LabelHarness() {
      const [label, setLabel] = useState("Original label");
      return (
        <MacWindowManager initialApps={[app]}>
          <button type="button" onClick={() => setLabel("Renamed label")}>Rename window</button>
          <MacApp {...app}>
            <WindowChrome label={label} windowId="main">Window content</WindowChrome>
            <WindowProbe />
          </MacApp>
        </MacWindowManager>
      );
    }
    const user = userEvent.setup();
    render(<LabelHarness />);
    await waitFor(() => expect(screen.getByTestId("window-metadata").textContent).toBe("Original label|open"));
    await user.click(screen.getByRole("button", { name: "Minimize from probe" }));
    expect(screen.getByTestId("window-metadata").textContent).toBe("Original label|minimized");
    await user.click(screen.getByRole("button", { name: "Rename window" }));
    expect(screen.getByTestId("window-metadata").textContent).toBe("Renamed label|minimized");
  });

  test("activating an app with all windows closed opens its first registered window", async () => {
    const app = { id: "primary", name: "Primary", icon: <span>Icon</span> } as const;
    function ActivationProbe() {
      const manager = useMacWindowManager();
      const states = manager.windows.map((window) => `${window.id}:${window.state}`).join(",");
      return (
        <>
          <button type="button" onClick={() => { manager.closeWindow("first"); manager.closeWindow("second"); }}>Close all</button>
          <button type="button" onClick={() => manager.activateApp("primary")}>Activate app</button>
          <output data-testid="activation-state">{`${manager.keyWindowId ?? "none"}|${states}`}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <MacWindowManager initialApps={[app]}>
        <MacApp {...app}>
          <WindowChrome label="First" windowId="first">First</WindowChrome>
          <WindowChrome label="Second" windowId="second">Second</WindowChrome>
          <ActivationProbe />
        </MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByTestId("activation-state").textContent).toBe("second|first:open,second:open"));
    await user.click(screen.getByRole("button", { name: "Close all" }));
    expect(screen.getByTestId("activation-state").textContent).toBe("none|first:closed,second:closed");
    await user.click(screen.getByRole("button", { name: "Activate app" }));
    expect(screen.getByTestId("activation-state").textContent).toBe("first|first:open,second:closed");
  });

  test("WindowChrome resize handles enforce minimum size and desktop canvas bounds", async () => {
    render(
      <div className="desktop-canvas">
        <WindowChrome
          label="Resizable"
          frame={{ left: 100, top: 100, width: 500, height: 400 }}
          minSize={{ width: 300, height: 200 }}
          style={{ border: 0, boxSizing: "border-box", padding: 0 }}
        >
          Content
        </WindowChrome>
      </div>,
    );
    const windowElement = screen.getByRole("region", { name: "Resizable" });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) return new DOMRect(0, 0, 1000, 800);
      if (this === windowElement) return new DOMRect(100, 100, 500, 400);
      return new DOMRect();
    });
    Object.assign(windowElement, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    const eastHandle = windowElement.querySelector<HTMLElement>('[data-window-resize-handle="e"]');
    expect(eastHandle).not.toBeNull();
    fireEvent.pointerDown(eastHandle!, { button: 0, clientX: 600, clientY: 300, isPrimary: true, pointerId: 4 });
    fireEvent.pointerMove(windowElement, { clientX: 0, clientY: 300, pointerId: 4 });
    await waitFor(() => expect(windowElement.style.width).toBe("300px"));
    fireEvent.pointerMove(windowElement, { clientX: 1_200, clientY: 300, pointerId: 4 });
    await waitFor(() => expect(windowElement.style.width).toBe("876px"));
    fireEvent.pointerUp(windowElement, { pointerId: 4 });
    expect(windowElement.releasePointerCapture).toHaveBeenCalledWith(4);
  });

  test("Finder sidebar callbacks, disclosure state, and preview visibility are recipe-owned", async () => {
    const onTitleSelect = vi.fn();
    const onItemSelect = vi.fn();
    const onPreviewVisibleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FinderWindow
        title="Files"
        sidebar={[{
          id: "favorites",
          title: "Favorites",
          collapsible: true,
          onTitleSelect,
          items: [{ id: "documents", label: "Documents", onSelect: onItemSelect }],
        }]}
        entries={[]}
        mode="icons"
        onModeChange={() => {}}
        search={{ value: "", onChange: () => {} }}
        selection={{ selectedId: null, onSelect: () => {} }}
        onOpen={() => {}}
        preview={() => <span>Preview pane</span>}
        onPreviewVisibleChange={onPreviewVisibleChange}
      />,
    );

    await user.click(screen.getByRole("row", { name: "Documents" }));
    expect(onItemSelect).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("row", { name: /Favorites/ }));
    expect(onTitleSelect).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /Collapse Favorites/ }));
    expect(screen.queryByRole("row", { name: "Documents" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hide Preview" }));
    expect(screen.queryByText("Preview pane")).toBeNull();
    expect(onPreviewVisibleChange).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Show Preview" }));
    expect(screen.getByText("Preview pane")).toBeDefined();
    expect(onPreviewVisibleChange).toHaveBeenLastCalledWith(true);
  });

  test("Finder content arrows update selection and move the roving focus by icon columns", async () => {
    const entries = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"].map((name) => ({
      id: name.toLowerCase(),
      name,
      kind: "file",
      icon: <span>{name.slice(0, 1)}</span>,
    }));
    function FinderKeyboardHarness() {
      const [selectedId, setSelectedId] = useState<string | null>("alpha");
      return (
        <FinderWindow
          title="Keyboard files"
          sidebar={[]}
          entries={entries}
          iconColumns={2}
          mode="icons"
          onModeChange={() => {}}
          search={{ value: "", onChange: () => {} }}
          selection={{ selectedId, onSelect: setSelectedId }}
          onOpen={() => {}}
        />
      );
    }
    const user = userEvent.setup();
    render(<FinderKeyboardHarness />);
    const alpha = screen.getByRole("option", { name: "Alpha" });
    alpha.focus();
    expect(alpha.tabIndex).toBe(0);
    await user.keyboard("{ArrowRight}");
    const beta = screen.getByRole("option", { name: "Beta" });
    await waitFor(() => expect(document.activeElement).toBe(beta));
    expect(beta.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowDown}");
    const delta = screen.getByRole("option", { name: "Delta" });
    await waitFor(() => expect(document.activeElement).toBe(delta));
    expect(delta.getAttribute("aria-selected")).toBe("true");
  });

  test("Chooser uses roving focus, horizontal navigation, and Enter activation", async () => {
    const choices = [
      { id: "one", symbol: "doc" as const, title: "One", caption: "First choice" },
      { id: "two", symbol: "folder" as const, title: "Two", caption: "Second choice" },
      { id: "three", symbol: "star" as const, title: "Three", caption: "Third choice" },
    ];
    const onActivate = vi.fn();
    function ChooserKeyboardHarness() {
      const [selected, setSelected] = useState<string | null>("one");
      return <ChooserWindow title="Choose" subtitle="Pick one" choices={choices} selected={selected} onSelect={setSelected} onActivate={onActivate} footer={null} />;
    }
    const user = userEvent.setup();
    render(<ChooserKeyboardHarness />);
    const options = screen.getAllByRole("option");
    expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1);
    const one = screen.getByRole("option", { name: /One/ });
    one.focus();
    await user.keyboard("{ArrowRight}");
    const two = screen.getByRole("option", { name: /Two/ });
    await waitFor(() => expect(document.activeElement).toBe(two));
    expect(two.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{End}");
    const three = screen.getByRole("option", { name: /Three/ });
    await waitFor(() => expect(document.activeElement).toBe(three));
    expect(three.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Home}");
    await waitFor(() => expect(document.activeElement).toBe(one));
    expect(one.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledWith("one");
  });

  test("Chooser secondary groups preserve captions, sections, symbols, and radio state through MacMenu", async () => {
    const onBlank = vi.fn();
    const user = userEvent.setup();
    render(
      <ChooserWindow
        title="Choose"
        subtitle="Pick one"
        choices={[]}
        selected={null}
        onSelect={() => {}}
        secondaryGroup={{
          label: "More Templates",
          caption: "Browse more",
          activeCaption: "Dark selected",
          sections: [
            { id: "sources", label: "Sources", commands: [{ id: "blank", symbol: "doc", title: "Blank", caption: "Start fresh", onSelect: onBlank }] },
            { id: "themes", label: "Themes", commands: [
              { id: "light", title: "Light", caption: "Bright canvas", checked: false, onSelect: () => {} },
              { id: "dark", title: "Dark", caption: "Dim canvas", checked: true, onSelect: () => {} },
            ] },
          ],
        }}
        footer={null}
      />,
    );
    expect(screen.getByText("Dark selected")).toBeDefined();
    expect(screen.queryByText("Browse more")).toBeNull();
    await user.click(screen.getByRole("button", { name: "More Templates" }));
    const menu = await screen.findByRole("menu", { name: "More Templates" });
    expect(within(menu).getByText("Sources")).toBeDefined();
    expect(within(menu).getByText("Themes")).toBeDefined();
    const blank = within(menu).getByRole("menuitem", { name: /Blank/ });
    expect(blank.querySelector('[data-system-symbol="doc"]')).not.toBeNull();
    expect(within(blank).getByText("Start fresh")).toBeDefined();
    expect(within(menu).getByRole("menuitemradio", { name: /Light/ }).getAttribute("aria-checked")).toBe("false");
    expect(within(menu).getByRole("menuitemradio", { name: /Dark/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(menu).getByText("Bright canvas")).toBeDefined();
    expect(within(menu).getByText("Dim canvas")).toBeDefined();
    await user.click(blank);
    expect(onBlank).toHaveBeenCalledOnce();
  });

  test("window recipes forward all lifecycle callbacks", async () => {
    const user = userEvent.setup();
    const callbacks = () => ({ onClose: vi.fn(), onMinimize: vi.fn(), onZoom: vi.fn() });
    const finderCallbacks = callbacks();
    const chooserCallbacks = callbacks();
    const setupCallbacks = callbacks();
    const chatCallbacks = callbacks();
    const recipes = [
      <FinderWindow key="finder" sidebar={[]} entries={[]} mode="icons" onModeChange={() => {}} search={{ value: "", onChange: () => {} }} selection={{ selectedId: null, onSelect: () => {} }} onOpen={() => {}} {...finderCallbacks} />,
      <ChooserWindow key="chooser" title="Choose" subtitle="Choose one" choices={[]} selected={null} onSelect={() => {}} footer={null} {...chooserCallbacks} />,
      <SetupAssistant key="setup" steps={[{ id: "start", name: "Start" }]} currentStep="start" furthestIndex={0} onSelectStep={() => {}} onBack={() => {}} onContinue={() => {}} {...setupCallbacks}>Setup</SetupAssistant>,
      <ChatWindow key="chat" conversations={[]} activeConversationId="" onSelectConversation={() => {}} composer={{ value: "", onChange: () => {}, onSend: () => {} }} {...chatCallbacks} />,
    ];

    const controls = [["Close window", "onClose"], ["Minimize window", "onMinimize"], ["Zoom window", "onZoom"]] as const;
    for (const [index, recipe] of recipes.entries()) {
      const recipeCallbacks = [finderCallbacks, chooserCallbacks, setupCallbacks, chatCallbacks][index];
      for (const [controlLabel, callback] of controls) {
        const view = render(recipe);
        await user.click(screen.getByRole("button", { name: controlLabel }));
        expect(recipeCallbacks?.[callback]).toHaveBeenCalledOnce();
        view.unmount();
      }
    }
  });

  test("stored id subscriptions observe cross-tab writes and localStorage.clear", () => {
    const ids = createStoredIdList("installed", (id) => id.startsWith("valid-"));
    function StoredIds() {
      return <output>{ids.useStoredIds().join(",")}</output>;
    }
    const view = render(<StoredIds />);

    act(() => {
      window.localStorage.setItem("installed", JSON.stringify(["valid-one", "invalid"]));
      window.dispatchEvent(new StorageEvent("storage", { key: "installed" }));
    });
    expect(screen.getByText("valid-one")).toBeDefined();
    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(view.container.querySelector("output")?.textContent).toBe("");
  });

  test("finder navigation only resets an invalid selection for arrow keys", () => {
    expect(finderKeyTarget("Enter", -1, 3, 6)).toBeNull();
    expect(finderKeyTarget("ArrowDown", -1, 3, 6)).toBe(0);
  });

  test("MacSheet honors initial focus, traps Tab, cancels on Escape, and restores focus", async () => {
    const cancel = vi.fn();
    function SheetHarness() {
      const [open, setOpen] = useState(false);
      const openerRef = useRef<HTMLButtonElement>(null);
      return (
        <WindowChrome label="Sheet owner">
          <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open sheet</button>
          <MacSheet
            actions={[{ id: "cancel", label: "Cancel", role: "cancel", onPress: cancel }, { id: "create", label: "Create", isDefault: true }]}
            fallbackFocusRef={openerRef}
            initialFocusSelector="#project-name"
            onClose={() => setOpen(false)}
            open={open}
            title="Create Project"
          >
            <input id="project-name" aria-label="Project name" />
          </MacSheet>
        </WindowChrome>
      );
    }

    const user = userEvent.setup();
    render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);
    const input = screen.getByRole("textbox", { name: "Project name" });
    await waitFor(() => expect(document.activeElement).toBe(input));

    screen.getByRole("button", { name: "Create" }).focus();
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(input);
    await user.keyboard("{Escape}");
    expect(cancel).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  test("window modals isolate their underlay, focus the dialog fallback, and restore stacked focus", async () => {
    function ModalStack({ lowerOpen, upperOpen }: { readonly lowerOpen: boolean; readonly upperOpen: boolean }) {
      return (
        <WindowChrome label="Modal owner">
          <button type="button">Underlay action</button>
          <MacSheet actions={[]} onClose={() => {}} open={lowerOpen} title="Lower sheet">
            <span>Lower body</span>
          </MacSheet>
          <MacSheet actions={[]} onClose={() => {}} open={upperOpen} title="Upper sheet">
            <span>Upper body</span>
          </MacSheet>
        </WindowChrome>
      );
    }

    const view = render(<ModalStack lowerOpen upperOpen />);
    const owner = screen.getByRole("region", { name: "Modal owner" });
    const underlay = screen.getByText("Underlay action").closest("button");
    const upper = await screen.findByRole("dialog", { name: "Upper sheet" });
    await waitFor(() => expect(document.activeElement).toBe(upper));
    expect(underlay?.hasAttribute("inert")).toBe(true);
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");
    const layers = owner.querySelectorAll<HTMLElement>(".mc-window-modal-layer");
    expect(layers).toHaveLength(2);
    expect(layers[0]?.hasAttribute("inert")).toBe(true);
    expect(layers[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(layers[1]?.hasAttribute("inert")).toBe(false);

    view.rerender(<ModalStack lowerOpen={false} upperOpen />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Upper sheet" })));
    view.rerender(<ModalStack lowerOpen={false} upperOpen={false} />);
    await waitFor(() => expect(owner.querySelectorAll(".mc-window-modal-layer")).toHaveLength(0));
    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
  });

  test("legacy Sheet focuses its dialog when it has no focusable controls", async () => {
    render(
      <WindowChrome label="Legacy owner">
        <Sheet label="Information" onClose={() => {}} open>Nothing actionable</Sheet>
      </WindowChrome>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Information" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(dialog.getAttribute("tabindex")).toBe("-1");
  });
});
