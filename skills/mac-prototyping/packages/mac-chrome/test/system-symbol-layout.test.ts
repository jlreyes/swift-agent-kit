import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const stylesRoot = join(packageRoot, "styles");

function source(path: string): string {
  return readFileSync(path, "utf8");
}

it("keeps SystemSymbol on intrinsic first-render font metrics", () => {
  const component = source(join(packageRoot, "system-symbol.tsx"));
  const base = source(join(stylesRoot, "base.css"));
  const symbolRule = base.match(/(?:^|\n)\.mc-system-symbol\s*\{[^}]*\}/s)?.[0] ?? "";

  expect(component).not.toMatch(/useLayoutEffect|ResizeObserver|createRange|getBoundingClientRect/);
  expect(component).not.toContain("mc-system-symbol-glyph");
  expect(component).not.toContain("--mc-symbol-fit");
  expect(symbolRule).toMatch(/display:\s*inline-block/);
  expect(symbolRule).not.toMatch(/(?:^|[;{])\s*(?:width|height|transform):/);
});

it("sizes SVG artwork and variable-width font symbols independently", () => {
  const offenders: string[] = [];
  for (const entry of readdirSync(stylesRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    if (source(join(stylesRoot, entry.name)).includes(":is(svg, .mc-system-symbol)")) {
      offenders.push(entry.name);
    }
  }

  expect(offenders).toEqual([]);
});

it("gives generated Dock artwork a stable slot before centering intrinsic symbols", () => {
  const dock = source(join(stylesRoot, "dock.css"));

  expect(dock).toMatch(/\.p0-app-icon-glyph\s*\{[^}]*width:\s*34px;[^}]*height:\s*30px;/s);
  expect(dock).toMatch(/\.p0-app-icon-glyph > svg\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;/s);
  expect(dock).toMatch(/\.p0-app-icon-glyph > \.mc-system-symbol\s*\{[^}]*font-size:\s*20px;/s);
});
