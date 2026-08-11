// Verifies the curated brand catalog against the INSTALLED simple-icons — the
// package removes brands at majors (slack and salesforce are already gone), so
// this is the gate that turns a silent missing icon into a red test.
import { expect, test } from "vitest";

import { getBrandIcon } from "../components/BrandIcon.tsx";
import { brands } from "../components/brands.ts";

test("every curated brand slug resolves in the installed simple-icons", () => {
  const missing: string[] = [];
  for (const slug of Object.keys(brands)) {
    const icon = getBrandIcon(slug);
    if (!icon || !/^[Mm]/.test(icon.path)) missing.push(slug);
  }
  expect(missing).toEqual([]);
});

test("unknown slugs resolve to undefined (BrandIcon renders nothing + dev-warns)", () => {
  expect(getBrandIcon("slack")).toBeUndefined();
  expect(getBrandIcon("salesforce")).toBeUndefined();
});
