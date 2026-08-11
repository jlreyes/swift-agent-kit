// Build-gate for the RSC boundary: a package component that calls React hooks
// but lacks the "use client" directive only fails at consumer build time (or
// silently, as a server-render crash). This grep guard fails the unit tier
// instead. Scope: every top-level .ts/.tsx source in the package.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/* Any hook-shaped call: useState(, useEffect(, useWindowDrag(, ... */
const hookCall = /\buse[A-Z][A-Za-z]*\s*\(/;

/* "use client" must be the first statement (comments/whitespace may precede). */
const directive = /^(?:﻿)?\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*(?:"use client"|'use client');/;

it('every source file that calls a React hook starts with "use client"', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
    const source = readFileSync(join(packageRoot, entry.name), "utf8");
    if (!hookCall.test(source)) continue;
    checked += 1;
    if (!directive.test(source)) offenders.push(entry.name);
  }
  // Sanity: the scan actually saw the hook-using components.
  expect(checked).toBeGreaterThanOrEqual(5);
  expect(offenders).toEqual([]);
});
