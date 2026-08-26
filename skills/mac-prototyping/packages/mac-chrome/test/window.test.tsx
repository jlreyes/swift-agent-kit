// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacApp, MacAppDock, MacWindowManager } from "../app.tsx";
import { TrafficLights, WindowChrome } from "../window";
import { FinderWindow } from "../finder";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderFinder() {
  return render(
    <FinderWindow
      title="Vault"
      sidebar={[{ id: "s", title: "Favorites", collapsible: true, items: [{ id: "a", label: "All", onSelect: () => undefined }] }]}
      entries={[]}
      mode="icons"
      onModeChange={() => undefined}
      search={{ value: "", onChange: () => undefined }}
      selection={{ selectedId: null, onSelect: () => undefined }}
      onOpen={() => undefined}
      iconColumns={3}
    />,
  );
}

/* jsdom has no PointerEvent; hand-build a pointer-ish MouseEvent that carries
   the fields useWindowDrag reads (React copies them onto the synthetic event). */
function firePointer(target: Element, type: string, init: { clientX: number; clientY: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, "pointerId", { value: 7 });
  Object.defineProperty(event, "isPrimary", { value: true });
  act(() => {
    target.dispatchEvent(event);
  });
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

async function flushNextTask() {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  });
}

type TestLayout = {
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
  windowLeft: number;
  windowTop: number;
  windowWidth: number;
  windowHeight: number;
};

function mockLayout(layout: TestLayout) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("desktop-canvas")) {
      return new DOMRect(layout.canvasLeft, layout.canvasTop, layout.canvasWidth, layout.canvasHeight);
    }
    if (this.classList.contains("mac-window")) {
      return new DOMRect(
        layout.canvasLeft + layout.windowLeft,
        layout.canvasTop + layout.windowTop,
        layout.windowWidth,
        layout.windowHeight,
      );
    }
    return new DOMRect();
  });
}

const standardLayout: TestLayout = {
  canvasLeft: 40,
  canvasTop: 20,
  canvasWidth: 800,
  canvasHeight: 600,
  windowLeft: 100,
  windowTop: 80,
  windowWidth: 500,
  windowHeight: 400,
};

function renderCanvasWindow({
  minSize,
  resizable,
  withControls = false,
}: {
  readonly minSize?: { readonly width: number; readonly height: number };
  readonly resizable?: boolean;
  readonly withControls?: boolean;
} = {}) {
  return render(
    <div className="desktop-canvas">
      <WindowChrome
        frame={{ top: 80, left: 100, width: 500, height: 400 }}
        label="Geometry window"
        minSize={minSize}
        resizable={resizable}
      >
        <div data-window-drag-handle="">Title</div>
        {withControls ? <TrafficLights /> : null}
      </WindowChrome>
    </div>,
  );
}

async function resizeFrom(
  windowElement: HTMLElement,
  edge: string,
  deltaX: number,
  deltaY: number,
) {
  const handle = windowElement.querySelector<HTMLElement>(`[data-window-resize-handle='${edge}']`);
  expect(handle).toBeTruthy();
  if (handle === null) return;
  firePointer(handle, "pointerdown", { clientX: 200, clientY: 200 });
  firePointer(windowElement, "pointermove", { clientX: 200 + deltaX, clientY: 200 + deltaY });
  await flushAnimationFrame();
  firePointer(windowElement, "pointerup", { clientX: 200 + deltaX, clientY: 200 + deltaY });
}

