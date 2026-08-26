import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

function styleSource(name: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", `${name}.css`), "utf8");
}

function rule(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = source.match(new RegExp(escaped + "\\s*\\{[^}]*\\}", "s"));
  expect(match, selector + " rule").not.toBeNull();
  return match?.[0] ?? "";
}

it("contains minimized window art without distorting tall captures", () => {
  const dock = styleSource("dock");
  const thumbnail = rule(dock, ".p0-window-thumbnail");
  const image = rule(dock, ".p0-window-thumbnail > img");

  expect(thumbnail).toMatch(/width:\s*48px/);
  expect(thumbnail).toMatch(/height:\s*44px/);
  expect(image).toMatch(/width:\s*auto/);
  expect(image).toMatch(/height:\s*auto/);
  expect(image).toMatch(/max-width:\s*100%/);
  expect(image).toMatch(/max-height:\s*100%/);
  expect(image).toMatch(/object-fit:\s*contain/);
});

it("lets long list secondary values shrink and truncate inside their row", () => {
  const collections = styleSource("collections");
  const row = rule(collections, ".mc-list-row");
  const secondary = rule(collections, ".mc-list-row-secondary");

  expect(row).toMatch(/min-width:\s*0/);
  expect(secondary).toMatch(/min-width:\s*0/);
  expect(secondary).toMatch(/max-width:\s*50%/);
  expect(secondary).toMatch(/overflow:\s*hidden/);
  expect(secondary).toMatch(/text-overflow:\s*ellipsis/);
  expect(secondary).toMatch(/white-space:\s*nowrap/);
});

it("styles selected source-list headers and every separator focus signal", () => {
  const navigation = styleSource("navigation");
  const selectedHeader = rule(navigation, ".mc-sidebar-section-header.mc-selected");
  const selectedLabel = rule(navigation, ".mc-sidebar-section-header.mc-selected .mc-sidebar-section-label");
  const focusedSeparators = rule(
    navigation,
    '.mc-navigation-separator[data-separator="focus"],\n.mc-navigation-separator:focus-visible,\n.mc-inspector-separator:focus-visible',
  );

  expect(selectedHeader).toMatch(/background:\s*var\(--accent-tint\)/);
  expect(selectedHeader).toMatch(/color:\s*var\(--text-strong\)/);
  expect(selectedLabel).toMatch(/color:\s*var\(--text-strong\)/);
  expect(focusedSeparators).toMatch(/background:\s*var\(--accent\)/);
  expect(focusedSeparators).toMatch(/box-shadow:\s*0 0 0 1px var\(--focus-ring\)/);
  expect(styleSource("finder")).toContain('.mc-preview-resize-handle[data-separator="focus"]::after');
});

it("keeps standalone text fields border-box sized", () => {
  const controls = styleSource("controls");

  expect(rule(controls, ".mc-text-field")).toMatch(/box-sizing:\s*border-box/);
  expect(rule(controls, ".mc-field-input")).toMatch(/box-sizing:\s*border-box/);
});
