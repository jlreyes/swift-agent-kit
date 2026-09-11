# Chat preview builder

`@swift-agent-kit/chat-preview` packages a React entry as one self-contained
HTML fragment for a bounded chat host. It bundles the entry, preserves its
authored CSS, embeds local assets, optionally embeds a minimal private symbol
font, and enforces the final UTF-8 byte budget before replacing the output.

The [in-chat preview recipe](../../references/chat-preview.md) shows the
canonical showcase command and the host checks. Use HMR for normal prototype
development; this package is for an explicitly requested portable snapshot.

## Install

```sh
pnpm install --frozen-lockfile
```

The package pins esbuild, Acorn, and Terser. It installs nothing at build time.
The selected prototype must separately have its runtime dependencies installed;
pass that project through `dependencies`.

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
`root: "mac-chat-preview"`, `format: "gzip"`, `localSymbols: false`,
`python: "python3"`, and `maxBytes: 1_000_000`. `assetRoot` permits
root-relative CSS assets; `toolchain` optionally names a different location
for the pinned build tools.

When the entry uses `SystemSymbol`, provide `fontPath` to embed a private
minimal subset, or explicitly choose `localSymbols: true` for a local-only
preview. The private-font output guard applies only when a subset is actually
embedded, so a symbol-free entry may write inside Git even if it receives an
unused `fontPath`. `localSymbols` reports true only when symbols actually use
that local-only path. The supplied Python must already have fontTools and
Brotli; no font tooling is downloaded automatically.

For `srcSet`/`srcset` resource props, assignments, or `setAttribute`, the
only recognized nonempty literal form is one base64 image data URL with an
optional width or density descriptor. Other nonempty literals and computed
values produce advisory diagnostics that need browser verification.

## Symbols and runtime diagnostics

The builder packages the union of recognized valid string literals (including
no-substitution template literals) and validated `additionalSymbols`, for
example `additionalSymbols: ["chevron.left", "chevron.right"]`. It does not
infer `getSymbol`/`SystemSymbol` bindings or prove that a dynamic expression is
complete. Invalid explicit additions fail the build; a replacement lookup fails
at runtime when a name is outside the packaged set. The result's
`symbolCollectionMode` identifies this collection policy.

`authoredDiagnostics` reports source-level hints and `runtimeDiagnostics`
reports the same broad classes in the final minified bundle, including
dependencies: common network calls, resource URL properties and assignments,
`setAttribute` resource writes, remaining dynamic imports, and computed
resource values. Both are advisory review signals, not proof of isolation.

## CLI

`cli.mjs` accepts `--entry`, `--output`, `--component`, `--config`,
`--mac-chrome-directory`, `--dependencies`, `--toolchain`, `--asset-root`,
`--font`, `--python`, `--additional-symbols` (a JSON array file),
`--format gzip|raw`, `--root`, `--max-bytes`, `--local-symbols`, and
run `node cli.mjs --help` for the current synopsis.

Imported missing or external assets and an oversized final output remain build
errors. JavaScript diagnostics do not block a build. The builder no longer
rewrites selectors or keyframes: include only the styles the entry needs, such
as the toolkit's explicit no-wallpaper embedded stylesheet for an embedded
surface.

The fragment does not emit an iframe or a CSP, and it does not universally
enforce zero network access. The delivery host owns that policy. The installed
visualization-renderer code requests `blob:` and `data:` for `connectDomains`,
and those schemes plus approved CDNs for `resourceDomains`. Its remotely loaded
Skybridge inner document has not been inspected, so that is a requested profile,
not proof of effective runtime behavior.

Review fidelity in the intended host. Separately, reconstruct the requested
profile with extracted host styles and a network-blocked browser test to expose
missing prototype dependencies; that test does not change the real host policy.
Actual host acceptance remains a separate check. The builder returns the output
path, final size breakdown, retained symbols, both diagnostics arrays,
navigation URLs, and the largest bundled contributors so a caller can inspect
the result without guessing from source size.

Both verification helpers require `--visualize-skill` pointing to the installed
visualization skill directory. Their Python 3 loader reads `render.py` and
checks the installed renderer assets before reconstructing the requested
profile. `verify-second-consumer.mjs` supplies an independent consumer and
exercises direct connection failures plus an approved-CDN positive control.
