import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const exampleSource = readFileSync(
  "app/example/example-desktop.tsx",
  "utf8",
);

test("the example shell boots from the same immutable app definition it registers", () => {
  expect(exampleSource).toContain("satisfies MacAppDefinition");
  expect(exampleSource).toContain("<MacWindowManager initialApps={exampleAppManifest}>");
  expect(exampleSource).toContain("<MacApp {...exampleApp}>");
  expect(exampleSource.match(/id: \"finder\"/g)).toHaveLength(1);
});
