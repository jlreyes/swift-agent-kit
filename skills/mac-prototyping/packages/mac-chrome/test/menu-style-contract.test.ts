import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

function styleSource(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", name + ".css"), "utf8");
}

function rule(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = source.match(new RegExp(escaped + "\\s*\\{[^}]*\\}", "s"));
  expect(match, selector + " rule").not.toBeNull();
  return match?.[0] ?? "";
}

it("keeps command menus on the shared native geometry and type tokens", () => {
  const popover = styleSource("popover");
  const tokens = styleSource("tokens");
  const surface = rule(popover, ".mc-menu-popover");
  const row = rule(popover, ".mc-menu-popover .mc-menu-item");
  const label = rule(popover, ".mc-menu-popover .mc-menu-label");
  const secondary = rule(popover, ".mc-menu-popover small");
  const shortcut = rule(popover, ".mc-menu-shortcut");

  expect(tokens).toMatch(/--font-system:\s*-apple-system, BlinkMacSystemFont/);
  expect(tokens).toMatch(/--font-size-menu:\s*13px/);
  expect(tokens).toMatch(/--line-height-menu:\s*16px/);
  expect(tokens).toMatch(/--radius-menu-item:\s*6px/);
  expect(tokens).toMatch(/--radius-menu-popover:\s*10px/);
  expect(surface).toMatch(/padding:\s*4px 6px/);
  expect(row).toMatch(/grid-template-columns:\s*18px minmax\(0, 1fr\) auto/);
  expect(row).toMatch(/gap:\s*8px/);
  expect(row).toMatch(/min-height:\s*24px/);
  expect(row).toMatch(/padding:\s*4px 8px/);
  expect(row).toMatch(/border-radius:\s*var\(--radius-menu-item\)/);
  expect(label).toMatch(/font-size:\s*var\(--font-size-menu\)/);
  expect(label).toMatch(/font-weight:\s*var\(--font-weight-regular\)/);
  expect(shortcut).toMatch(/font-size:\s*var\(--font-size-menu\)/);
  expect(shortcut).toMatch(/line-height:\s*var\(--line-height-menu\)/);
  expect(secondary).toMatch(/font-size:\s*var\(--font-size-secondary\)/);
});

it("keeps arbitrary content popovers on an explicit inset and layout contract", () => {
  const popover = styleSource("popover");
  const tokens = styleSource("tokens");
  const dialog = rule(popover, ".mc-popover-dialog");
  const compact = rule(popover, '.mc-popover-dialog[data-content-inset="compact"]');
  const flush = rule(popover, '.mc-popover-dialog[data-content-inset="flush"]');

  expect(tokens).toMatch(/--radius-popover:\s*12px/);
  expect(dialog).toMatch(/padding:\s*14px/);
  expect(compact).toMatch(/padding:\s*10px/);
  expect(flush).toMatch(/padding:\s*0/);
  expect(popover).toContain('.mc-popover-surface[data-popover-layout="status"]');
});

it("uses the same 13px system type contract for the 24px menu bar", () => {
  const base = styleSource("base");
  const menuBar = rule(base, ".mac-menu-bar");
  const appName = rule(base, ".mc-app-menu .mc-menubar-menu-title");

  expect(menuBar).toMatch(/height:\s*24px/);
  expect(menuBar).toMatch(/font-family:\s*var\(--font-mac\)/);
  expect(menuBar).toMatch(/font-size:\s*var\(--font-size-menu\)/);
  expect(menuBar).toMatch(/line-height:\s*var\(--line-height-menu\)/);
  expect(appName).toMatch(/font-weight:\s*var\(--font-weight-semibold\)/);
});
