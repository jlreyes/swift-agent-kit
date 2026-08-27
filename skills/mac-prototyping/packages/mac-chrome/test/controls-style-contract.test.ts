import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

function controlsSource(): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", "controls.css"), "utf8");
}

function rule(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = source.match(new RegExp(escaped + "\\s*\\{[^}]*\\}", "s"));
  expect(match, selector + " rule").not.toBeNull();
  return match?.[0] ?? "";
}

it("owns border-box geometry when controls.css is imported standalone", () => {
  const source = controlsSource();
  const fixedGeometry = rule(source, [
    ".mc-button",
    ".mc-field-input",
    ".mc-checkbox-box",
    ".mc-checkbox-check",
    ".mc-switch-track",
    ".mc-switch-thumb",
    ".mc-segmented-control",
    ".mc-control-group",
    ".mc-segmented-option",
    ".mc-segmented-icon",
    ".mc-labeled-content",
  ].join(",\n"));

  expect(fixedGeometry).toMatch(/box-sizing:\s*border-box/);
});

it("visually disables controls inherited through a native fieldset", () => {
  const source = controlsSource();
  const button = rule(source, ".mc-button[data-disabled],\n.mc-button:disabled");
  const field = rule(source, ".mc-text-field[data-disabled],\n.mc-form-section:disabled .mc-text-field");
  const toggle = rule(source, ".mc-toggle[data-disabled],\n.mc-form-section:disabled .mc-toggle");
  const segmented = rule(source, ".mc-segmented-option[data-disabled],\n.mc-segmented-control[data-disabled],\n.mc-form-section:disabled .mc-segmented-control");
  const cursor = rule(source, ".mc-form-section:disabled .mc-button,\n.mc-form-section:disabled .mc-toggle,\n.mc-form-section:disabled .mc-segmented-option,\n.mc-form-section:disabled .mc-field-input");

  for (const disabledRule of [button, field, toggle, segmented]) {
    expect(disabledRule).toMatch(/opacity:\s*0\.[0-9]+/);
  }
  expect(cursor).toMatch(/cursor:\s*default/);
});
