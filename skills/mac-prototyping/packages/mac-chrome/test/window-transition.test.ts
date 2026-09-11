import { afterEach, describe, expect, it, vi } from "vitest";

import { toPng } from "html-to-image";

import { captureMacWindowThumbnail, macWindowViewTransitionName } from "../window-transition.ts";

describe("macWindowViewTransitionName", () => {
  it("injectively encodes ids that collided under delimiter escaping", () => {
    const ids = [":", "-3a-", "notes:main", "notes-3a-main", "", "é", "😀", "\ud83d", "\ude00"];
    const names = ids.map(macWindowViewTransitionName);

    expect(new Set(names).size).toBe(ids.length);
    expect(names).toEqual([
      "mc-window-1-003a",
      "mc-window-4-002d00330061002d",
      "mc-window-a-006e006f007400650073003a006d00610069006e",
      "mc-window-d-006e006f007400650073002d00330061002d006d00610069006e",
      "mc-window-0-",
      "mc-window-1-00e9",
      "mc-window-2-d83dde00",
      "mc-window-1-d83d",
      "mc-window-1-de00",
    ]);
  });
});

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe("captureMacWindowThumbnail", () => {
  it.each([0.5, 1, 1.5])("captures logical dimensions at presentation scale %s", async (scale) => {
    const element = document.createElement("div");
    Object.defineProperties(element, {
      offsetWidth: { value: 720 },
      offsetHeight: { value: 480 },
    });
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 30, 720 * scale, 480 * scale));
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,fixture");

    expect(await captureMacWindowThumbnail(element)).toEqual({
      src: "data:image/png;base64,fixture", width: 720, height: 480, rasterWidth: 360, rasterHeight: 240,
    });
    expect(toPng).toHaveBeenCalledWith(element, expect.objectContaining({
      width: 720, height: 480, canvasWidth: 360, canvasHeight: 240, pixelRatio: 1,
      style: expect.objectContaining({ translate: "none", transform: "none", left: "0", top: "0" }),
    }));
  });

  it("preserves logical fallback geometry when rasterization fails", async () => {
    const element = document.createElement("div");
    element.style.width = "600px";
    element.style.height = "400px";
    vi.mocked(toPng).mockRejectedValue(new Error("Resource unavailable"));
    expect(await captureMacWindowThumbnail(element)).toEqual({ width: 600, height: 400 });
  });
});
