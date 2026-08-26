import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

function styleSource(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", `${name}.css`), "utf8");
}

it("lets the shared mac-window class own absolute desktop placement", () => {
  for (const [style, rootClass] of [
    ["finder", "mc-finder-window"],
    ["chooser", "mc-chooser-window"],
    ["setup-assistant", "mc-setup-window"],
    ["chat", "mc-chat-window"],
  ] as const) {
    const source = styleSource(style);
    const rootRule = source.match(new RegExp(`\\.${rootClass}\\s*\\{[^}]*\\}`, "s"))?.[0];
    expect(rootRule, `${rootClass} root rule`).toBeDefined();
    expect(rootRule).not.toMatch(/position:\s*relative/);
  }
});

it("keeps Setup Assistant traffic lights above the draggable progress rail", () => {
  const source = styleSource("setup-assistant");
  const titlebarRule = source.match(/\.mc-setup-titlebar\s*\{[^}]*\}/s)?.[0];
  const progressRule = source.match(/\.mc-setup-progress\s*\{[^}]*\}/s)?.[0];
  expect(titlebarRule).toMatch(/z-index:\s*13/);
  expect(progressRule).toMatch(/z-index:\s*12/);
});
