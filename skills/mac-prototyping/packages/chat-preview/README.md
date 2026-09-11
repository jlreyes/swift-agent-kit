# Chat preview builder

`@swift-agent-kit/chat-preview` packages a React entry as one self-contained
HTML fragment for a bounded chat host. It bundles the entry, scopes CSS to one
root, embeds local assets, optionally embeds a minimal private symbol font,
and enforces the final UTF-8 byte budget before replacing the output.

The [in-chat preview recipe](../../references/chat-preview.md) shows the
canonical showcase command and the host checks. Use HMR for normal prototype
development; this package is for an explicitly requested portable snapshot.

## Install

```sh
pnpm install --frozen-lockfile
```

The package pins esbuild, PostCSS, css-tree, Acorn, and Terser. It installs
nothing at build time. The selected prototype must separately have its runtime
dependencies installed; pass that project through `dependencies`.

## Build from JavaScript

```js
import { buildPreview } from '@swift-agent-kit/chat-preview';

await buildPreview({
  entry: '/private/path/showcase.tsx',
  output: '/private/path/showcase.html',
  dependencies: '/private/path/prototype',
  macChromeDirectory: '/private/path/mac-chrome',
  fontPath: '/private/path/SF-Pro-Text-Regular.otf',
  component: true,
});
```

`entry` and `output` are required. `component: true` mounts the entry module's
default export; otherwise the entry is bundled directly. Defaults are
`root: "mac-chat-preview"`, `format: "gzip"`, `windowOnly: true`,
`localSymbols: false`, `python: "python3"`, and `maxBytes: 1_000_000`.
`assetRoot` permits root-relative CSS assets; `toolchain` optionally names a
different location for the pinned build tools.

When the entry uses `SystemSymbol`, provide `fontPath` to embed a private
minimal subset, or explicitly choose `localSymbols: true` for a local-only
preview. The private-font path requires an output directory outside every Git
repository. The supplied Python must already have fontTools and Brotli; no
font tooling is downloaded automatically.

## Symbol reachability

The builder includes recognized static and finite reachable symbol strings.
For an unbounded expression, supply every possible name through
`additionalSymbols`, for example `additionalSymbols: ["folder", "gearshape"]`.
An undeclared dynamic name fails at build time or, if it reaches the packaged
lookup, at runtime. This prevents a small preview from silently carrying a
full symbol dictionary.

## CLI

`cli.mjs` accepts `--entry`, `--output`, `--component`,
`--mac-chrome-directory`, `--dependencies`, `--toolchain`, `--asset-root`,
`--font`, `--python`, `--additional-symbols` (a JSON array file),
`--format gzip|raw`, `--root`, `--max-bytes`, `--local-symbols`, and
`--keep-desktop-css`. Run `node cli.mjs --help` for the current synopsis.

The builder rejects external imports, runtime network APIs, non-embedded
authored resource URLs, invalid CSS-global usage, oversized outputs, and
multiple React installations. It returns the output path, final size
breakdown, retained symbols, navigation URLs, and the largest bundled
contributors so a caller can inspect the result without guessing from source
size.
