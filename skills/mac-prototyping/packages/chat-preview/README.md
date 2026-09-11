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
preview. The private-font output guard applies only when a subset is actually
embedded, so a symbol-free entry may write inside Git even if it receives an
unused `fontPath`. `localSymbols` reports true only when symbols actually use
that local-only path. The supplied Python must already have fontTools and
Brotli; no font tooling is downloaded automatically.

For `srcSet`/`srcset` resource props, assignments, or `setAttribute`, the
only accepted literal form is one base64 image data URL with an optional width
or density descriptor. Literal candidate lists and other forms fail explicitly;
computed values remain diagnostics that need browser verification.

## Symbols and runtime diagnostics

The builder includes recognized literal symbol names. Named object members and
unbounded expressions need every possible name through `additionalSymbols`,
for example `additionalSymbols: ["folder", "gearshape"]`. An undeclared
dynamic name fails at build time or, if it reaches the packaged lookup, at
runtime. This prevents a small preview from silently carrying a full symbol
dictionary.

The result's `runtimeDiagnostics` reports common network calls, resource URL
properties and assignments, `setAttribute` resource writes, remaining dynamic
imports, and computed resource values in the final minified bundle, including
dependencies. A diagnostic is a review signal, not a proof of isolation.

## CLI

`cli.mjs` accepts `--entry`, `--output`, `--component`,
`--mac-chrome-directory`, `--dependencies`, `--toolchain`, `--asset-root`,
`--font`, `--python`, `--additional-symbols` (a JSON array file),
`--format gzip|raw`, `--root`, `--max-bytes`, `--local-symbols`, and
`--keep-desktop-css`. Run `node cli.mjs --help` for the current synopsis.

Source validation rejects common direct external imports, network calls
including `sendBeacon`, and non-embedded authored resource literals. CSS
validation rejects unscoped ambiguous animation values when keyframes need
renaming, alongside invalid CSS-global usage. Static checks and
`runtimeDiagnostics` cannot prove that aliases, HTML strings, arbitrary
runtime code, or every dependency path will not reach the network. Enforce
that boundary with an inline/data-only CSP and network-blocked browser
verification. The builder returns the output path, final size breakdown,
retained symbols, `runtimeDiagnostics`, navigation URLs, and the largest
bundled contributors so a caller can inspect the result without guessing from
source size.
