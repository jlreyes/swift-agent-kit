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

function rules(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  return Array.from(source.matchAll(new RegExp(escaped + "\\s*\\{[^}]*\\}", "gs")), (match) => match[0]).join("\n");
}

it("contains minimized window art without distorting tall captures", () => {
  const dock = styleSource("dock");
  const slot = rule(dock, ".p0-window-thumbnail-slot");
  const thumbnail = rule(dock, ".p0-window-thumbnail");
  const image = rule(dock, ".p0-window-thumbnail > img");

  expect(slot).toMatch(/width:\s*48px/);
  expect(slot).toMatch(/height:\s*44px/);
  expect(thumbnail).toMatch(/box-sizing:\s*border-box/);
  expect(thumbnail).toMatch(/max-width:\s*100%/);
  expect(thumbnail).toMatch(/max-height:\s*100%/);
  expect(thumbnail).not.toMatch(/width:\s*48px/);
  expect(thumbnail).not.toMatch(/height:\s*44px/);
  expect(image).toMatch(/width:\s*100%/);
  expect(image).toMatch(/height:\s*100%/);
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

it("lets status-bar trailing content shrink before it can collapse the primary status", () => {
  const presentation = styleSource("presentation");
  const primary = rule(presentation, ".mc-window-status-primary");
  const trailing = rules(presentation, ".mc-window-status-trailing");

  expect(primary).toMatch(/flex:\s*1 1 auto/);
  expect(trailing).toMatch(/max-width:\s*50%/);
  expect(trailing).toMatch(/flex:\s*0 1 auto/);
  expect(trailing).toMatch(/text-overflow:\s*ellipsis/);
});

it("supports native-button list and disclosure states used by the public stub", () => {
  const collections = styleSource("collections");
  const selected = rule(collections, '.mc-list-row[aria-selected="true"]');
  const disabledRow = rule(collections, ".mc-list-row:disabled");
  const hover = rule(collections, ".mc-list-row:not(:disabled):hover");
  const chevron = rule(collections, ".mc-disclosure-chevron::before");
  const expandedChevron = rule(collections, ".mc-disclosure[data-expanded] .mc-disclosure-chevron::before");
  const disabledDisclosure = rule(collections, ".mc-disclosure-trigger:disabled");

  expect(selected).toMatch(/background:\s*var\(--selection-tint\)/);
  expect(hover).toMatch(/background:\s*rgba\(0, 0, 0, 0\.035\)/);
  expect(disabledRow).toMatch(/opacity:\s*0\.42/);
  expect(chevron).toMatch(/content:\s*""/);
  expect(chevron).toMatch(/transform:\s*rotate\(-45deg\)/);
  expect(expandedChevron).toMatch(/transform:\s*rotate\(45deg\)/);
  expect(disabledDisclosure).toMatch(/opacity:\s*0\.45/);
});

it("makes an overflowing Dock horizontally reachable on narrow viewports", () => {
  const dock = styleSource("dock");
  const narrowDockRules = rules(dock, ".p0-mac-dock");

  expect(dock).toMatch(/@media\s*\(max-width:\s*600px\)/);
  expect(narrowDockRules).toMatch(/width:\s*calc\(100% - 12px\)/);
  expect(narrowDockRules).toMatch(/max-width:\s*calc\(100% - 12px\)/);
  expect(narrowDockRules).toMatch(/overflow-x:\s*auto/);
  expect(narrowDockRules).toMatch(/overscroll-behavior-inline:\s*contain/);
  expect(rules(dock, ".p0-dock-item-wrap")).toMatch(/flex:\s*0 0 auto/);
});