describe("WindowChrome geometry", () => {
  it("applies the generic default frame, centered", () => {
    const { container } = render(
      <WindowChrome label="Plain">
        <p>Body</p>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    expect(windowElement?.style.height).toBe("480px");
    // Centered placement (jsdom normalizes the calc arithmetic, so match parts).
    expect(windowElement?.style.left).toMatch(/^calc\(50% - .*720px.*\)$/);
  });

  it("gives FinderWindow its ~940x580 default geometry", () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("940px");
    expect(windowElement?.style.height).toBe("580px");
  });

  it("honors a partial frame override over the defaults", () => {
    const { container } = render(
      <WindowChrome label="Framed" frame={{ top: 60, left: 40, width: 500 }}>
        <p>Body</p>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.top).toBe("60px");
    expect(windowElement?.style.left).toBe("40px");
    expect(windowElement?.style.width).toBe("500px");
    expect(windowElement?.style.height).toBe("480px");
  });

  it("renders all eight edge and corner resize handles by default", () => {
    const { container } = render(<WindowChrome label="Resizable"><p>Body</p></WindowChrome>);
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.dataset.windowResizable).toBe("true");
    expect([...container.querySelectorAll<HTMLElement>("[data-window-resize-handle]")]
      .map((handle) => handle.dataset.windowResizeHandle)).toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
  });

  it("renders no resize affordance when resizable is false", () => {
    const { container } = render(<WindowChrome label="Fixed" resizable={false}><p>Body</p></WindowChrome>);
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.dataset.windowResizable).toBe("false");
    expect(container.querySelectorAll("[data-window-resize-handle]")).toHaveLength(0);
  });

  it("resizes from every edge and corner", async () => {
    const cases = [
      { edge: "n", deltaX: 0, deltaY: -30, expected: [100, 50, 500, 430] },
      { edge: "ne", deltaX: 30, deltaY: -30, expected: [100, 50, 530, 430] },
      { edge: "e", deltaX: 30, deltaY: 0, expected: [100, 80, 530, 400] },
      { edge: "se", deltaX: 30, deltaY: 20, expected: [100, 80, 530, 420] },
      { edge: "s", deltaX: 0, deltaY: 20, expected: [100, 80, 500, 420] },
      { edge: "sw", deltaX: -30, deltaY: 20, expected: [70, 80, 530, 420] },
      { edge: "w", deltaX: -30, deltaY: 0, expected: [70, 80, 530, 400] },
      { edge: "nw", deltaX: -30, deltaY: -30, expected: [70, 50, 530, 430] },
    ] as const;

    for (const resizeCase of cases) {
      mockLayout({ ...standardLayout });
      const { container, unmount } = renderCanvasWindow();
      const windowElement = container.querySelector<HTMLElement>(".mac-window");
      expect(windowElement).toBeTruthy();
      if (windowElement === null) continue;
      await resizeFrom(windowElement, resizeCase.edge, resizeCase.deltaX, resizeCase.deltaY);
      expect([
        Number.parseFloat(windowElement.style.left),
        Number.parseFloat(windowElement.style.top),
        Number.parseFloat(windowElement.style.width),
        Number.parseFloat(windowElement.style.height),
      ]).toEqual(resizeCase.expected);
      unmount();
      vi.restoreAllMocks();
    }
  });

  it("enforces the declared minimum and all canvas bounds", async () => {
    mockLayout({ ...standardLayout });
    const { container } = renderCanvasWindow({ minSize: { width: 460, height: 320 } });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement).toBeTruthy();
    if (windowElement === null) return;

    await resizeFrom(windowElement, "nw", 1_000, 1_000);
    expect(windowElement.style.left).toBe("140px");
    expect(windowElement.style.top).toBe("160px");
    expect(windowElement.style.width).toBe("460px");
    expect(windowElement.style.height).toBe("320px");
  });

  it("recontains after shrink/reset notifications in a later task, never the observer cycle", async () => {
    const layout = { ...standardLayout };
    let notifyResize: () => void = () => undefined;
    let observedElement: Element | null = null;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(target: Element): void { observedElement = target; }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    mockLayout(layout);
    const { container } = renderCanvasWindow();
    const canvas = container.querySelector(".desktop-canvas");
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(observedElement).toBe(canvas);
    expect(windowElement?.style.width).toBe("500px");
    const animationFrameSpy = vi.spyOn(window, "requestAnimationFrame");

    layout.canvasWidth = 450;
    act(() => notifyResize());
    expect(windowElement?.style.width).toBe("500px");
    expect(animationFrameSpy).not.toHaveBeenCalled();
    await flushNextTask();
    expect(windowElement?.style.left).toBe("24px");
    expect(windowElement?.style.width).toBe("402px");

    layout.canvasWidth = 800;
    act(() => notifyResize());
    expect(windowElement?.style.left).toBe("24px");
    expect(windowElement?.style.width).toBe("402px");
    expect(animationFrameSpy).not.toHaveBeenCalled();
    await flushNextTask();
    expect(windowElement?.style.left).toBe("24px");
    expect(windowElement?.style.width).toBe("420px");
  });

  it("attaches containment after a default-closed managed window opens from the Dock", async () => {
    const layout = { ...standardLayout };
    let notifyResize: () => void = () => undefined;
    let observedElement: Element | null = null;
    let observeCount = 0;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(target: Element): void {
        observedElement = target;
        observeCount += 1;
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    mockLayout(layout);

    const { container, getByRole, queryByLabelText } = render(
      <MacWindowManager>
        <div className="desktop-canvas">
          <MacApp id="late" name="Late app" defaultRunning={false} icon="/late.png">
            <WindowChrome
              defaultOpen={false}
              frame={{ top: 80, left: 100, width: 500, height: 400 }}
              label="Late window"
            >
              <div data-window-drag-handle="">Late</div>
              <TrafficLights />
            </WindowChrome>
          </MacApp>
          <MacAppDock label="Test Dock" />
        </div>
      </MacWindowManager>,
    );

    expect(queryByLabelText("Late window")).toBeNull();
    const dockButton = await waitFor(() => getByRole("button", { name: "Late app" }));
    fireEvent.click(dockButton);
    const windowElement = await waitFor(() => getByRole("region", { name: "Late window" }));
    const canvas = container.querySelector(".desktop-canvas");
    expect(observedElement).toBe(canvas);
    expect(windowElement.style.width).toBe("500px");

    layout.canvasWidth = 450;
    act(() => notifyResize());
    expect(windowElement.style.width).toBe("500px");
    await flushNextTask();
    expect(windowElement.style.left).toBe("24px");
    expect(windowElement.style.width).toBe("402px");

    fireEvent.click(getByRole("button", { name: "Close window" }));
    expect(queryByLabelText("Late window")).toBeNull();
    fireEvent.click(dockButton);
    const reopenedWindow = await waitFor(() => getByRole("region", { name: "Late window" }));
    expect(observeCount).toBe(2);
    expect(reopenedWindow.style.left).toBe("24px");
    expect(reopenedWindow.style.width).toBe("402px");
  });

  it("restores the resized frame after zooming", async () => {
    mockLayout({ ...standardLayout });
    const { container, getByRole } = renderCanvasWindow({ withControls: true });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement).toBeTruthy();
    if (windowElement === null) return;

    await resizeFrom(windowElement, "e", 30, 0);
    expect(windowElement.style.width).toBe("530px");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement.style.width).toBe("calc(100% - 48px)");
    expect(windowElement.querySelectorAll("[data-window-resize-handle]")).toHaveLength(0);
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement.style.left).toBe("100px");
    expect(windowElement.style.width).toBe("530px");
  });
});

