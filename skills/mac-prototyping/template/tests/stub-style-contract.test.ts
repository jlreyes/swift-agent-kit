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

test("stub Dock thumbnails preserve tall capture proportions", () => {
  const thumbnail = rule(".p0-window-thumbnail");
  const image = rule(".p0-window-thumbnail > img");

  expect(thumbnail).toMatch(/width:\s*48px/);
  expect(thumbnail).toMatch(/height:\s*44px/);
  expect(image).toMatch(/width:\s*auto/);
  expect(image).toMatch(/height:\s*auto/);
  expect(image).toMatch(/max-width:\s*100%/);
  expect(image).toMatch(/max-height:\s*100%/);
  expect(image).toMatch(/object-fit:\s*contain/);
});
