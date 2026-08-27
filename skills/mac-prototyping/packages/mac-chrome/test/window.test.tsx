// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { act, useState, type CSSProperties } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacApp, MacAppDock, MacWindowManager } from "../app.tsx";
import { TrafficLights, useWindowDrag, WindowChrome } from "../window";
import { FinderWindow } from "../finder";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,d2luZG93"),
}));

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

function mockPointerCapture(element: HTMLElement) {
  const capturedPointers = new Set<number>();
  element.setPointerCapture = vi.fn((pointerId: number) => capturedPointers.add(pointerId));
  element.hasPointerCapture = vi.fn((pointerId: number) => capturedPointers.has(pointerId));
  const releasePointerCapture = vi.fn((pointerId: number) => capturedPointers.delete(pointerId));
  element.releasePointerCapture = releasePointerCapture;
  return releasePointerCapture;
}

function mockAnimationFrameQueue() {
  const queuedFrames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;
  const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    queuedFrames.set(frameId, callback);
    return frameId;
  });
  const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  return { cancelAnimationFrame, queuedFrames, requestAnimationFrame };
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

function mockAuthoredLayout({ canvasLeft = 40, canvasTop = 20, canvasWidth = 900, canvasHeight = 700 } = {}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("desktop-canvas")) {
      return new DOMRect(canvasLeft, canvasTop, canvasWidth, canvasHeight);
    }
    if (this.classList.contains("mac-window")) {
      const left = Number.parseFloat(this.style.left) || 0;
      const top = Number.parseFloat(this.style.top) || 0;
      const width = Number.parseFloat(this.style.width) || 0;
      const height = Number.parseFloat(this.style.height) || 0;
      return new DOMRect(canvasLeft + left, canvasTop + top, width, height);
    }
    return new DOMRect();
  });
}

