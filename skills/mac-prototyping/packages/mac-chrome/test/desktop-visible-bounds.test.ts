import { afterEach, describe, expect, it, vi } from "vitest";

import { getVisibleDesktopBounds } from "../desktop-space.tsx";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function canvas() {
  const element = document.createElement("div");
  Object.defineProperties(element, { offsetWidth: { value: 1440 }, offsetHeight: { value: 900 } });
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 30, 720, 450));
  return element;
}

describe("visible logical desktop bounds", () => {
  it("intersects a panned visual viewport before converting to logical points", () => {
    vi.stubGlobal("visualViewport", { offsetLeft: 200, offsetTop: 100, width: 300, height: 250 });
    expect(getVisibleDesktopBounds(canvas())).toEqual({ left: 320, top: 140, right: 920, bottom: 640 });
  });

  it("retains the full canvas when the visual viewport contains it", () => {
    vi.stubGlobal("visualViewport", { offsetLeft: 0, offsetTop: 0, width: 1000, height: 800 });
    expect(getVisibleDesktopBounds(canvas())).toEqual({ left: 0, top: 0, right: 1440, bottom: 900 });
  });

  it("uses layout viewport bounds when visualViewport is unavailable", () => {
    vi.stubGlobal("visualViewport", undefined);
    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 300);
    expect(getVisibleDesktopBounds(canvas())).toEqual({ left: 0, top: 0, right: 720, bottom: 540 });
  });

  it("returns an empty intersection at the canvas edge when it is outside the viewport", () => {
    vi.stubGlobal("visualViewport", { offsetLeft: 900, offsetTop: 500, width: 200, height: 100 });
    expect(getVisibleDesktopBounds(canvas())).toEqual({ left: 1440, top: 900, right: 1440, bottom: 900 });
  });
});
