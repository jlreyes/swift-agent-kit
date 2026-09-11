# Build an in-chat preview

Use this route only when a task explicitly needs a self-contained preview in a
bounded chat host. HMR remains the normal workflow for developing a prototype.

Install the preview builder's pinned dependencies once from its package:

```sh
cd skills/mac-prototyping/packages/chat-preview
pnpm install --frozen-lockfile
```

`--dependencies ../../template` in the showcase command resolves React and the
prototype's runtime packages from `template/node_modules`. Install that
template once before using the command:

```sh
cd skills/mac-prototyping/template
pnpm install
```

For another prototype, point `--dependencies` at that prototype's directory
after its own dependencies are installed. The builder resolves its pinned build
tools from its package by default; `--toolchain` is available only when an
explicit toolchain location is needed.

The command uses a local SF Pro source font and a Python environment that
already has fontTools and Brotli. It downloads neither at runtime. Set the two
paths before building, then verify the Python environment:

```sh
export CHAT_PREVIEW_SF_PRO_FONT='/private/path/to/SF-Pro-Text-Regular.otf'
export CHAT_PREVIEW_PYTHON='python3'
"$CHAT_PREVIEW_PYTHON" -c 'import fontTools, brotli'
```

The source font and the generated subset are private local inputs. Do not add
either to Git or extract Apple-owned assets into a repository.

## Build the canonical showcase

Run this from `skills/mac-prototyping/packages/chat-preview`. The output path
must stay outside every Git repository because the preview contains the
private font subset.

```sh
node cli.mjs \
  --entry ../../examples/chat-preview/showcase.tsx \
  --output /private/tmp/mac-chat-preview/showcase.html \
  --component \
  --mac-chrome-directory ../mac-chrome \
  --dependencies ../../template \
  --asset-root ../../template/public \
  --font "$CHAT_PREVIEW_SF_PRO_FONT" \
  --python "$CHAT_PREVIEW_PYTHON" \
  --additional-symbols ../../examples/chat-preview/showcase-symbols.json \
  --root mac-chat-preview \
  --format gzip \
  --max-bytes 1000000
```

`--component` mounts the entry module's default export. The showcase uses the
actual 11-story template, sheet-motion navigation, and its optional menu bar.
Gzip is the default because the tested Chromium and WebKit targets both expose
its native decoder. Use `--format raw` only when the target host cannot decode
gzip.

For the frame-only variant, replace the `--entry` value with
`../../examples/chat-preview/showcase-window.tsx` and keep the remaining
arguments unchanged.

`showcase-symbols.json` is intentionally `[]`: it asserts that this finite
fixture needs no *extra* symbols beyond the builder's conservative collection
of static and finite reachable literals. It does not make arbitrary computed
symbol names safe. For an unbounded expression, provide a complete JSON array
with `--additional-symbols`; an undeclared runtime glyph is an error.

## Verify the boundary

Run the package checks and the applicable prototype checks, then inspect the
preview in its opaque-frame target. The chooser must tolerate a `localStorage`
getter that throws `SecurityError`; menus and popovers must stay in the scoped
presentation host; and close, minimize, and Dock restoration must resolve
through the window registry.

The verifier requires a project with Playwright and its Chromium and WebKit
binaries already installed. The template declares Playwright; install those
binaries only when they are absent:

```sh
cd skills/mac-prototyping/template
pnpm exec playwright install chromium webkit
```

From the repository root, verify the menu-bar artifact and write private
screenshots and results outside Git:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-menu \
  --width 1024
```

Verify the menu-hidden variant separately:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase-window.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-window \
  --width 1024 \
  --menu-hidden
```

`--input`, `--dependencies`, and `--output-directory` are required.
`--width` and `--menu-hidden` are optional. Chromium and WebKit run in
parallel, and the verifier refuses an output directory inside a Git repository.

The skill's independent design review remains required for a final
presentation.