function mockBoxModelLayout({ canvasLeft = 40, canvasTop = 20, canvasWidth = 900, canvasHeight = 700 } = {}) {
  function pixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains("desktop-canvas")) {
      return new DOMRect(canvasLeft, canvasTop, canvasWidth, canvasHeight);
    }
    if (this.classList.contains("mac-window")) {
      const computed = window.getComputedStyle(this);
      const widthAdjustment = computed.boxSizing === "content-box"
        ? pixels(computed.paddingLeft) + pixels(computed.paddingRight) +
          pixels(computed.borderLeftWidth) + pixels(computed.borderRightWidth)
        : 0;
      const heightAdjustment = computed.boxSizing === "content-box"
        ? pixels(computed.paddingTop) + pixels(computed.paddingBottom) +
          pixels(computed.borderTopWidth) + pixels(computed.borderBottomWidth)
        : 0;
      return new DOMRect(
        canvasLeft + pixels(this.style.left) + pixels(computed.marginLeft),
        canvasTop + pixels(this.style.top) + pixels(computed.marginTop),
        pixels(this.style.width) + widthAdjustment,
        pixels(this.style.height) + heightAdjustment,
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

function DragHarness() {
  const drag = useWindowDrag<HTMLElement>(true);
  return (
    <div className="desktop-canvas">
      <section
        ref={drag.windowRef}
        className="legacy-drag-window"
        style={{ transform: "rotate(2deg)", ...drag.style }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
      >
        <div data-window-drag-handle="">Title</div>
      </section>
    </div>
  );
}

function StatefulWindowBody() {
  const [count, setCount] = useState(0);
  return (
    <div data-window-drag-handle="">
      <TrafficLights />
      <button data-state-count="" type="button" onClick={() => setCount((current) => current + 1)}>Count {count}</button>
    </div>
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
  it("clamps the generic drag hook to its offset desktop canvas without replacing caller transforms", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) return new DOMRect(300, 50, 400, 300);
      if (this.classList.contains("legacy-drag-window")) return new DOMRect(350, 90, 300, 200);
      return new DOMRect();
    });
    const { container } = render(<DragHarness />);
    const windowElement = container.querySelector<HTMLElement>(".legacy-drag-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    firePointer(handle, "pointerdown", { clientX: 400, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 1_400, clientY: 100 });
    await flushAnimationFrame();

    expect(windowElement.style.translate).toBe("230px 0px");
    expect(windowElement.style.transform).toBe("rotate(2deg)");
  });

  it("discards a queued generic drag offset when its canvas is recontained", () => {
    const layout = { left: 300, top: 50, width: 400, height: 300 };
    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    let notifyResize: () => void = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      queuedFrames.set(frameId, callback);
      return frameId;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) {
        return new DOMRect(layout.left, layout.top, layout.width, layout.height);
      }
      if (this.classList.contains("legacy-drag-window")) {
        const [translateX = "0", translateY = "0"] = this.style.translate.split(" ");
        return new DOMRect(
          layout.left + 50 + Number.parseFloat(translateX),
          layout.top + 40 + Number.parseFloat(translateY),
          300,
          200,
        );
      }
      return new DOMRect();
    });

    const { container } = render(<DragHarness />);
    const windowElement = container.querySelector<HTMLElement>(".legacy-drag-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    firePointer(handle, "pointerdown", { clientX: 400, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 600, clientY: 100 });
    expect(windowElement.style.translate).toBe("0px 0px");

    layout.width = 300;
    act(() => notifyResize());
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1);
    expect(windowElement.style.translate).toBe("0px 0px");

    // A canceled callback can still be invoked by a hostile scheduler. It
    // must not resurrect the pre-resize pointer offset.
    act(() => queuedFrames.get(1)?.(0));
    expect(windowElement.style.translate).toBe("0px 0px");
  });

  it("rebases an active generic drag when its canvas shrinks", () => {
    const layout = { left: 300, top: 50, width: 400, height: 300 };
    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    let notifyResize: () => void = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      queuedFrames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) {
        return new DOMRect(layout.left, layout.top, layout.width, layout.height);
      }
      if (this.classList.contains("legacy-drag-window")) {
        const [translateX = "0", translateY = "0"] = this.style.translate.split(" ");
        return new DOMRect(
          layout.left + 50 + Number.parseFloat(translateX),
          layout.top + 40 + Number.parseFloat(translateY),
          300,
          200,
        );
      }
      return new DOMRect();
    });

    const { container } = render(<DragHarness />);
    const windowElement = container.querySelector<HTMLElement>(".legacy-drag-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    firePointer(handle, "pointerdown", { clientX: 400, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 600, clientY: 100 });
    act(() => queuedFrames.get(1)?.(0));
    expect(windowElement.style.translate).toBe("200px 0px");

    layout.width = 300;
    act(() => notifyResize());
    expect(windowElement.style.translate).toBe("130px 0px");

    firePointer(windowElement, "pointermove", { clientX: 590, clientY: 100 });
    act(() => queuedFrames.get(2)?.(0));
    expect(windowElement.style.translate).toBe("120px 0px");
  });

  it("applies the generic default frame, centered", () => {
    const { container } = render(
      <WindowChrome label="Plain">
        <p>Body</p>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    expect(windowElement?.style.height).toBe("480px");
    // cssstyle algebraically serializes nested min/max, so assert the three
    // operands that define responsive centering rather than its punctuation.
    expect(windowElement?.style.left).toContain("720px");
    expect(windowElement?.style.left).toContain("24px");
    expect(windowElement?.style.left).toContain("25%");
  });

  it("centers the first CSS-only frame within a narrow canvas width cap", () => {
    const { container } = render(
      <div className="desktop-canvas" style={{ height: 600, width: 375 }}>
        <WindowChrome label="Narrow first frame">
          <p>Body</p>
        </WindowChrome>
      </div>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.width).toBe("720px");
    expect(windowElement?.style.left).toContain("720px");
    expect(windowElement?.style.left).toContain("24px");
    expect(windowElement?.style.left).toContain("25%");
    const baseStyles = readFileSync("styles/base.css", "utf8");
    expect(baseStyles).toMatch(/\.mac-window\s*\{[^}]*max-width:\s*max\(50%, calc\(100% - 48px\)\)/s);
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

  it("reapplies changed authored geometry while preserving drag state for equivalent inputs", async () => {
    mockAuthoredLayout();
    function geometryWindow({
      defaultWidth,
      frameLeft,
      style,
    }: {
      readonly defaultWidth: number;
      readonly frameLeft: number;
      readonly style?: CSSProperties;
    }) {
      return (
        <div className="desktop-canvas">
          <WindowChrome
            defaultSize={{ width: defaultWidth, height: 360 }}
            frame={{ left: frameLeft, top: 80 }}
            label="Reactive geometry"
            style={style}
          >
            <div data-window-drag-handle="">Title <TrafficLights /></div>
          </WindowChrome>
        </div>
      );
    }

    const { container, getByRole, rerender } = render(geometryWindow({ defaultWidth: 500, frameLeft: 100 }));
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 240, clientY: 100 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe("140px");

    rerender(geometryWindow({ defaultWidth: 500, frameLeft: 100 }));
    expect(windowElement.style.left).toBe("140px");

    rerender(geometryWindow({ defaultWidth: 550, frameLeft: 100 }));
    expect(windowElement.style.left).toBe("100px");
    expect(windowElement.style.width).toBe("550px");

    rerender(geometryWindow({ defaultWidth: 550, frameLeft: 180 }));
    expect(windowElement.style.left).toBe("180px");

    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement.style.width).toBe("calc(100% - 48px)");
    rerender(geometryWindow({ defaultWidth: 600, frameLeft: 200 }));
    expect(windowElement.style.width).toBe("calc(100% - 48px)");
    fireEvent.click(getByRole("button", { name: "Zoom window" }));
    expect(windowElement.style.left).toBe("200px");
    expect(windowElement.style.width).toBe("600px");

    rerender(geometryWindow({
      defaultWidth: 550,
      frameLeft: 180,
      style: { left: 220, top: 90, width: 480, height: 320 },
    }));
    expect(windowElement.style.left).toBe("220px");
    expect(windowElement.style.top).toBe("90px");
    expect(windowElement.style.width).toBe("480px");
    expect(windowElement.style.height).toBe("320px");
  });

  it("removes competing logical frame properties once physical interaction geometry owns the window", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) return new DOMRect(40, 20, 900, 700);
      if (this.classList.contains("mac-window")) {
        const left = Number.parseFloat(this.style.insetInlineStart || this.style.left) || 0;
        const top = Number.parseFloat(this.style.insetBlockStart || this.style.top) || 0;
        const width = Number.parseFloat(this.style.inlineSize || this.style.width) || 0;
        const height = Number.parseFloat(this.style.blockSize || this.style.height) || 0;
        return new DOMRect(40 + left, 20 + top, width, height);
      }
      return new DOMRect();
    });
    const { container } = render(
      <div className="desktop-canvas">
        <WindowChrome
          frame={{ left: 100, top: 80, width: 500, height: 360 }}
          label="Logical geometry"
          style={{
            blockSize: 450,
            inlineSize: 600,
            insetBlockStart: 90,
            insetInlineStart: 140,
          }}
        >
          <div data-window-drag-handle="">Title</div>
        </WindowChrome>
      </div>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    expect(windowElement.style.left).toBe("140px");
    expect(windowElement.style.top).toBe("90px");
    expect(windowElement.style.width).toBe("600px");
    expect(windowElement.style.height).toBe("450px");
    expect(windowElement.style.insetInlineStart).toBe("");
    expect(windowElement.style.insetBlockStart).toBe("");
    expect(windowElement.style.inlineSize).toBe("");
    expect(windowElement.style.blockSize).toBe("");

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 120 });
    firePointer(windowElement, "pointermove", { clientX: 220, clientY: 130 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe("160px");
    expect(windowElement.style.top).toBe("100px");
    expect(windowElement.getBoundingClientRect().left).toBe(200);
    expect(windowElement.getBoundingClientRect().width).toBe(600);
  });

  it.each([
    {
      expectedHeight: 450,
      expectedWidth: 400,
      frame: { left: 100, top: 80, width: 500, height: 300 },
      name: "maximum width and minimum height",
      style: { maxWidth: 400, minHeight: 450 },
    },
    {
      expectedHeight: 350,
      expectedWidth: 550,
      frame: { left: 100, top: 80, width: 500, height: 400 },
      name: "minimum width and maximum height",
      style: { minWidth: 550, maxHeight: 350 },
    },
  ] satisfies readonly {
    readonly expectedHeight: number;
    readonly expectedWidth: number;
    readonly frame: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
    readonly name: string;
    readonly style: CSSProperties;
  }[])("normalizes authored $name into unconstrained interactive geometry", async ({
    expectedHeight,
    expectedWidth,
    frame,
    style,
  }) => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) return new DOMRect(40, 20, 900, 700);
      if (this.classList.contains("mac-window")) {
        const authoredWidth = Number.parseFloat(this.style.width) || 0;
        const authoredHeight = Number.parseFloat(this.style.height) || 0;
        const minWidth = Number.parseFloat(this.style.minWidth);
        const maxWidth = Number.parseFloat(this.style.maxWidth);
        const minHeight = Number.parseFloat(this.style.minHeight);
        const maxHeight = Number.parseFloat(this.style.maxHeight);
        const width = Math.min(
          Number.isFinite(maxWidth) ? maxWidth : Number.POSITIVE_INFINITY,
          Math.max(Number.isFinite(minWidth) ? minWidth : 0, authoredWidth),
        );
        const height = Math.min(
          Number.isFinite(maxHeight) ? maxHeight : Number.POSITIVE_INFINITY,
          Math.max(Number.isFinite(minHeight) ? minHeight : 0, authoredHeight),
        );
        return new DOMRect(
          40 + (Number.parseFloat(this.style.left) || 0),
          20 + (Number.parseFloat(this.style.top) || 0),
          width,
          height,
        );
      }
      return new DOMRect();
    });
    const { container } = render(
      <div className="desktop-canvas">
        <WindowChrome
          frame={frame}
          label="Constrained geometry"
          minSize={{ width: 100, height: 100 }}
          style={style}
        >
          <div data-window-drag-handle="">Title</div>
        </WindowChrome>
      </div>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement).toBeTruthy();
    if (windowElement === null) return;

    expect(windowElement.style.width).toBe(`${expectedWidth}px`);
    expect(windowElement.style.height).toBe(`${expectedHeight}px`);
    expect(windowElement.style.minWidth).toBe("");
    expect(windowElement.style.maxWidth).toBe("");
    expect(windowElement.style.minHeight).toBe("");
    expect(windowElement.style.maxHeight).toBe("");

    await resizeFrom(windowElement, "se", 20, 20);
    expect(windowElement.style.width).toBe(`${expectedWidth + 20}px`);
    expect(windowElement.style.height).toBe(`${expectedHeight + 20}px`);
    expect(windowElement.getBoundingClientRect().width).toBe(expectedWidth + 20);
    expect(windowElement.getBoundingClientRect().height).toBe(expectedHeight + 20);
  });

  it("preserves responsive authored geometry through click-only gestures and activates pixels on movement", async () => {
    const layout = { canvasLeft: 40, canvasTop: 20, canvasWidth: 800, canvasHeight: 600 };
    let notifyResize: () => void = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    function resolvedLength(value: string, available: number): number {
      if (value.endsWith("%")) return available * Number.parseFloat(value) / 100;
      return Number.parseFloat(value) || 0;
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) {
        return new DOMRect(layout.canvasLeft, layout.canvasTop, layout.canvasWidth, layout.canvasHeight);
      }
      if (this.classList.contains("mac-window")) {
        const left = resolvedLength(this.style.left, layout.canvasWidth);
        const top = resolvedLength(this.style.top, layout.canvasHeight);
        const width = resolvedLength(this.style.width, layout.canvasWidth);
        const height = resolvedLength(this.style.height, layout.canvasHeight);
        return new DOMRect(layout.canvasLeft + left, layout.canvasTop + top, width, height);
      }
      return new DOMRect();
    });
    const { container } = render(
      <div className="desktop-canvas">
        <WindowChrome
          frame={{ left: "10%", top: "10%", width: "50%", height: "50%" }}
          label="Responsive geometry"
          minSize={{ width: 100, height: 100 }}
        >
          <div data-window-drag-handle="">Title</div>
        </WindowChrome>
      </div>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;

    expect(windowElement.style.left).toBe("10%");
    expect(windowElement.style.width).toBe("50%");
    firePointer(handle, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(windowElement, "pointerup", { clientX: 100, clientY: 100 });
    expect(windowElement.style.left).toBe("10%");
    expect(windowElement.style.width).toBe("50%");

    layout.canvasWidth = 600;
    layout.canvasHeight = 500;
    act(() => notifyResize());
    await flushNextTask();
    expect(windowElement.style.left).toBe("10%");
    expect(windowElement.style.width).toBe("50%");
    expect(windowElement.getBoundingClientRect().left).toBe(100);
    expect(windowElement.getBoundingClientRect().width).toBe(300);

    firePointer(handle, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(windowElement, "pointermove", { clientX: 120, clientY: 110 });
    await flushAnimationFrame();
    firePointer(windowElement, "pointerup", { clientX: 120, clientY: 110 });
    expect(windowElement.style.left).toBe("80px");
    expect(windowElement.style.top).toBe("60px");
    expect(windowElement.style.width).toBe("300px");
    expect(windowElement.style.height).toBe("250px");
  });

  it.each([
    { name: "margin shorthand", style: { margin: "12px 0 0 18px" } },
    { name: "margin-left and margin-top", style: { marginLeft: 24, marginTop: 16 } },
  ] satisfies readonly { readonly name: string; readonly style: CSSProperties }[])(
    "keeps authored coordinates stable with $name",
    async ({ style }) => {
      mockBoxModelLayout();
      const { container } = render(
        <div className="desktop-canvas">
          <WindowChrome frame={{ left: 100, top: 80, width: 500, height: 360 }} label="Margin window" style={style}>
            <div data-window-drag-handle="">Title</div>
          </WindowChrome>
        </div>,
      );
      const windowElement = container.querySelector<HTMLElement>(".mac-window");
      const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
      expect(windowElement?.style.left).toBe("100px");
      expect(windowElement?.style.top).toBe("80px");
      if (windowElement === null || handle === null) return;

      firePointer(handle, "pointerdown", { clientX: 200, clientY: 100 });
      firePointer(windowElement, "pointermove", { clientX: 230, clientY: 120 });
      await flushAnimationFrame();
      expect(windowElement.style.left).toBe("130px");
      expect(windowElement.style.top).toBe("100px");
    },
  );

  it("writes interactive border-box geometry as content-box dimensions", async () => {
    mockBoxModelLayout();
    function contentBoxWindow(padding: string, border: string) {
      return (
        <div className="desktop-canvas">
          <WindowChrome
            frame={{ left: 100, top: 80, width: 500, height: 360 }}
            label="Content-box window"
            style={{ border, boxSizing: "content-box", padding }}
          >
            <div data-window-drag-handle="">Title</div>
          </WindowChrome>
        </div>
      );
    }
    const { container, rerender } = render(contentBoxWindow("10px 20px", "4px solid transparent"));
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement).toBeTruthy();
    if (windowElement === null) return;

    expect(windowElement.style.width).toBe("500px");
    expect(windowElement.style.height).toBe("360px");
    expect(windowElement.getBoundingClientRect().width).toBe(548);
    expect(windowElement.getBoundingClientRect().height).toBe(388);

    await resizeFrom(windowElement, "se", 20, 20);
    expect(windowElement.style.width).toBe("520px");
    expect(windowElement.style.height).toBe("380px");
    expect(windowElement.getBoundingClientRect().width).toBe(568);
    expect(windowElement.getBoundingClientRect().height).toBe(408);

    rerender(contentBoxWindow("20px 30px", "6px solid transparent"));
    expect(windowElement.style.width).toBe("500px");
    expect(windowElement.style.height).toBe("360px");
    expect(windowElement.getBoundingClientRect().width).toBe(572);
    expect(windowElement.getBoundingClientRect().height).toBe(412);
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

  it("captures untransformed layout geometry without applying caller transforms twice", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("desktop-canvas")) return new DOMRect(40, 20, 800, 600);
      if (this.classList.contains("mac-window")) {
        return this.style.transform === "none"
          ? new DOMRect(140, 100, 500, 400)
          : new DOMRect(160, 120, 1_000, 800);
      }
      return new DOMRect();
    });
    const { container } = render(
      <div className="desktop-canvas">
        <WindowChrome
          frame={{ top: 80, left: 100, width: 500, height: 400 }}
          label="Transformed window"
          style={{ transform: "translate(20px, 10px) scale(2)" }}
        >
          <div data-window-drag-handle="">Title</div>
        </WindowChrome>
      </div>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");

    expect(windowElement?.style.left).toBe("100px");
    expect(windowElement?.style.top).toBe("80px");
    expect(windowElement?.style.width).toBe("500px");
    expect(windowElement?.style.height).toBe("400px");
    expect(windowElement?.style.transform).toBe("translate(20px, 10px) scale(2)");
  });

  it("recontains standalone windows when the viewport resizes", async () => {
    let viewportWidth = 800;
    vi.spyOn(window, "innerWidth", "get").mockImplementation(() => viewportWidth);
    vi.spyOn(window, "innerHeight", "get").mockImplementation(() => 600);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this.classList.contains("mac-window")) return new DOMRect(100, 80, 500, 400);
      return new DOMRect();
    });
    const { container } = render(
      <WindowChrome frame={{ top: 80, left: 100, width: 500, height: 400 }} label="Viewport window">
        <div data-window-drag-handle="">Title</div>
      </WindowChrome>,
    );
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    expect(windowElement?.style.left).toBe("100px");

    viewportWidth = 450;
    act(() => window.dispatchEvent(new Event("resize")));
    await flushNextTask();

    expect(windowElement?.style.left).toBe("24px");
    expect(windowElement?.style.width).toBe("402px");
  });

  it("keeps a positive reachable frame even when the canvas is smaller than the safe insets", () => {
    mockLayout({
      canvasLeft: 0,
      canvasTop: 0,
      canvasWidth: 40,
      canvasHeight: 100,
      windowLeft: 0,
      windowTop: 0,
      windowWidth: 500,
      windowHeight: 400,
    });
    const { container } = renderCanvasWindow({ minSize: { width: 100, height: 100 } });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const width = Number.parseFloat(windowElement?.style.width ?? "0");
    const height = Number.parseFloat(windowElement?.style.height ?? "0");

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(40);
    expect(height).toBeLessThanOrEqual(100);
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

  it("rebases an active resize when its canvas shrinks", async () => {
    const layout = { ...standardLayout };
    let notifyResize: () => void = () => undefined;
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    mockLayout(layout);
    const { container } = renderCanvasWindow({ minSize: { width: 100, height: 100 } });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = windowElement?.querySelector<HTMLElement>("[data-window-resize-handle='w']");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null || handle === undefined) return;

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 200 });
    layout.canvasWidth = 450;
    act(() => notifyResize());
    await flushNextTask();
    expect(windowElement.style.left).toBe("24px");
    expect(windowElement.style.width).toBe("402px");

    firePointer(windowElement, "pointermove", { clientX: 210, clientY: 200 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe("34px");
    expect(windowElement.style.width).toBe("392px");
  });

  it("synchronously contains resize geometry when the canvas shrinks before observer rebase", () => {
    vi.useFakeTimers();
    try {
      const layout = { ...standardLayout };
      let notifyResize: () => void = () => undefined;
      class TestResizeObserver implements ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = () => callback([], this);
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      vi.stubGlobal("ResizeObserver", TestResizeObserver);
      mockLayout(layout);
      const animationFrames = mockAnimationFrameQueue();
      const { container } = renderCanvasWindow({ minSize: { width: 50, height: 50 } });
      const windowElement = container.querySelector<HTMLElement>(".mac-window");
      const handle = windowElement?.querySelector<HTMLElement>("[data-window-resize-handle='e']");
      expect(windowElement).toBeTruthy();
      expect(handle).toBeTruthy();
      if (windowElement === null || handle === null || handle === undefined) return;

      firePointer(handle, "pointerdown", { clientX: 200, clientY: 200 });
      layout.canvasWidth = 100;
      act(() => notifyResize());
      expect(windowElement.style.width).toBe("500px");

      // ResizeObserver containment is still queued. The pointer path must
      // synchronously recontain its invalid fixed edge before doing math.
      firePointer(windowElement, "pointermove", { clientX: 210, clientY: 200 });
      act(() => animationFrames.queuedFrames.get(1)?.(0));
      expect(windowElement.style.left).toBe("24px");
      expect(windowElement.style.width).toBe("52px");
      expect(Number.parseFloat(windowElement.style.width)).toBeGreaterThanOrEqual(0);

      // The gesture was rebased at the shrink sample, so its next delta is
      // continuous and respects the available minimum instead of stale edges.
      firePointer(windowElement, "pointermove", { clientX: 200, clientY: 200 });
      act(() => animationFrames.queuedFrames.get(2)?.(0));
      expect(windowElement.style.left).toBe("24px");
      expect(windowElement.style.width).toBe("50px");
    } finally {
      act(() => vi.runOnlyPendingTimers());
      vi.useRealTimers();
    }
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

  it("retains managed child state while removing minimized and closed windows from UI and observation", async () => {
    let observeCount = 0;
    let disconnectCount = 0;
    class TestResizeObserver implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe(): void { observeCount += 1; }
      unobserve(): void {}
      disconnect(): void { disconnectCount += 1; }
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    mockAuthoredLayout();
    const { container, getByRole, queryByRole } = render(
      <MacWindowManager>
        <div className="desktop-canvas">
          <MacApp id="stateful" name="Stateful app" icon="/stateful.png">
            <WindowChrome frame={{ left: 100, top: 80, width: 500, height: 360 }} label="Stateful window">
              <StatefulWindowBody />
            </WindowChrome>
          </MacApp>
          <MacAppDock label="State Dock" />
        </div>
      </MacWindowManager>,
    );

    fireEvent.click(getByRole("button", { name: "Count 0" }));
    expect(getByRole("button", { name: "Count 1" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Minimize window" }));
    const minimizedItem = await waitFor(() =>
      within(getByRole("navigation", { name: "State Dock" })).getByRole("button", { name: "Stateful window" }));
    expect(queryByRole("region", { name: "Stateful window" })).toBeNull();
    const retainedAfterMinimize = container.querySelector<HTMLElement>(".mac-window.mc-retained");
    expect(retainedAfterMinimize?.hidden).toBe(true);
    expect(retainedAfterMinimize?.hasAttribute("inert")).toBe(true);
    expect(retainedAfterMinimize?.style.display).toBe("none");
    expect(retainedAfterMinimize?.hasAttribute("data-window-id")).toBe(false);
    expect(retainedAfterMinimize?.querySelector("[data-state-count]")?.textContent).toBe("Count 1");
    expect(disconnectCount).toBe(1);

    fireEvent.click(minimizedItem);
    await waitFor(() => expect(getByRole("region", { name: "Stateful window" })).toBeTruthy());
    expect(getByRole("button", { name: "Count 1" })).toBeTruthy();
    expect(observeCount).toBe(2);

    fireEvent.click(getByRole("button", { name: "Close window" }));
    expect(queryByRole("region", { name: "Stateful window" })).toBeNull();
    expect(container.querySelector(".mc-retained [data-state-count]")?.textContent).toBe("Count 1");
    expect(disconnectCount).toBe(2);

    const appItem = within(getByRole("navigation", { name: "State Dock" }))
      .getByRole("button", { name: "Stateful app" });
    fireEvent.click(appItem);
    expect(getByRole("region", { name: "Stateful window" })).toBeTruthy();
    expect(getByRole("button", { name: "Count 1" })).toBeTruthy();
    expect(observeCount).toBe(3);
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

  it("cancels an active drag and its queued geometry when zoom disables interaction", () => {
    mockLayout({ ...standardLayout });
    const animationFrames = mockAnimationFrameQueue();
    const { container, getByRole } = renderCanvasWindow({ withControls: true });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    expect(windowElement).toBeTruthy();
    expect(handle).toBeTruthy();
    if (windowElement === null || handle === null) return;
    const releasePointerCapture = mockPointerCapture(windowElement);

    firePointer(handle, "pointerdown", { clientX: 200, clientY: 200 });
    firePointer(windowElement, "pointermove", { clientX: 250, clientY: 220 });
    expect(animationFrames.requestAnimationFrame).toHaveBeenCalledTimes(1);

    const zoomButton = getByRole("button", { name: "Zoom window" });
    fireEvent.click(zoomButton);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(animationFrames.cancelAnimationFrame).toHaveBeenCalledWith(1);

    // Pointer capture can deliver one more move after release. The disabled
    // hook must neither revive the gesture nor enqueue replacement geometry.
    firePointer(windowElement, "pointermove", { clientX: 400, clientY: 300 });
    expect(animationFrames.requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => animationFrames.queuedFrames.get(1)?.(0));

    fireEvent.click(zoomButton);
    expect(windowElement.style.left).toBe("100px");
    expect(windowElement.style.top).toBe("80px");
    expect(windowElement.style.width).toBe("500px");
    expect(windowElement.style.height).toBe("400px");
  });

  it("cancels an active resize and its queued geometry when zoom disables interaction", () => {
    mockLayout({ ...standardLayout });
    const animationFrames = mockAnimationFrameQueue();
    const { container, getByRole } = renderCanvasWindow({ withControls: true });
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const resizeHandle = windowElement?.querySelector<HTMLElement>("[data-window-resize-handle='e']");
    expect(windowElement).toBeTruthy();
    expect(resizeHandle).toBeTruthy();
    if (windowElement === null || resizeHandle === null || resizeHandle === undefined) return;
    const releasePointerCapture = mockPointerCapture(windowElement);

    firePointer(resizeHandle, "pointerdown", { clientX: 200, clientY: 200 });
    firePointer(windowElement, "pointermove", { clientX: 250, clientY: 200 });
    expect(animationFrames.requestAnimationFrame).toHaveBeenCalledTimes(1);

    const zoomButton = getByRole("button", { name: "Zoom window" });
    fireEvent.click(zoomButton);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(animationFrames.cancelAnimationFrame).toHaveBeenCalledWith(1);

    firePointer(windowElement, "pointermove", { clientX: 400, clientY: 200 });
    expect(animationFrames.requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => animationFrames.queuedFrames.get(1)?.(0));

    fireEvent.click(zoomButton);
    expect(windowElement.style.left).toBe("100px");
    expect(windowElement.style.top).toBe("80px");
    expect(windowElement.style.width).toBe("500px");
    expect(windowElement.style.height).toBe("400px");
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

    const originalLeft = windowElement.style.left;
    firePointer(control, "pointerdown", { clientX: 300, clientY: 40 });
    firePointer(windowElement, "pointermove", { clientX: 380, clientY: 90 });
    await flushAnimationFrame();
    expect(windowElement.style.left).toBe(originalLeft);
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
