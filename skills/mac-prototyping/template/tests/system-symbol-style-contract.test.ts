import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";

const localCssImportPattern = String.raw`@import\s+(?:url\(\s*)?["'](\.{1,2}\/[^"']+)["']\s*\)?(?:\s+[^;]+)?\s*;`;

function readCssImportClosure(entryPath: string, visited = new Set<string>()): string {
  const absolutePath = resolve(entryPath);
  if (visited.has(absolutePath)) return "";
  visited.add(absolutePath);

  const css = readFileSync(absolutePath, "utf8");
  return css.replace(new RegExp(localCssImportPattern, "g"), (_importRule, importedPath: string) =>
    readCssImportClosure(resolve(dirname(absolutePath), importedPath), visited),
  );
}

function expectSymbolSize(css: string, selector: string, size: string): void {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(css).toMatch(new RegExp(`${escapedSelector}\\s*\\{[^}]*font-size:\\s*${size}px`, "s"));
}

it("keeps effective mac-chrome symbol roles aligned with the package contract", () => {
  const css = readCssImportClosure("lib/mac-chrome/styles/index.css");
  const roles = [
    [".mc-toolbar-button > .mc-system-symbol", "14"],
    [".mc-content-unavailable-icon .mc-system-symbol", "42"],
    [".mc-chooser-choice > .mc-system-symbol", "27"],
    [".mc-chat-send .mc-system-symbol", "13"],
    [".p0-app-icon-glyph--system-symbol > .mc-system-symbol", "20"],
    [".mc-quicklook-panel > header button .mc-system-symbol", "10"],
    [".mc-menu-popover .mc-menu-icon > .mc-system-symbol", "15"],
    [".mc-sidebar-item-icon .mc-system-symbol", "16"],
    [".mc-setup-progress .mc-system-symbol", "15"],
    [".mc-list-row-icon .mc-system-symbol", "18"],
    [".mc-alert-icon .mc-system-symbol", "42"],
    [".mc-segmented-icon .mc-system-symbol", "15"],
  ] as const;

  for (const [selector, size] of roles) expectSymbolSize(css, selector, size);
  expect(css).not.toContain(":is(svg, .mc-system-symbol)");
});

it("keeps showcase symbol roles aligned with their SVG-capable slots", () => {
  const css = readFileSync("app/showcase/showcase.css", "utf8");
  const roles = [
    [".showcase-library-items .mc-system-symbol", "38"],
    [".showcase-library-items.is-list .mc-system-symbol", "21"],
    [".showcase-navigation-detail > .mc-system-symbol", "48"],
    [".showcase-control-row .mc-system-symbol", "15"],
    [".showcase-recipe-summary > .mc-system-symbol", "44"],
    [".showcase-component-inspector > header .mc-system-symbol", "15"],
    [".showcase-preview-card > .mc-system-symbol", "54"],
  ] as const;

  for (const [selector, size] of roles) expectSymbolSize(css, selector, size);
  expect(css).not.toContain(":is(svg, .mc-system-symbol)");
});
