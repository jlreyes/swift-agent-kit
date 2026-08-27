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

it("scrolls narrow Docks without clipping vertical item affordances", () => {
  const dock = styleSource("dock");
  const shell = rule(dock, ".p0-mac-dock");
  const scroller = rule(dock, ".p0-dock-scroll");

  expect(shell).toMatch(/max-width:\s*calc\(100% - 14px\)/);
  expect(shell).toMatch(/overflow:\s*visible/);
  expect(scroller).toMatch(/overflow-x:\s*auto/);
  expect(scroller).toMatch(/overflow-y:\s*hidden/);
  expect(scroller).toMatch(/margin-top:\s*-32px/);
  expect(scroller).toMatch(/padding:\s*32px 24px 6px/);
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

it("keeps long source lists reachable inside the clipped navigation sidebar", () => {
  const navigation = styleSource("navigation");
  const sidebar = rule(navigation, ".mc-navigation-sidebar");
  const tree = rule(navigation, ".mc-sidebar-tree");

  expect(sidebar).toMatch(/display:\s*flex/);
  expect(sidebar).toMatch(/min-height:\s*0/);
  expect(sidebar).toMatch(/overflow:\s*hidden/);
  expect(tree).toMatch(/width:\s*100%/);
  expect(tree).toMatch(/min-height:\s*0/);
  expect(tree).toMatch(/flex:\s*1 1 auto/);
  expect(tree).toMatch(/overflow-x:\s*hidden/);
  expect(tree).toMatch(/overflow-y:\s*auto/);
  expect(tree).not.toMatch(/min-height:\s*100%/);
});

it("keeps standalone text fields border-box sized", () => {
  const controls = styleSource("controls");
  const field = rule(controls, ".mc-text-field");

  expect(field).toMatch(/box-sizing:\s*border-box/);
  expect(field).toMatch(/width:\s*180px/);
  expect(field).toMatch(/min-width:\s*0/);
  expect(field).toMatch(/max-width:\s*100%/);
  expect(rule(controls, ".mc-field-input")).toMatch(/box-sizing:\s*border-box/);
});

it("lets joined controls contract inside narrow parents without clipping focus rings", () => {
  const controls = styleSource("controls");
  const groups = rule(controls, ".mc-segmented-control,\n.mc-control-group");
  const segment = rule(controls, ".mc-segmented-option");
  const segmentLabel = rule(controls, ".mc-segmented-option > span:last-child");
  const groupedChild = rule(controls, ".mc-control-group > *");

  expect(groups).toMatch(/width:\s*max-content/);
  expect(groups).toMatch(/max-width:\s*100%/);
  expect(groups).toMatch(/overflow:\s*visible/);
  expect(segment).toMatch(/min-width:\s*0/);
  expect(segment).toMatch(/flex:\s*1 1 auto/);
  expect(segmentLabel).toMatch(/text-overflow:\s*ellipsis/);
  expect(groupedChild).toMatch(/min-width:\s*0/);
  expect(groupedChild).toMatch(/flex:\s*0 1 auto/);
});

it("keeps both menu-bar command groups reachable on narrow viewports", () => {
  const base = styleSource("base");
  const groups = rule(base, ".menu-left,\n  .menu-right");
  const left = rules(base, ".menu-left");
  const right = rules(base, ".menu-right");

  expect(base).toMatch(/@media\s*\(max-width:\s*600px\)/);
  expect(groups).toMatch(/min-width:\s*0/);
  expect(groups).toMatch(/overflow-x:\s*auto/);
  expect(left).toMatch(/flex:\s*1 1 58%/);
  expect(right).toMatch(/overflow-x:\s*auto/);
  expect(right).toMatch(/max-width:\s*42%/);
  expect(right).toMatch(/flex:\s*0 1 42%/);
  expect(rule(base, ".menu-left .mc-menubar-menu,\n  .menu-right > *")).toMatch(/flex:\s*0 0 auto/);
});

it("gives the Setup Assistant hero symbol an explicit optical size", () => {
  const setup = styleSource("setup-assistant");
  const hero = rule(setup, ".mc-setup-hero-symbol");

  expect(hero).toMatch(/width:\s*38px/);
  expect(hero).toMatch(/height:\s*38px/);
  expect(hero).toMatch(/font-size:\s*38px/);
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
  const hover = rule(collections, ".mc-list-row:not([data-disabled]):not(:disabled):hover");
  const nativeFocus = rule(collections, ".mc-list-row:focus-visible");
  const chevron = rule(collections, ".mc-disclosure-chevron::before");
  const expandedChevron = rule(collections, ".mc-disclosure[data-expanded] .mc-disclosure-chevron::before");
  const disabledDisclosure = rule(collections, ".mc-disclosure-trigger:disabled");

  expect(selected).toMatch(/background:\s*var\(--selection-tint\)/);
  expect(hover).toMatch(/background:\s*rgba\(0, 0, 0, 0\.035\)/);
  expect(nativeFocus).toMatch(/outline:\s*none/);
  expect(nativeFocus).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--focus-ring\)/);
  expect(disabledRow).toMatch(/opacity:\s*0\.42/);
  expect(chevron).toMatch(/content:\s*""/);
  expect(chevron).toMatch(/transform:\s*rotate\(-45deg\)/);
  expect(expandedChevron).toMatch(/transform:\s*rotate\(45deg\)/);
  expect(disabledDisclosure).toMatch(/opacity:\s*0\.45/);
});
