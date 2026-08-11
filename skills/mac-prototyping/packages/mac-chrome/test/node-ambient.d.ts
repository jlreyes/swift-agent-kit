// Minimal ambient types for the Node builtins the test files use. The package
// deliberately ships without @types/node (it is a browser-target library);
// tests run under vitest on Node, where these APIs exist at runtime.

declare module "node:fs" {
  export type DirentLike = {
    readonly name: string;
    isFile(): boolean;
  };
  export function readdirSync(
    path: string,
    options: { readonly withFileTypes: true },
  ): readonly DirentLike[];
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...parts: readonly string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string): string;
}
