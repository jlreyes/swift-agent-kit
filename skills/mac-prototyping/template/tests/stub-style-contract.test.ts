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
  expect(window).toMatch(/max-height:\s*calc\(100% - 88px\)/);

  if (importedPackageStyles) {
    expect(window).toMatch(/max-width:\s*max\(50%,\s*calc\(100% - 48px\)\)/);
    const resizeHandle = rule(".mc-window-resize-handle");
    expect(resizeHandle).toMatch(/position:\s*absolute/);
    expect(resizeHandle).toMatch(/z-index:\s*19/);
  } else {
    expect(window).toMatch(/max-width:\s*calc\(100% - 24px\)/);
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

test("presentation geometry owns border-box sizing without relying on global base styles", () => {
  expect(source).toMatch(
    /\.mc-window-modal-layer,\s*\.mc-window-modal-scrim,\s*\.mc-sheet,\s*\.mc-alert,\s*\.mc-window-status-bar\s*\{[^}]*box-sizing:\s*border-box/,
  );
  const style = document.createElement("style");
  style.textContent = source;
  document.head.append(style);
  const element = (className: string) => {
    const value = document.createElement("div");
    value.className = className;
    document.body.append(value);
    return value;
  };
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
  style.remove();
  layer.remove();
  scrim.remove();
  sheet.remove();
  alert.remove();
  status.remove();
});

test("tall sheets and alerts keep actions fixed while only content regions scroll", () => {
  const sheet = rule(".mc-sheet");
  expect(sheet).toMatch(/max-height:\s*calc\(100% - 20px\)/);
  expect(sheet).toMatch(/display:\s*flex/);
  expect(rule(".mc-sheet-header")).toMatch(/flex:\s*0 0 auto/);
  expect(rule(".mc-sheet-body")).toMatch(/min-height:\s*0/);
  expect(rule(".mc-sheet-body")).toMatch(/overflow:\s*auto/);
  expect(rule(".mc-sheet-footer")).toMatch(/flex:\s*0 0 auto/);
  expect(rule(".mc-sheet-legacy")).toMatch(/display:\s*block/);
  expect(rule(".mc-sheet-legacy")).toMatch(/overflow:\s*auto/);

  const alert = rules(".mc-alert");
  expect(alert).toMatch(/max-height:\s*calc\(100% - 22px\)/);
  expect(alert).toMatch(/grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  expect(rule(".mc-alert-copy")).toMatch(/min-height:\s*0/);
  expect(rule(".mc-alert-message")).toMatch(/min-height:\s*0/);
  expect(rule(".mc-alert-message")).toMatch(/overflow:\s*auto/);
});

test("arbitrary popovers keep tall controls reachable within available viewport height", () => {
  const surface = rule(".mc-popover-surface");
  const dialog = rule(".mc-popover-dialog");

  expect(surface).toMatch(/max-height:\s*min\(var\(--available-height, calc\(100vh - 16px\)\), calc\(100vh - 16px\)\)/);
  expect(surface).toMatch(/overflow:\s*hidden/);
  expect(dialog).toMatch(/max-height:\s*inherit/);
  expect(dialog).toMatch(/overflow-y:\s*auto/);
  expect(dialog).toMatch(/overscroll-behavior:\s*contain/);
});

test("Dock thumbnails preserve tall capture proportions in their 48 by 44 slot", () => {
  const slot = rule(".p0-window-thumbnail-slot");
  const thumbnail = rule(".p0-window-thumbnail");
  const image = rule(".p0-window-thumbnail > img");

  expect(slot).toMatch(/width:\s*48px/);
  expect(slot).toMatch(/height:\s*44px/);
  expect(thumbnail).toMatch(/max-width:\s*100%/);
  expect(thumbnail).toMatch(/max-height:\s*100%/);
  expect(image).toMatch(/width:\s*100%/);
  expect(image).toMatch(/height:\s*100%/);
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
  const disabledDisclosure = importedPackageStyles
    ? rule(".mc-disclosure[data-disabled]")
    : rule(".mc-disclosure-trigger:disabled");

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
  const tooltip = rule(".p0-dock-tooltip");
  const visibleTooltip = rule('.p0-dock-tooltip[data-visible="true"]');

  expect(ownsBorderBox(".p0-mac-dock")).toBe(true);
  expect(dockShell).toMatch(/width:\s*max-content/);
  expect(dockShell).toMatch(/max-width:\s*calc\(100% - 14px\)/);
  expect(dockShell).toMatch(/overflow:\s*visible/);
  expect(dockShell).not.toMatch(/overflow-x:\s*auto/);
  expect(ownsBorderBox(".p0-dock-scroll")).toBe(true);
  expect(dockScroll).toMatch(/width:\s*max-content/);
  expect(dockScroll).toMatch(/max-width:\s*100%/);
  expect(dockScroll).toMatch(/height:\s*calc\(100% \+ 38px\)/);
  expect(dockScroll).toMatch(/margin-top:\s*-32px/);
  expect(dockScroll).toMatch(/padding:\s*32px (?:0|24px) 6px/);
  expect(dockScroll).toMatch(/overflow-x:\s*auto/);
  expect(dockScroll).toMatch(/overflow-y:\s*hidden/);
  expect(rule(".p0-dock-scroll::-webkit-scrollbar")).toMatch(/display:\s*none/);
  expect(tooltip).toMatch(/bottom:\s*calc\(100% \+ 2px\)/);
  expect(tooltip).toMatch(/max-width:\s*calc\(100vw - 16px\)/);
  expect(tooltip).toMatch(/visibility:\s*hidden/);
  expect(tooltip).toMatch(/text-overflow:\s*ellipsis/);
  expect(visibleTooltip).toMatch(/visibility:\s*visible/);
  expect(source).not.toMatch(/\.p0-dock-item:hover \.p0-dock-tooltip/);
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

  expect(popover).toMatch(/min-width:\s*min\(224px, calc\(100vw - 16px\)\)/);
  expect(popover).not.toMatch(/min-width:\s*224px/);
  expect(popover).toMatch(/max-width:\s*min\(340px, calc\(100vw - 16px\)\)/);
  expect(popover).not.toMatch(/max-width:\s*340px/);
});

test("short viewports keep the desktop canvas on the dynamic viewport height", () => {
  const viewport = rules(".showcase-viewport");
  const canvas = rules(".desktop-canvas");

  expect(source).toMatch(/@media\s*\(max-height:\s*749px\)/);
  expect(viewport).toMatch(/min-height:\s*0/);
  expect(canvas).toMatch(/height:\s*100dvh/);
  expect(canvas).not.toMatch(/height:\s*100vh/);
});
