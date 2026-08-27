// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", "presentation.css"), "utf8")
  .replace(/@import\s+[^;]+;/g, "");

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

function element(className: string) {
  const value = document.createElement("div");
  value.className = className;
  document.body.append(value);
  return value;
}

describe("standalone presentation box model", () => {
  it("owns border-box sizing for inset, bounded, and fixed-height primitives without base.css", () => {
    const style = document.createElement("style");
    style.textContent = source;
    document.head.append(style);

    const layer = element("mc-window-modal-layer mc-window-modal-layer-alert");
    const scrim = element("mc-window-modal-scrim");
    const sheet = element("mc-sheet");
    const alert = element("mc-alert");
    const status = element("mc-window-status-bar");

    for (const primitive of [layer, scrim, sheet, alert, status]) {
      expect(getComputedStyle(primitive).boxSizing).toBe("border-box");
    }
    expect(getComputedStyle(layer).paddingBottom).toBe("22px");
    expect(getComputedStyle(sheet).maxHeight).toBe("calc(100% - 20px)");
    expect(getComputedStyle(alert).maxHeight).toBe("calc(100% - 22px)");
    expect(getComputedStyle(status).minHeight).toBe("23px");
  });
});
