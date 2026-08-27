import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", "presentation.css"), "utf8");

function rule(selector: string): string | undefined {
  return source.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s"))?.[0];
}

describe("presentation anatomy", () => {
  it("keeps MacSheet compact with standard owned-region insets", () => {
    expect(rule(".mc-sheet-header")).toMatch(/padding:\s*18px 22px 7px/);
    expect(rule(".mc-sheet-body")).toMatch(/padding:\s*0 22px 18px/);
    expect(rule(".mc-sheet-footer")).toMatch(/padding:\s*11px 22px 18px/);
    expect(rule(".mc-sheet-header h2")).toMatch(/font-size:\s*15px/);
  });

  it("attaches window alerts below the titlebar and centers only the desktop fallback", () => {
    expect(rule(".mc-window-modal-layer-alert")).toMatch(/align-items:\s*flex-start/);
    expect(rule(".mc-window-modal-layer-alert")).toMatch(/padding:\s*0 22px 22px/);
    expect(rule(".mc-window-modal-layer-alert.mc-window-modal-layer-desktop")).toMatch(/align-items:\s*center/);
    expect(rule(".mc-window-modal-layer-alert.mc-window-modal-layer-desktop")).toMatch(/padding:\s*22px/);
    expect(rule(".mc-window-modal-layer-desktop")).toMatch(/z-index:\s*1000/);
  });

  it("contains tall presentations while leaving only their content regions scrollable", () => {
    expect(rule(".mc-sheet")).toMatch(/max-height:\s*calc\(100% - 20px\)/);
    expect(rule(".mc-sheet")).toMatch(/display:\s*flex/);
    expect(rule(".mc-sheet-body")).toMatch(/min-height:\s*0/);
    expect(rule(".mc-sheet-body")).toMatch(/overflow:\s*auto/);
    expect(rule(".mc-sheet-header")).toMatch(/flex:\s*0 0 auto/);
    expect(rule(".mc-sheet-footer")).toMatch(/flex:\s*0 0 auto/);
    expect(rule(".mc-sheet-legacy")).toMatch(/overflow:\s*auto/);

    expect(source).toMatch(/\.mc-alert\s*\{[^}]*max-height:\s*calc\(100% - 22px\)[^}]*\}/s);
    expect(source).toMatch(/\.mc-alert\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto[^}]*\}/s);
    expect(rule(".mc-alert-message")).toMatch(/min-height:\s*0/);
    expect(rule(".mc-alert-message")).toMatch(/overflow:\s*auto/);
  });
});
