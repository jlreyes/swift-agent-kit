import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

function styleSource(name: "controls" | "toolbar"): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "styles", `${name}.css`), "utf8");
}

function rule(source: string, selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const match = source.match(new RegExp(escaped + "\\s*\\{[^}]*\\}", "s"));
  expect(match, selector + " rule").not.toBeNull();
  return match?.[0] ?? "";
}

it("keeps only the true endpoints of a divided toolbar capsule rounded", () => {
  const toolbar = styleSource("toolbar");
  const everyButton = rule(toolbar, ".mc-capsule[data-divided] > .mc-toolbar-button");
  const firstButton = rule(toolbar, ".mc-capsule[data-divided] > .mc-toolbar-button:first-child");
  const lastButton = rule(toolbar, ".mc-capsule[data-divided] > .mc-toolbar-button:last-child");

  expect(everyButton).toMatch(/border-radius:\s*0/);
  expect(firstButton).toMatch(/border-top-left-radius:\s*inherit/);
  expect(firstButton).toMatch(/border-bottom-left-radius:\s*inherit/);
  expect(lastButton).toMatch(/border-top-right-radius:\s*inherit/);
  expect(lastButton).toMatch(/border-bottom-right-radius:\s*inherit/);
  expect(toolbar).not.toMatch(/\.mc-capsule\[data-divided\] > \.mc-toolbar-button:not\(:last-child\)/);
});

it("keeps grouped-control focus rings visible while children preserve joined geometry", () => {
  const controls = styleSource("controls");
  const groupedSurface = rule(controls, ".mc-segmented-control,\n.mc-control-group");
  const segmentedFirst = rule(controls, ".mc-segmented-option:first-child");
  const segmentedLast = rule(controls, ".mc-segmented-option:last-child");
  const groupFirst = rule(controls, ".mc-control-group > :first-child");
  const groupLast = rule(controls, ".mc-control-group > :last-child");
  const focused = rule(controls, ".mc-segmented-option[data-focus-visible],\n.mc-control-group > [data-focus-visible],\n.mc-control-group > :focus-visible");

  expect(groupedSurface).toMatch(/overflow:\s*visible/);
  for (const start of [segmentedFirst, groupFirst]) {
    expect(start).toMatch(/border-top-left-radius:\s*inherit/);
    expect(start).toMatch(/border-bottom-left-radius:\s*inherit/);
  }
  for (const end of [segmentedLast, groupLast]) {
    expect(end).toMatch(/border-top-right-radius:\s*inherit/);
    expect(end).toMatch(/border-bottom-right-radius:\s*inherit/);
  }
  expect(focused).toMatch(/z-index:\s*1/);
});
