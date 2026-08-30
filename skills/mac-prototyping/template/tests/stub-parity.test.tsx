// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, useState } from "react";
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
  MacAlert,
  MacApp,
  MacAppDock,
  MacDock,
  MacDisclosureGroup,
  MacInspector,
  MacList,
  MacMenu,
  MacNavigationSplitView,
  MacPopover,
  MacSegmentedControl,
  MacSheet,
  MacSourceList,
  Sheet,
  SetupAssistant,
  useModalFocusTrap,
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

  test.each([
    ["plain URL", "/mac-assets/wallpapers/tahoe.jpg", 'url("/mac-assets/wallpapers/tahoe.jpg")'],
    ["CSS URL", 'url("/wallpapers/custom.jpg")', 'url("/wallpapers/custom.jpg")'],
    ["gradient", "linear-gradient(135deg, #2579b7, #83c3df)", "linear-gradient(135deg, #2579b7, #83c3df)"],
    ["repeating linear gradient", "repeating-linear-gradient(90deg, #fff 0 10px, #000 10px 20px)", "repeating-linear-gradient(90deg, #fff 0 10px, #000 10px 20px)"],
    ["repeating radial gradient", "repeating-radial-gradient(circle, #fff 0 10px, #000 10px 20px)", "repeating-radial-gradient(circle, #fff 0 10px, #000 10px 20px)"],
    ["case-insensitive repeating conic gradient", "  RePeAtInG-CoNiC-GrAdIeNt(#fff 0 10deg, #000 10deg 20deg)", "RePeAtInG-CoNiC-GrAdIeNt(#fff 0 10deg, #000 10deg 20deg)"],
    ["image function", 'image(url("fallback.jpg"), #3a75b6)', 'image(url("fallback.jpg"), #3a75b6)'],
    ["image set", 'image-set(url("one.png") 1x, url("two.png") 2x)', 'image-set(url("one.png") 1x, url("two.png") 2x)'],
    ["cross fade", 'cross-fade(url("one.png"), url("two.png"), 50%)', 'cross-fade(url("one.png"), url("two.png"), 50%)'],
    ["element image", "element(#prototype-wallpaper)", "element(#prototype-wallpaper)"],
    ["paint image", "paint(prototype-wallpaper)", "paint(prototype-wallpaper)"],
    ["CSS variable", "var(--prototype-wallpaper)", "var(--prototype-wallpaper)"],
    ["escaped asset path", 'C:\\Wallpapers\\"Tahoe".jpg', 'url("C:\\\\Wallpapers\\\\\\"Tahoe\\".jpg")'],
  ])("DesktopShell classifies a %s wallpaper source", (_case, wallpaper, expected) => {
    const { container } = render(<DesktopShell appName="Prototype" wallpaper={wallpaper}><div /></DesktopShell>);
    const canvas = container.querySelector<HTMLElement>(".desktop-canvas");
    expect(canvas?.style.getPropertyValue("--mc-wallpaper")).toBe(expected);
  });

  test.each([
    ["balanced nested functions", 'image(linear-gradient(#123, #456), url("wall)paper.png"))', 'image(linear-gradient(#123, #456), url("wall)paper.png"))'],
    ["comments containing delimiters", 'image(/* unmatched ) is inert */ url("wallpaper.png"), #345)', 'image(/* unmatched ) is inert */ url("wallpaper.png"), #345)'],
    ["function-like image filename", "image(foo).png", 'url("image(foo).png")'],
    ["function-like paint filename", "paint(foo).jpg", 'url("paint(foo).jpg")'],
    ["trailing layout token", "linear-gradient(#123, #456) center", 'url("linear-gradient(#123, #456) center")'],
    ["unterminated function", "var(--wallpaper", 'url("var(--wallpaper")'],
  ])("DesktopShell validates the complete %s wallpaper source", (_case, wallpaper, expected) => {
    const { container } = render(<DesktopShell appName="Prototype" wallpaper={wallpaper}><div /></DesktopShell>);
    expect(container.querySelector<HTMLElement>(".desktop-canvas")?.style.getPropertyValue("--mc-wallpaper")).toBe(expected);
  });

  test("MacList exposes one tab stop and supports arrow and text-value navigation", async () => {
    function ListHarness() {
      const [selectedId, setSelectedId] = useState<string | null>("alpha");
      return (
        <>
          <button type="button">Before list</button>
          <MacList
            ariaLabel="Documents"
            selectedId={selectedId}
            onSelectionChange={setSelectedId}
            sections={[{
              id: "documents",
              items: [
                { id: "alpha", label: "Alpha" },
                { id: "disabled", label: "Disabled", disabled: true },
                { id: "bravo", label: <span>Visual second row</span>, textValue: "Bravo" },
                { id: "charlie", label: "Charlie" },
              ],
            }]}
          />
          <button type="button">After list</button>
          <output data-testid="list-selection">{selectedId ?? "none"}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(<ListHarness />);
    const listbox = screen.getByRole("listbox", { name: "Documents" });
    const options = within(listbox).getAllByRole("option");
    expect([listbox, ...options].filter((element) => element.tabIndex === 0)).toHaveLength(1);

    screen.getByRole("button", { name: "Before list" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(options[0]);
    await user.keyboard("b");
    expect(document.activeElement).toBe(options[2]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[3]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[2]);
    await user.keyboard(" ");
    expect(screen.getByTestId("list-selection").textContent).toBe("bravo");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After list" }));
  });

  test("collection titles normalize once and expose explicit, derived, and compatibility names", () => {
    let generatorReads = 0;
    function* generatedTitle() {
      generatorReads += 1;
      yield <span key="generated">Generated title</span>;
    }
    const generator = generatedTitle();
    const opaqueRenders = vi.fn();
    function OpaqueTitle() {
      opaqueRenders();
      return <span>Opaque visual title</span>;
    }
    const sections = [
      { id: "plain", items: [{ id: "plain-item", label: "Plain item" }] },
      { id: "false", title: false, items: [{ id: "false-item", label: "False item" }] },
      { id: "fragment", title: <><span> </span><></></>, items: [{ id: "fragment-item", label: "Fragment item" }] },
      { id: "array", title: [null, false, "  "], items: [{ id: "array-item", label: "Array item" }] },
      { id: "explicit", ariaLabel: "  Explicit section  ", title: null, items: [{ id: "explicit-item", label: "Explicit item" }] },
      { id: "nested", title: <span>Nested <strong>title</strong></span>, items: [{ id: "nested-item", label: "Nested item" }] },
      { id: "generated", title: generator, items: [{ id: "generated-item", label: "Generated item" }] },
      { id: "opaque", title: <OpaqueTitle />, items: [{ id: "opaque-item", label: "Opaque item" }] },
    ] as const;
    const props = {
      ariaLabel: "Title normalization",
      onSelectionChange: () => {},
      sections,
      selectedId: null,
    } as const;
    const view = render(<MacList {...props} />);

    for (const label of ["Plain item", "False item", "Fragment item", "Array item"]) {
      expect(screen.getByRole("option", { name: label }).closest("[role='group']")).toBeNull();
    }
    const explicit = screen.getByRole("group", { name: "Explicit section" });
    expect(explicit.querySelector(".mc-list-section-title")).toBeNull();
    expect(screen.getByRole("group", { name: "Nested title" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Generated title" })).toBeDefined();
    expect(screen.getByRole("group", { name: "opaque" })).toBeDefined();
    expect(generatorReads).toBe(1);
    expect(opaqueRenders).toHaveBeenCalledOnce();

    view.rerender(<MacList {...props} />);
    expect(screen.getByText("Generated title")).toBeDefined();
    expect(generatorReads).toBe(1);
    expect(opaqueRenders).toHaveBeenCalledOnce();
  });

  test("disclosure titles use explicit, normalized, and compatibility accessible names", () => {
    render(
      <>
        <MacDisclosureGroup ariaLabel="  Explicit disclosure  " expanded={false} title={<><span> </span></>} onExpandedChange={() => {}}>Explicit body</MacDisclosureGroup>
        <MacDisclosureGroup expanded={false} title={<span>Derived <strong>disclosure</strong></span>} onExpandedChange={() => {}}>Derived body</MacDisclosureGroup>
        <MacDisclosureGroup expanded={false} title={false} onExpandedChange={() => {}}>Fallback body</MacDisclosureGroup>
      </>,
    );
    expect(screen.getByRole("button", { name: "Explicit disclosure" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Derived disclosure" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Disclosure" })).toBeDefined();
  });

  test("MacSegmentedControl roves one tab stop and keyboard activation selects", async () => {
    function SegmentedHarness() {
      const [value, setValue] = useState("grid");
      return (
        <>
          <button type="button">Before segments</button>
          <MacSegmentedControl
            ariaLabel="View style"
            value={value}
            onChange={setValue}
            options={[
              { id: "grid", label: "Grid" },
              { id: "list", label: "List", disabled: true },
              { id: "columns", label: "Columns" },
            ]}
          />
          <button type="button">After segments</button>
          <output data-testid="segment-selection">{value}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(<SegmentedHarness />);
    const group = screen.getByRole("radiogroup", { name: "View style" });
    const radios = within(group).getAllByRole("radio");

    screen.getByRole("button", { name: "Before segments" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(radios[2]);
    expect(screen.getByTestId("segment-selection").textContent).toBe("grid");
    expect(radios[0]?.tabIndex).toBe(-1);
    expect(radios[2]?.tabIndex).toBe(0);
    await user.keyboard(" ");
    expect(screen.getByTestId("segment-selection").textContent).toBe("columns");
    expect(radios[2]?.getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard(" ");
    expect(screen.getByTestId("segment-selection").textContent).toBe("grid");
    expect([radios[0]?.tabIndex, radios[2]?.tabIndex]).toEqual([0, -1]);
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

  test("the active app survives its last key window being minimized or closed", async () => {
    const app = { id: "persistent", name: "Persistent", icon: <span>Persistent icon</span> } as const;
    function ActiveAppProbe() {
      const manager = useMacWindowManager();
      const managedApp = manager.apps.find((candidate) => candidate.id === app.id);
      const window = manager.windows.find((candidate) => candidate.id === "persistent-window");
      return (
        <output data-testid="persistent-app-state">
          {`${manager.keyAppId ?? "none"}|${manager.keyWindowId ?? "none"}|${window?.state ?? "missing"}|${managedApp?.running ? "running" : "stopped"}`}
        </output>
      );
    }
    const user = userEvent.setup();
    render(
      <MacWindowManager initialApps={[app]}>
        <MacApp {...app}>
          <DesktopShell appName="Persistent">
            <WindowChrome label="Persistent Window" windowId="persistent-window">Window content</WindowChrome>
            <ActiveAppProbe />
          </DesktopShell>
        </MacApp>
      </MacWindowManager>,
    );
    await waitFor(() => expect(screen.getByTestId("persistent-app-state").textContent).toBe("persistent|persistent-window|open|running"));

    await user.click(screen.getByRole("button", { name: "Window" }));
    await user.click(within(await screen.findByRole("menu", { name: "Window menu" })).getByRole("menuitem", { name: "Minimize" }));
    await waitFor(() => expect(screen.getByTestId("persistent-app-state").textContent).toBe("persistent|none|minimized|running"));

    await user.click(screen.getByRole("button", { name: "Window" }));
    const windowMenu = await screen.findByRole("menu", { name: "Window menu" });
    await user.click(within(windowMenu).getByRole("menuitemradio", { name: "Persistent Window" }));
    await waitFor(() => expect(screen.getByTestId("persistent-app-state").textContent).toBe("persistent|persistent-window|open|running"));

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(within(await screen.findByRole("menu", { name: "File menu" })).getByRole("menuitem", { name: /Close Window/ }));
    expect(screen.getByTestId("persistent-app-state").textContent).toBe("persistent|none|closed|running");

    await user.click(screen.getByRole("button", { name: "Persistent" }));
    await user.click(within(await screen.findByRole("menu", { name: "Persistent menu" })).getByRole("menuitem", { name: /Quit Persistent/ }));
    expect(screen.getByTestId("persistent-app-state").textContent).toBe("none|none|closed|stopped");
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
    expect(defaultDockItems.every((item) => typeof item.icon === "object" && item.icon !== null && "kind" in item.icon && item.icon.kind === "systemSymbol")).toBe(true);
    const { container } = render(<MacDock />);
    const dock = screen.getByRole("navigation", { name: "Dock" });
    const scroller = dock.querySelector<HTMLElement>(":scope > .p0-dock-scroll");
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelectorAll(":scope > .p0-dock-item-wrap")).toHaveLength(defaultDockItems.length);
    expect(dock.querySelectorAll(":scope > .p0-dock-item-wrap")).toHaveLength(0);
    expect(container.querySelectorAll(".p0-app-icon-glyph .mc-system-symbol")).toHaveLength(defaultDockItems.length);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  test("Dock contains landscape, portrait, and wide minimized windows in canonical thumbnail slots", () => {
    const { container } = render(
      <MacDock
        items={[
          { id: "landscape", label: "Landscape window", icon: "/app.png", windowThumbnail: { src: "/landscape.png", width: 900, height: 600 } },
          { id: "portrait", label: "Portrait window", icon: "/app.png", windowThumbnail: { src: "/portrait.png", width: 600, height: 900 } },
          { id: "wide", label: "Wide window", icon: "/app.png", windowThumbnail: { src: "/wide.png", width: 1600, height: 400 } },
        ]}
      />,
    );
    const slots = container.querySelectorAll<HTMLElement>(".p0-window-thumbnail-slot");
    const thumbnails = container.querySelectorAll<HTMLElement>(".p0-window-thumbnail");
    expect(slots).toHaveLength(3);
    expect(Number.parseFloat(thumbnails[0]?.style.width ?? "0")).toBeCloseTo(48);
    expect(Number.parseFloat(thumbnails[0]?.style.height ?? "0")).toBeCloseTo(32);
    expect(Number.parseFloat(thumbnails[1]?.style.width ?? "0")).toBeCloseTo(29.333, 3);
    expect(Number.parseFloat(thumbnails[1]?.style.height ?? "0")).toBeCloseTo(44);
    expect(Number.parseFloat(thumbnails[2]?.style.width ?? "0")).toBeCloseTo(48);
    expect(Number.parseFloat(thumbnails[2]?.style.height ?? "0")).toBeCloseTo(12);
  });

  test("Dock owns one clamped tooltip outside its scrolling item strip", async () => {
    const firstLabel = "A very long first application label";
    const lastLabel = "An equally long final application label";
    let lastItemLeft = 348;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("p0-mac-dock")) return DOMRect.fromRect({ x: 100, y: 600, width: 300, height: 67 });
      if (this.classList.contains("p0-dock-scroll")) return DOMRect.fromRect({ x: 100, y: 568, width: 300, height: 105 });
      if (this.classList.contains("p0-dock-tooltip")) return DOMRect.fromRect({ width: 240, height: 22 });
      if (this.getAttribute("aria-label") === firstLabel) return DOMRect.fromRect({ x: 100, y: 608, width: 52, height: 52 });
      if (this.getAttribute("aria-label") === lastLabel) return DOMRect.fromRect({ x: lastItemLeft, y: 608, width: 52, height: 52 });
      return DOMRect.fromRect();
    });
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(500);
    render(
      <MacDock
        items={[
          { id: "first", label: firstLabel, icon: "/first.png" },
          { id: "last", label: lastLabel, icon: "/last.png" },
        ]}
      />,
    );
    const dock = screen.getByRole("navigation", { name: "Dock" });
    const scroller = dock.querySelector<HTMLElement>(":scope > .p0-dock-scroll");
    const firstItem = screen.getByRole("button", { name: firstLabel });
    const lastItem = screen.getByRole("button", { name: lastLabel });

    fireEvent.pointerEnter(firstItem);
    let tooltip = await screen.findByRole("tooltip");
    expect(dock.querySelectorAll(":scope > .p0-dock-tooltip")).toHaveLength(1);
    expect(scroller?.querySelector(".p0-dock-tooltip")).toBeNull();
    expect(firstItem.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(tooltip.dataset.visible).toBe("true");
    expect(tooltip.style.left).toBe("28px");

    fireEvent.pointerLeave(firstItem);
    fireEvent.pointerEnter(lastItem);
    tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe(lastLabel);
    expect(lastItem.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(tooltip.dataset.visible).toBe("true");
    expect(tooltip.style.left).toBe("272px");

    lastItemLeft = 420;
    fireEvent.scroll(scroller as HTMLElement);
    expect(tooltip.dataset.visible).toBe("false");
  });

  test("Dock repositions a stable active tooltip and clears removed tooltip identity before ID reuse", async () => {
    const activeItem = { id: "active", label: "Active", icon: "/active.png" } as const;
    const firstItem = { id: "first", label: "First", icon: "/first.png" } as const;
    const lastItem = { id: "last", label: "Last", icon: "/last.png" } as const;
    let activeItemLeft = 160;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("p0-mac-dock")) return DOMRect.fromRect({ x: 100, y: 600, width: 300, height: 67 });
      if (this.classList.contains("p0-dock-scroll")) return DOMRect.fromRect({ x: 100, y: 568, width: 300, height: 105 });
      if (this.classList.contains("p0-dock-tooltip")) return DOMRect.fromRect({ width: 60, height: 22 });
      if (this.getAttribute("aria-label") === activeItem.label) return DOMRect.fromRect({ x: activeItemLeft, y: 608, width: 52, height: 52 });
      return DOMRect.fromRect();
    });
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(800);

    const view = render(<MacDock items={[activeItem, lastItem]} />);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByRole("tooltip").style.left).toBe("86px");

    activeItemLeft = 216;
    view.rerender(<MacDock items={[firstItem, activeItem, lastItem]} />);
    expect(screen.getByRole("tooltip").style.left).toBe("142px");

    activeItemLeft = 132;
    view.rerender(<MacDock items={[lastItem, activeItem, firstItem]} />);
    expect(screen.getByRole("tooltip").style.left).toBe("58px");

    view.rerender(<MacDock items={[lastItem, firstItem]} />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    view.rerender(<MacDock items={[activeItem, lastItem, firstItem]} />);
    expect(screen.getByRole("button", { name: "Active" }).hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByRole("tooltip").textContent).toBe("Active");
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

  test("duplicate registrations restore each surviving app and window owner's metadata", async () => {
    const manifest = { id: "owned", name: "Manifest", icon: "/manifest.png" } as const;
    function RegistryMetadata() {
      const manager = useMacWindowManager();
      const app = manager.apps.find((candidate) => candidate.id === manifest.id);
      const window = manager.windows.find((candidate) => candidate.id === "owned:main");
      return <><output data-testid="owned-metadata">{app === undefined ? "missing" : `${app.name}|${app.dockGroup}|${app.presentation}|${window?.label ?? "no-window"}`}</output><output data-testid="owned-icon">{typeof app?.icon === "string" ? app.icon : "complex icon"}</output></>;
    }
    function Harness() {
      const [showPrimary, setShowPrimary] = useState(true);
      const [showNewest, setShowNewest] = useState(true);
      return (
        <MacWindowManager initialApps={[manifest]}>
          <button type="button" onClick={() => setShowNewest(false)}>Remove newest owner</button>
          <button type="button" onClick={() => setShowPrimary(false)}>Remove primary owner</button>
          {showPrimary ? (
            <MacApp {...manifest} name="Primary" icon="/primary.png" presentation="menuBar">
              <WindowChrome label="Primary window" windowId="owned:main"><span /></WindowChrome>
            </MacApp>
          ) : null}
          {showNewest ? (
            <MacApp {...manifest} name="Newest" icon="/newest.png" dockGroup="places">
              <WindowChrome label="Newest window" windowId="owned:main"><span /></WindowChrome>
            </MacApp>
          ) : null}
          <RegistryMetadata />
          <MacAppDock label="Owned Dock" />
        </MacWindowManager>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("owned-metadata").textContent).toBe("Newest|places|windowed|Newest window"));
    expect(screen.getByTestId("owned-icon").textContent).toBe("/newest.png");

    await user.click(screen.getByRole("button", { name: "Remove newest owner" }));
    await waitFor(() => expect(screen.getByTestId("owned-metadata").textContent).toBe("Primary|apps|menuBar|Primary window"));
    expect(screen.getByTestId("owned-icon").textContent).toBe("/primary.png");

    await user.click(screen.getByRole("button", { name: "Remove primary owner" }));
    await waitFor(() => expect(screen.getByTestId("owned-metadata").textContent).toBe("Manifest|apps|windowed|no-window"));
    expect(screen.getByTestId("owned-icon").textContent).toBe("/manifest.png");
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

  test("SetupAssistant derives current and complete progress classes", () => {
    const steps = [
      { id: "intro", name: "Introduction" },
      { id: "account", name: "Account" },
      { id: "finish", name: "Finish" },
    ];
    const props = {
      steps,
      furthestIndex: 2,
      onSelectStep: () => {},
      onBack: () => {},
      onContinue: () => {},
    } as const;
    const view = render(<SetupAssistant {...props} currentStep="account">Account setup</SetupAssistant>);
    let stepButtons = within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole("button");
    expect(stepButtons.map((button) => button.className)).toEqual(["mc-complete", "mc-current", ""]);
    expect(stepButtons[1]?.getAttribute("aria-current")).toBe("step");

    view.rerender(<SetupAssistant {...props} currentStep="finish">Finished</SetupAssistant>);
    stepButtons = within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole("button");
    expect(stepButtons.map((button) => button.className)).toEqual(["mc-complete", "mc-complete", "mc-current"]);
    expect(stepButtons[2]?.getAttribute("aria-current")).toBe("step");
  });

  test("SetupAssistant preserves deprecated modalOpen underlay suppression", () => {
    const props = {
      steps: [{ id: "welcome", name: "Welcome" }],
      currentStep: "welcome",
      furthestIndex: 0,
      onSelectStep: () => {},
      onBack: () => {},
      onContinue: () => {},
    } as const;
    const view = render(<SetupAssistant {...props} modalOpen>Setup content</SetupAssistant>);
    const underlay = view.container.querySelector<HTMLElement>(".mc-setup-underlay");
    expect(underlay?.hasAttribute("inert")).toBe(true);
    expect(underlay?.getAttribute("aria-hidden")).toBe("true");

    view.rerender(<SetupAssistant {...props} modalOpen={false}>Setup content</SetupAssistant>);
    expect(underlay?.hasAttribute("inert")).toBe(false);
    expect(underlay?.hasAttribute("aria-hidden")).toBe(false);
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

  test("Finder keyboard open and Quick Look use the focused selection and show file metadata", async () => {
    const onOpen = vi.fn();
    const entries = [{
      id: "report",
      name: "Report",
      kind: "folder",
      icon: <span>Report icon</span>,
      modified: "Today, 2:30 PM",
      size: "42 KB",
    }] as const;
    function FinderHarness() {
      const [selectedId, setSelectedId] = useState<string | null>("report");
      return (
        <FinderWindow
          sidebar={[]}
          entries={entries}
          mode="icons"
          onModeChange={() => {}}
          search={{ value: "", onChange: () => {} }}
          selection={{ selectedId, onSelect: setSelectedId }}
          onOpen={onOpen}
        />
      );
    }
    render(<FinderHarness />);
    const option = screen.getByRole("option", { name: /Report/ });
    option.focus();

    expect(fireEvent.keyDown(option, { key: "ArrowDown", metaKey: true })).toBe(false);
    expect(onOpen).toHaveBeenCalledWith(entries[0]);
    expect(document.activeElement).toBe(screen.getByRole("listbox", { name: "Files" }));

    option.focus();
    expect(fireEvent.keyDown(option, { key: " " })).toBe(false);
    const quickLook = await screen.findByRole("dialog", { name: "Quick Look Report" });
    expect(within(quickLook).getByText("Today, 2:30 PM · 42 KB")).toBeDefined();
  });

  test("modal default Return leaves links and every native editable content boundary in control", async () => {
    const onDefault = vi.fn();
    function SerializedEditable({ value, testId }: { readonly value: string; readonly testId: string }) {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => ref.current?.setAttribute("contenteditable", value), [value]);
      return <div ref={ref}><span data-testid={testId}>Editable child</span></div>;
    }
    render(
      <WindowChrome label="Return owner">
        <MacSheet
          actions={[{ id: "default", label: "Continue", isDefault: true, onPress: onDefault }]}
          onClose={() => {}}
          open
          title="Return targets"
        >
          <a href="/help"><span data-testid="link-child">Help</span></a>
          <SerializedEditable value="" testId="empty-editable-child" />
          <SerializedEditable value="true" testId="true-editable-child" />
          <SerializedEditable value="plaintext-only" testId="plaintext-editable-child" />
          <SerializedEditable value="false" testId="false-editable-child" />
          <span data-testid="plain-return-target">Plain target</span>
        </MacSheet>
      </WindowChrome>,
    );
    await screen.findByRole("dialog", { name: "Return targets" });

    fireEvent.keyDown(screen.getByTestId("link-child"), { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("empty-editable-child"), { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("true-editable-child"), { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("plaintext-editable-child"), { key: "Enter" });
    expect(onDefault).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByTestId("false-editable-child"), { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("plain-return-target"), { key: "Enter" });
    expect(onDefault).toHaveBeenCalledTimes(2);
  });

  test("Chat Return sends, Shift-Return stays multiline, and delivery status is rendered", () => {
    const onSend = vi.fn();
    render(
      <ChatWindow
        conversations={[{
          id: "thread",
          title: "Prototype",
          messages: [
            { id: "owner", author: { name: "James", role: "owner" }, at: "2:30 PM", body: "Ship it", status: "Delivered" },
            { id: "agent", author: { name: "Agent", role: "agent" }, at: "2:31 PM", body: "Done", status: "Read" },
          ],
        }]}
        activeConversationId="thread"
        onSelectConversation={() => {}}
        composer={{ value: "Send this", onChange: () => {}, onSend, placeholder: "Message" }}
      />,
    );
    expect(screen.getByText("Delivered").className).toBe("mc-chat-status");
    expect(screen.getByText("Read").className).toBe("mc-chat-status");
    const composer = screen.getByRole("textbox", { name: "Message" });

    expect(fireEvent.keyDown(composer, { key: "Enter", shiftKey: true })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(composer, { key: "Enter" })).toBe(false);
    expect(onSend).toHaveBeenCalledOnce();
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

  test("the modal focus trap ignores hidden, disabled, inert, and negative-tabindex controls at its boundaries", async () => {
    function FocusTrapHarness() {
      const dialogRef = useRef<HTMLDivElement>(null);
      const handleKeyDown = useModalFocusTrap({ dialogRef, onCancel: () => {} });
      return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Focus boundary" tabIndex={-1} onKeyDown={handleKeyDown}>
          <button type="button" hidden>Hidden before</button>
          <button type="button" style={{ display: "none" }}>Display none before</button>
          <button type="button" style={{ visibility: "hidden" }}>Invisible before</button>
          <input type="hidden" aria-label="Hidden input before" />
          <button type="button" disabled>Disabled before</button>
          <button type="button" aria-disabled="true">ARIA disabled before</button>
          <button type="button" tabIndex={-2}>Negative two before</button>
          <button type="button" tabIndex={-1}>Negative one before</button>
          <div inert><button type="button">Inert before</button></div>
          <div aria-hidden="true"><button type="button">ARIA hidden before</button></div>
          <button type="button">First tabbable</button>
          <button type="button">Last tabbable</button>
          <div aria-hidden="true"><button type="button">ARIA hidden after</button></div>
          <div inert><button type="button">Inert after</button></div>
          <button type="button" tabIndex={-1}>Negative one after</button>
          <button type="button" tabIndex={-2}>Negative two after</button>
          <button type="button" disabled>Disabled after</button>
          <button type="button" style={{ display: "none" }}>Display none after</button>
          <button type="button" hidden>Hidden after</button>
        </div>
      );
    }

    const user = userEvent.setup();
    render(<FocusTrapHarness />);
    const first = screen.getByRole("button", { name: "First tabbable" });
    const last = screen.getByRole("button", { name: "Last tabbable" });
    await waitFor(() => expect(document.activeElement).toBe(first));

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  test("the modal focus trap falls back from an invalid requested target and recognizes the shared candidate set", async () => {
    function CandidateHarness() {
      const dialogRef = useRef<HTMLDivElement>(null);
      const handleKeyDown = useModalFocusTrap({
        dialogRef,
        initialFocusSelector: ".preferred-focus",
        onCancel: () => {},
      });
      return (
        <>
          <button type="button">Outside boundary</button>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Candidate boundary" tabIndex={-1} onKeyDown={handleKeyDown}>
            <button type="button" className="preferred-focus" hidden>Hidden preferred target</button>
            <div style={{ contentVisibility: "hidden" }}><button type="button">Content-hidden ancestor</button></div>
            <button type="button" style={{ visibility: "collapse" }}>Collapsed candidate</button>
            <a href="/modal-help">First link candidate</a>
            <details><summary>Summary candidate</summary></details>
            <div contentEditable="true" suppressContentEditableWarning tabIndex={0}>Last editable candidate</div>
            <div contentEditable="false">Noneditable region</div>
          </div>
        </>
      );
    }

    render(<CandidateHarness />);
    const dialog = screen.getByRole("dialog", { name: "Candidate boundary" });
    const first = screen.getByRole("link", { name: "First link candidate" });
    const last = screen.getByText("Last editable candidate");
    await waitFor(() => expect(document.activeElement).toBe(first));

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  test("nested modal Escape and Tab stay owned by the top portal layer", async () => {
    const closeLower = vi.fn();
    const closeUpper = vi.fn();
    render(
      <WindowChrome label="Nested modal owner">
        <Sheet label="Lower modal" onClose={closeLower} open>
          <button type="button">Lower first</button>
          <button type="button">Lower last</button>
          <Sheet label="Upper modal" onClose={closeUpper} open>
            <button type="button">Upper first</button>
            <button type="button">Upper last</button>
          </Sheet>
        </Sheet>
      </WindowChrome>,
    );
    const upper = await screen.findByRole("dialog", { name: "Upper modal" });
    const upperFirst = within(upper).getByRole("button", { name: "Upper first" });
    const upperLast = within(upper).getByRole("button", { name: "Upper last" });
    await waitFor(() => expect(document.activeElement).toBe(upperFirst));

    fireEvent.keyDown(upperFirst, { key: "Escape" });
    expect(closeUpper).toHaveBeenCalledOnce();
    expect(closeLower).not.toHaveBeenCalled();

    upperLast.focus();
    fireEvent.keyDown(upperLast, { key: "Tab" });
    expect(document.activeElement).toBe(upperFirst);
    upperFirst.focus();
    fireEvent.keyDown(upperFirst, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(upperLast);

    upperFirst.focus();
    fireEvent.keyDown(upperFirst, { key: "Tab" });
    expect(document.activeElement).toBe(upperFirst);
  });

  test("nested modal default Enter stays owned by the top portal layer", async () => {
    const lowerDefault = vi.fn();
    const upperDefault = vi.fn();
    render(
      <WindowChrome label="Nested default owner">
        <MacSheet
          actions={[{ id: "lower-default", label: "Lower Default", isDefault: true, onPress: lowerDefault }]}
          onClose={() => {}}
          open
          title="Lower default sheet"
        >
          <MacSheet
            actions={[{ id: "upper-default", label: "Upper Default", isDefault: true, onPress: upperDefault }]}
            onClose={() => {}}
            open
            title="Upper default sheet"
          >
            <span data-testid="upper-default-target">Upper default target</span>
          </MacSheet>
        </MacSheet>
      </WindowChrome>,
    );
    await screen.findByRole("dialog", { name: "Upper default sheet" });

    fireEvent.keyDown(screen.getByTestId("upper-default-target"), { key: "Enter" });
    expect(upperDefault).toHaveBeenCalledOnce();
    expect(lowerDefault).not.toHaveBeenCalled();
  });

  test("tall sheet content and alert messages keep actions in dedicated regions", async () => {
    const sheetView = render(
      <section className="mac-window" aria-label="Short sheet owner" style={{ height: 150 }}>
        <MacSheet
          actions={[{ id: "save", label: "Save", isDefault: true }]}
          onClose={() => {}}
          open
          title="Tall sheet"
        >
          <div data-testid="tall-sheet-content" style={{ height: 480 }}>Tall body content</div>
        </MacSheet>
      </section>,
    );
    const sheet = await screen.findByRole("dialog", { name: "Tall sheet" });
    const sheetBody = sheet.querySelector<HTMLElement>(".mc-sheet-body");
    const sheetFooter = sheet.querySelector<HTMLElement>(".mc-sheet-footer");
    expect(sheetBody?.contains(screen.getByTestId("tall-sheet-content"))).toBe(true);
    expect(sheetFooter?.contains(screen.getByRole("button", { name: "Save" }))).toBe(true);
    expect(sheetBody?.contains(sheetFooter)).toBe(false);
    sheetView.unmount();

    render(
      <section className="mac-window" aria-label="Short alert owner" style={{ height: 150 }}>
        <MacAlert
          actions={[{ id: "okay", label: "OK", isDefault: true }]}
          message={<div data-testid="tall-alert-content" style={{ height: 480 }}>Long alert message</div>}
          onClose={() => {}}
          open
          title="Tall alert"
        />
      </section>,
    );
    const alert = await screen.findByRole("alertdialog", { name: "Tall alert" });
    const alertMessage = alert.querySelector<HTMLElement>(".mc-alert-message");
    const alertFooter = alert.querySelector<HTMLElement>(".mc-alert-footer");
    expect(alertMessage?.contains(screen.getByTestId("tall-alert-content"))).toBe(true);
    expect(alertFooter?.contains(screen.getByRole("button", { name: "OK" }))).toBe(true);
    expect(alertMessage?.contains(alertFooter)).toBe(false);
  });

  test("closing the middle of three modal layers keeps focus in the top dialog", async () => {
    function ModalStack() {
      const [middleOpen, setMiddleOpen] = useState(false);
      const [topOpen, setTopOpen] = useState(false);
      return (
        <WindowChrome label="Three-layer modal owner">
          <Sheet label="Bottom dialog" onClose={() => {}} open>
            <button type="button" onClick={() => setMiddleOpen(true)}>Open middle</button>
          </Sheet>
          <Sheet label="Middle dialog" onClose={() => setMiddleOpen(false)} open={middleOpen}>
            <button type="button" onClick={() => setTopOpen(true)}>Open top</button>
          </Sheet>
          <Sheet label="Top dialog" onClose={() => setTopOpen(false)} open={topOpen}>
            <button type="button" onClick={() => setMiddleOpen(false)}>Remove middle</button>
            <button type="button" onClick={() => setTopOpen(false)}>Close top</button>
          </Sheet>
        </WindowChrome>
      );
    }

    const user = userEvent.setup();
    render(<ModalStack />);
    await screen.findByRole("dialog", { name: "Bottom dialog" });
    await user.click(screen.getByRole("button", { name: "Open middle" }));
    await screen.findByRole("dialog", { name: "Middle dialog" });
    await user.click(screen.getByRole("button", { name: "Open top" }));
    const top = await screen.findByRole("dialog", { name: "Top dialog" });

    await user.click(screen.getByRole("button", { name: "Remove middle" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Middle dialog" })).toBeNull());
    await waitFor(() => expect(top.contains(document.activeElement)).toBe(true));
    expect(document.querySelector(".mc-sheet[aria-label='Bottom dialog']")).not.toBeNull();
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

  test("window modals preserve application-owned suppression mutations", async () => {
    function MutationHarness({ open }: { readonly open: boolean }) {
      return (
        <WindowChrome label="Mutation owner">
          <button type="button">Mutable underlay</button>
          <MacSheet actions={[]} onClose={() => {}} open={open} title="Mutation sheet">
            <span>Sheet body</span>
          </MacSheet>
        </WindowChrome>
      );
    }
    const view = render(<MutationHarness open />);
    const underlay = screen.getByText("Mutable underlay").closest("button") as HTMLButtonElement;
    await screen.findByRole("dialog", { name: "Mutation sheet" });
    await waitFor(() => expect(underlay.getAttribute("aria-hidden")).toBe("true"));

    // Writing even the same suppression values transfers attribute ownership
    // back to the application; modal cleanup must not restore stale baselines.
    underlay.setAttribute("inert", "");
    underlay.setAttribute("aria-hidden", "true");
    view.rerender(<MutationHarness open={false} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(underlay.getAttribute("inert")).toBe("");
    expect(underlay.getAttribute("aria-hidden")).toBe("true");
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

  test("legacy Sheet remains usable without a window or DesktopShell owner", async () => {
    function StandaloneSheet() {
      const [open, setOpen] = useState(true);
      return (
        <div className="standalone-sheet-caller">
          <Sheet label="Legacy standalone sheet" onClose={() => setOpen(false)} open={open}>
            <p>Legacy freeform content</p>
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </Sheet>
        </div>
      );
    }

    const user = userEvent.setup();
    render(<StandaloneSheet />);
    const dialog = await screen.findByRole("dialog", { name: "Legacy standalone sheet" });
    const layer = dialog.closest<HTMLElement>(".mc-window-modal-layer");
    expect(layer?.dataset.modalScope).toBe("desktop");
    expect(layer?.parentElement).toBe(document.body);
    expect(screen.getByText("Legacy freeform content")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Legacy standalone sheet" })).toBeNull());
  });
});