describe("traffic lights", () => {
  it("renders three functional buttons with reveal glyphs inside WindowChrome", () => {
    const { container, getByRole } = render(
      <WindowChrome label="Controls">
        <TrafficLights />
      </WindowChrome>,
    );
    const cluster = container.querySelector(".traffic-lights");
    expect(cluster?.querySelectorAll("button")).toHaveLength(3);
    // Every control carries its glyph; CSS reveals all three on cluster hover.
    expect(cluster?.querySelectorAll("button > svg")).toHaveLength(3);
    expect(getByRole("button", { name: "Close window" })).toBeTruthy();
    expect(getByRole("button", { name: "Minimize window" })).toBeTruthy();
    expect(getByRole("button", { name: "Zoom window" })).toBeTruthy();
  });

  it("renders inert solid-gray dots when disabled", () => {
    const { container } = render(<TrafficLights disabled />);
    const cluster = container.querySelector(".traffic-lights");
    expect(cluster?.classList.contains("mc-disabled")).toBe(true);
    expect(cluster?.querySelectorAll("button")).toHaveLength(0);
    expect(cluster?.querySelectorAll("svg")).toHaveLength(0);
  });

  it("close hides the window and still calls onClose", () => {
    const onClose = vi.fn();
    const { container, getByRole } = render(
      <WindowChrome label="Closable" onClose={onClose}>
        <TrafficLights />
      </WindowChrome>,
    );
    fireEvent.click(getByRole("button", { name: "Close window" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".mac-window")).toBeNull();
  });

  it("minimize transitions out, then hides the window", () => {
    vi.useFakeTimers();
    try {
      const onMinimize = vi.fn();
      const { container, getByRole } = render(
        <WindowChrome label="Minimizable" onMinimize={onMinimize}>
          <TrafficLights />
        </WindowChrome>,
      );
      fireEvent.click(getByRole("button", { name: "Minimize window" }));
      expect(onMinimize).toHaveBeenCalledTimes(1);
      const windowElement = container.querySelector<HTMLElement>(".mac-window");
      expect(windowElement?.classList.contains("mc-minimizing")).toBe(true);
      expect(windowElement?.style.opacity).toBe("0");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(container.querySelector(".mac-window")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("zoom toggles between the frame size and the larger canvas size", () => {
    const onZoom = vi.fn();
    const { container, getByRole } = render(
      <WindowChrome label="Zoomable" onZoom={onZoom}>
        <TrafficLights />
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(windowElement?.classList.contains("mc-zoomed")).toBe(true);
    expect(windowElement?.style.width).toBe("calc(100% - 48px)");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement?.classList.contains("mc-zoomed")).toBe(false);
    expect(windowElement?.style.width).toBe("720px");
  });

  it("an explicit onClose prop overrides the internal default (window stays)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <WindowChrome label="Externally closed">
        <TrafficLights onClose={onClose} />
      </WindowChrome>,
    );
    const closeButton = container.querySelector<HTMLButtonElement>("button[aria-label='Close window']");
    expect(closeButton).toBeTruthy();
    if (closeButton) fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".mac-window")).toBeTruthy();
  });
});

describe("window dragging", () => {
  it("FinderWindow exposes its toolbar and titlebar row as drag handles", () => {
    const { container } = renderFinder();
    expect(container.querySelector(".mc-toolbar[data-window-drag-handle]")).toBeTruthy();
    expect(container.querySelector(".mc-finder-sidebar-top[data-window-drag-handle]")).toBeTruthy();
  });

  it("dragging the toolbar moves the window by default", async () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>(".mc-toolbar[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (!windowElement || !handle) return;

    const originalLeft = windowElement.style.left;
    firePointer(handle, "pointerdown", { clientX: 300, clientY: 40 });
    firePointer(windowElement, "pointermove", { clientX: 380, clientY: 90 });
    await flushAnimationFrame();
    expect(windowElement.style.left).not.toBe(originalLeft);
    expect(windowElement.style.transform).toBe("");
    firePointer(windowElement, "pointerup", { clientX: 380, clientY: 90 });
  });

  it("a pointerdown on an interactive toolbar control never starts a drag", async () => {
    const { container } = renderFinder();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const control = container.querySelector<HTMLElement>(".mc-toolbar button");
    expect(windowElement).toBeTruthy();
    expect(control).toBeTruthy();
    if (!windowElement || !control) return;

    firePointer(control, "pointerdown", { clientX: 300, clientY: 40 });
    firePointer(windowElement, "pointermove", { clientX: 380, clientY: 90 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toMatch(/^calc\(50% -/);
  });

  it("clamps dragging to the desktop canvas rather than the global viewport", async () => {
    mockLayout({ ...standardLayout });
    const { container } = renderCanvasWindow();
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 5_000, clientY: 5_000 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe("276px");
    expect(windowElement.style.top).toBe("112px");
    firePointer(windowElement, "pointerup", { clientX: 5_000, clientY: 5_000 });

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: -5_000, clientY: -5_000 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe("24px");
    expect(windowElement.style.top).toBe("28px");
  });

  it("raises a background managed window before resizing it", async () => {
    const { container } = render(
      <MacWindowManager>
        <div className="desktop-canvas">
          <MacApp id="first" name="First" icon="/first.png">
            <WindowChrome label="First window"><div data-window-drag-handle="">First</div></WindowChrome>
          </MacApp>
          <MacApp id="second" name="Second" icon="/second.png">
            <WindowChrome label="Second window"><div data-window-drag-handle="">Second</div></WindowChrome>
          </MacApp>
        </div>
      </MacWindowManager>,
    );

    await waitFor(() => expect(container.querySelector<HTMLElement>("[aria-label='Second window']")?.dataset.keyWindow).toBe("true"));
    const firstWindow = container.querySelector<HTMLElement>("[aria-label='First window']");
    const firstResizeHandle = firstWindow?.querySelector<HTMLElement>("[data-window-resize-handle='se']");
    expect(firstWindow?.dataset.keyWindow).toBe("false");
    expect(firstResizeHandle).toBeTruthy();
    if (firstResizeHandle === null || firstResizeHandle === undefined) return;
    firePointer(firstResizeHandle, "pointerdown", { clientX: 200, clientY: 200 });
    await waitFor(() => expect(firstWindow?.dataset.keyWindow).toBe("true"));
  });
});
