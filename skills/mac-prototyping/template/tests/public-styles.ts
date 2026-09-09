import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const localImportPattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/g;

export function publicStyleClosure(path: string, visited = new Set<string>()): string {
  const absolutePath = resolve(path);
  if (visited.has(absolutePath)) return "";
  visited.add(absolutePath);
  const entry = readFileSync(absolutePath, "utf8");
  return entry.replace(localImportPattern, (statement, specifier: string) =>
    specifier.startsWith(".")
      ? publicStyleClosure(resolve(dirname(absolutePath), specifier), visited)
      : statement);
}
