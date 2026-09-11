import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DesktopSpaceFrame, macBookAirM1DisplaySize } from "../desktop-space.tsx";
import { MacPopover } from "../menu.tsx";

class TestVisualViewport extends EventTarget implements VisualViewport {
  width = 720;
  height = 450;
  offsetLeft = 0;
  offsetTop = 0;
  pageLeft = 0;
  pageTop = 0;
  scale = 2;
  onresize: VisualViewport["onresize"] = null;
  onscroll: VisualViewport["onscroll"] = null;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("repositions and constrains an open popover when the visual viewport resizes and pans", async () => {
  const viewport = new TestVisualViewport();
  vi.stubGlobal("visualViewport", viewport);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function(this: HTMLElement) {
    return this.classList.contains("desktop-canvas") ? 1440 : this.classList.contains("mc-popover-surface") ? 280 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function(this: HTMLElement) {
    return this.classList.contains("desktop-canvas") ? 900 : this.classList.contains("mc-popover-surface") ? 200 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    if (this.classList.contains("desktop-canvas")) return new DOMRect(0, 0, 1440, 900);
    if (this.classList.contains("mc-popover-trigger")) return new DOMRect(400, 410, 80, 20);
    return new DOMRect();
  });
  render(<DesktopSpaceFrame displaySize={macBookAirM1DisplaySize}>
    <MacPopover isOpen label="Visible status" trigger="Status"><button>Preferences</button></MacPopover>
  </DesktopSpaceFrame>);
  const dialog = await screen.findByRole("dialog", { name: "Visible status" });
  const overlay = dialog.closest<HTMLElement>(".mc-popover-surface");
  expect(overlay).not.toBeNull();
  await waitFor(() => expect(overlay?.style.top).toBe("204px"));

  act(() => { viewport.height = 900; viewport.dispatchEvent(new Event("resize")); });
  await waitFor(() => expect(overlay?.style.top).toBe("436px"));

  act(() => {
    viewport.offsetLeft = 380;
    viewport.offsetTop = 400;
    viewport.width = 200;
    viewport.height = 450;
    viewport.dispatchEvent(new Event("scroll"));
  });
  await waitFor(() => expect(overlay?.style.left).toBe("388px"));
  expect(overlay?.style.maxWidth).toBe("184px");
  expect(overlay?.style.getPropertyValue("--mc-popover-available-width")).toBe("184px");
  expect(overlay?.style.top).toBe("436px");
});
