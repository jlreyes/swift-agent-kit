import { cleanup, render } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopShell } from "../desktop-shell.tsx";
import { getElementScale, macBookAirM1DisplaySize, viewportDeltaToLocal, viewportPointToLocal } from "../desktop-space.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { WindowChrome } from "../window.tsx";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function pointer(target: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 7 }, isPrimary: { value: true }, pointerType: { value: "mouse" } });
  act(() => target.dispatchEvent(event));
}

async function frame() {
  await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
}

function mockScale(scale: number) {
  let currentScale = scale;
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function(this: HTMLElement) {
    return this.classList.contains("desktop-canvas") ? 1440 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function(this: HTMLElement) {
    return this.classList.contains("desktop-canvas") ? 900 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    if (this.classList.contains("desktop-canvas")) return new DOMRect(30, 50, 1440 * currentScale, 900 * currentScale);
    if (this.classList.contains("mac-window")) return new DOMRect(
      30 + Number.parseFloat(this.style.left) * currentScale,
      50 + Number.parseFloat(this.style.top) * currentScale,
      Number.parseFloat(this.style.width) * currentScale,
      Number.parseFloat(this.style.height) * currentScale,
    );
    return new DOMRect();
  });
  return (nextScale: number) => { currentScale = nextScale; };
}

describe("logical desktop coordinates", () => {
  it("uses effective M1 Air desktop points, independent of panel pixels", () => {
    expect(macBookAirM1DisplaySize).toEqual({ width: 1440, height: 900 });
    const { container } = render(<DesktopShell appName="Test" date="Fri" clock="9:41" children={null} />);
    expect(container.querySelector("main")?.dataset.displaySpace).toBe("logical");
    expect(container.querySelector("main")?.style.getPropertyValue("--mc-display-width")).toBe("1440px");
    expect(container.querySelector("main")?.style.getPropertyValue("--mc-display-fit-width")).toBe("min(1440px, calc(100dvh * 1.6))");
  });

  it("fits embedded desktops to the explicit host height rather than the page viewport", () => {
    const { container } = render(<MacEmbeddedPresentation windowManagement height={560}><DesktopShell appName="Test" children={null} /></MacEmbeddedPresentation>);
    expect(container.querySelector("main")?.style.getPropertyValue("--mc-display-fit-width")).toBe("896px");
    expect(container.querySelector("main")?.style.getPropertyValue("--mc-display-height")).toBe("900px");
  });

  it("keeps static embedded windows inert and fitted with the existing surround", () => {
    const { container } = render(<MacEmbeddedPresentation><DesktopShell appName="Test"><WindowChrome label="Static">Content</WindowChrome></DesktopShell></MacEmbeddedPresentation>);
    expect(container.querySelector("main")?.dataset.displaySpace).toBe("viewport");
    expect(container.querySelector(".mac-window")?.getAttribute("data-embedded-window")).toBe("true");
    expect(container.querySelector("[data-window-resize-handle]")).toBeNull();
  });

  it("preserves the logical frame and ends a gesture when its presentation scale changes", async () => {
    const changeScale = mockScale(0.5);
    const { container } = render(<DesktopShell appName="Test"><WindowChrome label="Authored" frame={{ left: 100, top: 80, width: 600, height: 400 }}><div data-window-drag-handle="">Title</div></WindowChrome></DesktopShell>);
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    if (windowElement === null || handle === null) throw new Error("Missing window");
    pointer(handle, "pointerdown", 100, 50);
    pointer(windowElement, "pointermove", 140, 70);
    await frame();
    expect(windowElement.style.left).toBe("180px");
    changeScale(0.8);
    pointer(windowElement, "pointermove", 200, 100);
    await frame();
    expect(windowElement.style.left).toBe("180px");
    expect(windowElement.style.top).toBe("120px");
    expect(windowElement.style.width).toBe("600px");
    pointer(handle, "pointerdown", 200, 100);
    pointer(windowElement, "pointermove", 280, 140);
    await frame();
    expect(windowElement.style.left).toBe("280px");
    expect(windowElement.style.top).toBe("170px");
  });

  it.each([0.25, 0.5, 0.8, 1, 1.25, 2])("maps viewport coordinates and gestures at scale %s", async (scale) => {
    mockScale(scale);
    const { container } = render(<MacEmbeddedPresentation windowManagement><DesktopShell appName="Test"><WindowChrome label="Authored" frame={{ left: 100, top: 80, width: 600, height: 400 }}><div data-window-drag-handle="">Title</div></WindowChrome></DesktopShell></MacEmbeddedPresentation>);
    const canvas = container.querySelector<HTMLElement>(".desktop-canvas");
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    const resize = container.querySelector<HTMLElement>("[data-window-resize-handle='se']");
    if (canvas === null || windowElement === null || handle === null || resize === null) throw new Error("Missing desktop elements");
    expect(getElementScale(canvas)).toEqual({ x: scale, y: scale });
    expect(viewportPointToLocal(canvas, { x: 30 + 100 * scale, y: 50 + 80 * scale })).toEqual({ x: 100, y: 80 });
    expect(viewportDeltaToLocal(canvas, { x: 80 * scale, y: 40 * scale })).toEqual({ x: 80, y: 40 });
    expect(windowElement.style.width).toBe("600px");
    expect(windowElement.style.left).toBe("100px");
    pointer(handle, "pointerdown", 200 * scale, 100 * scale);
    pointer(windowElement, "pointermove", 280 * scale, 140 * scale);
    await frame();
    pointer(windowElement, "pointerup", 280 * scale, 140 * scale);
    expect(windowElement.style.left).toBe("180px");
    expect(windowElement.style.top).toBe("120px");
    pointer(resize, "pointerdown", 780 * scale, 520 * scale);
    pointer(windowElement, "pointermove", 880 * scale, 570 * scale);
    await frame();
    pointer(windowElement, "pointerup", 880 * scale, 570 * scale);
    expect(windowElement.style.width).toBe("700px");
    expect(windowElement.style.height).toBe("450px");
  });
  it.each([0.25, 0.5, 0.8, 1, 1.25, 2])("keeps the grabbed title point reachable offscreen at scale %s", async (scale) => {
    mockScale(scale);
    const { container } = render(<DesktopShell appName="Test"><WindowChrome label="Recoverable" frame={{ left: 100, top: 80, width: 600, height: 400 }}><div data-window-drag-handle="">Title</div></WindowChrome></DesktopShell>);
    const windowElement = container.querySelector<HTMLElement>(".mac-window");
    const handle = container.querySelector<HTMLElement>("[data-window-drag-handle]");
    if (windowElement === null || handle === null) throw new Error("Missing window");
    const titleY = 50 + 96 * scale;
    pointer(handle, "pointerdown", 30 + 400 * scale, titleY);
    pointer(windowElement, "pointermove", 30 - 5000 * scale, titleY);
    await frame();
    pointer(windowElement, "pointerup", 30 - 5000 * scale, titleY);
    expect(windowElement.style.left).toBe("-252px");
    expect(Number.parseFloat(windowElement.style.left) + 300).toBe(48);
    pointer(handle, "pointerdown", 30 + 48 * scale, titleY);
    pointer(windowElement, "pointermove", 30 + 108 * scale, titleY);
    await frame();
    expect(windowElement.style.left).toBe("-192px");
  });

});
