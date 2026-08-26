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
  DesktopShell,
  finderKeyTarget,
  FinderWindow,
  MacDock,
  MacInspector,
  MacMenu,
  MacNavigationSplitView,
  MacSheet,
  MacSourceList,
  SetupAssistant,
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

  test("stored id subscriptions observe cross-tab storage events", () => {
    const ids = createStoredIdList("installed", (id) => id.startsWith("valid-"));
    function StoredIds() {
      return <output>{ids.useStoredIds().join(",")}</output>;
    }
    render(<StoredIds />);

    act(() => {
      window.localStorage.setItem("installed", JSON.stringify(["valid-one", "invalid"]));
      window.dispatchEvent(new StorageEvent("storage", { key: "installed" }));
    });
    expect(screen.getByText("valid-one")).toBeDefined();
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
});
