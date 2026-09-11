import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("ships the same split-pane patch through direct and vendored installs", () => {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const templateRoot = join(packageRoot, "../../template");
  const patchName = "react-resizable-panels@4.12.2.patch";
  const read = (relative: string, root: string) => readFileSync(join(root, relative), "utf8");
  expect(read(`lib/mac-chrome/patches/${patchName}`, templateRoot)).toBe(read(`patches/${patchName}`, packageRoot));
  expect(read("pnpm-workspace.yaml", packageRoot)).toContain(`react-resizable-panels@4.12.2: patches/${patchName}`);
  expect(read("pnpm-workspace.yaml", templateRoot)).toContain(`react-resizable-panels@4.12.2: lib/mac-chrome/patches/${patchName}`);
});
