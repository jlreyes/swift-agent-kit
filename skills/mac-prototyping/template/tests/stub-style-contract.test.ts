import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const localImportPattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g;

function publicStyleClosure(path: string, visited = new Set<string>()): string {
  const absolutePath = resolve(path);
  if (visited.has(absolutePath)) return "";
  visited.add(absolutePath);
  const entry = readFileSync(absolutePath, "utf8");
  return entry.replace(localImportPattern, (statement, specifier: string) =>
    specifier.startsWith(".")
      ? publicStyleClosure(resolve(dirname(absolutePath), specifier), visited)
      : statement);
}

const publicStyleEntry = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "lib",
  "mac-chrome",
  "styles",
  "index.css",
);
const publicStyleIndex = readFileSync(publicStyleEntry, "utf8");
const importedPackageStyles = /@import\s+(?:url\(\s*)?["']\.[^"']+["']/.test(publicStyleIndex);
const source = publicStyleClosure(publicStyleEntry);

function rule(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = source.match(new RegExp(escaped + "\\s*\\{[^}]*\\}", "s"));
  expect(match, selector + " rule").not.toBeNull();
  return match?.[0] ?? "";
}

function rules(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  return Array.from(source.matchAll(new RegExp(escaped + "\\s*\\{[^}]*\\}", "gs")), (match) => match[0]).join("\n");
}

function ownsBorderBox(selector: string): boolean {
  return /box-sizing:\s*border-box/.test(`${rules("*")}\n${rules(selector)}`);
}

test("windows cap inside the desktop and retain their implementation's geometry substrate", () => {
  const window = rule(".mac-window");

  expect(ownsBorderBox(".mac-window")).toBe(true);
  expect(window).toMatch(/max-width:\s*calc\(100% - 24px\)/);
  expect(window).toMatch(/max-height:\s*calc\(100% - 88px\)/);

  if (importedPackageStyles) {
    const resizeHandle = rule(".mc-window-resize-handle");
    expect(resizeHandle).toMatch(/position:\s*absolute/);
    expect(resizeHandle).toMatch(/z-index:\s*19/);
  } else {
    const centeredWindow = rule('.mac-window[style*="left: calc(50%"]');
    expect(source).toContain('.mac-window[style*="left:calc(50%"]');
    expect(centeredWindow).toMatch(/right:\s*12px/);
    expect(centeredWindow).toMatch(/left:\s*12px !important/);
    expect(centeredWindow).toMatch(/margin-inline:\s*auto/);
  }
});

test("stub alerts include their padding in the constrained inline size", () => {
  const alert = rules(".mc-alert");

  expect(ownsBorderBox(".mc-alert")).toBe(true);
  expect(alert).toMatch(/width:\s*min\(390px, calc\(100% - 24px\)\)/);
});

test("Dock thumbnails preserve tall capture proportions in their 48 by 44 slot", () => {
  const thumbnail = rule(".p0-window-thumbnail");
  const image = rule(".p0-window-thumbnail > img");

  if (importedPackageStyles) {
    const slot = rule(".p0-window-thumbnail-slot");
    expect(slot).toMatch(/width:\s*48px/);
    expect(slot).toMatch(/height:\s*44px/);
    expect(thumbnail).toMatch(/max-width:\s*100%/);
    expect(thumbnail).toMatch(/max-height:\s*100%/);
    expect(image).toMatch(/width:\s*100%/);
    expect(image).toMatch(/height:\s*100%/);
  } else {
    expect(thumbnail).toMatch(/width:\s*48px/);
    expect(thumbnail).toMatch(/height:\s*44px/);
    expect(image).toMatch(/width:\s*auto/);
    expect(image).toMatch(/height:\s*auto/);
    expect(image).toMatch(/max-width:\s*100%/);
    expect(image).toMatch(/max-height:\s*100%/);
  }
  expect(image).toMatch(/object-fit:\s*contain/);
});

test("status, native collection states, and disclosure affordances survive either distribution", () => {
  const primaryStatus = rule(".mc-window-status-primary");
  const trailingStatus = rules(".mc-window-status-trailing");
  const selectedRow = rule('.mc-list-row[aria-selected="true"]');
  const hoveredRow = rule(".mc-list-row:not([data-disabled]):not(:disabled):hover");
  const disabledRow = rule(".mc-list-row:disabled");
  const focusedRow = rule(".mc-list-row:focus-visible");
  const chevron = rule(".mc-disclosure-chevron::before");
  const expandedChevron = rule(".mc-disclosure[data-expanded] .mc-disclosure-chevron::before");
  const disabledDisclosure = rule(".mc-disclosure-trigger:disabled");

  expect(primaryStatus).toMatch(/flex:\s*1 1 auto/);
  expect(trailingStatus).toMatch(/max-width:\s*50%/);
  expect(trailingStatus).toMatch(/flex:\s*0 1 auto/);
  expect(trailingStatus).toMatch(/text-overflow:\s*ellipsis/);
  expect(selectedRow).toMatch(/background:/);
  expect(hoveredRow).toMatch(/background:/);
  expect(disabledRow).toMatch(/opacity:\s*0\.42/);
  expect(focusedRow).toMatch(/outline:\s*none/);
  expect(focusedRow).toMatch(/box-shadow:\s*inset 0 0 0 1px/);
  expect(chevron).toMatch(/content:\s*""/);
  expect(chevron).toMatch(/transform:\s*rotate\(-45deg\)/);
  expect(expandedChevron).toMatch(/transform:\s*rotate\(45deg\)/);
  expect(disabledDisclosure).toMatch(/opacity:\s*0\.45/);
});

test("the Dock keeps its shell visible while its inner strip scrolls", () => {
  const dockShell = rule(".p0-mac-dock");
  const dockScroll = rule(".p0-dock-scroll");

  expect(ownsBorderBox(".p0-mac-dock")).toBe(true);
  expect(dockShell).toMatch(/width:\s*max-content/);
  expect(dockShell).toMatch(/max-width:\s*calc\(100% - 14px\)/);
  expect(dockShell).toMatch(/overflow:\s*visible/);
  expect(dockShell).not.toMatch(/overflow-x:\s*auto/);
  expect(dockScroll).toMatch(/width:\s*max-content/);
  expect(dockScroll).toMatch(/max-width:\s*100%/);
  expect(dockScroll).toMatch(/height:\s*calc\(100% \+ 38px\)/);
  expect(dockScroll).toMatch(/margin-top:\s*-32px/);
  expect(dockScroll).toMatch(/padding:\s*32px (?:0|24px) 6px/);
  expect(dockScroll).toMatch(/overflow-x:\s*auto/);
  expect(dockScroll).toMatch(/overflow-y:\s*hidden/);
  expect(rule(".p0-dock-scroll::-webkit-scrollbar")).toMatch(/display:\s*none/);
});

test("the Dock material resolves through defined semantic tokens", () => {
  const rootTokens = rules(":root");
  const dockShell = rule(".p0-mac-dock");

  expect(rootTokens).toMatch(/--dock-glass:\s*#e1e5ea/);
  expect(rootTokens).toMatch(/--capsule-border:\s*rgba\(0, 0, 0, 0\.11\)/);
  expect(dockShell).toMatch(/background:\s*var\(--dock-glass\)/);
  expect(dockShell).toMatch(/inset 0 0 0 0\.5px var\(--capsule-border\)/);
});

test("source lists own scrolling within their clipped navigation sidebar", () => {
  const column = rule(".mc-navigation-column");
  const sidebar = rule(".mc-navigation-sidebar");
  const tree = rule(".mc-sidebar-tree");

  expect(column).toMatch(/min-height:\s*0/);
  expect(column).toMatch(/overflow:\s*hidden/);
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

test("menu-bar popovers preserve their native cap without exceeding the viewport", () => {
  const popover = rule(".mc-menu-popover.mc-menubar-menu-popover");

  expect(popover).toMatch(/max-width:\s*min\(340px, calc\(100vw - 16px\)\)/);
  expect(popover).not.toMatch(/max-width:\s*340px/);
});
