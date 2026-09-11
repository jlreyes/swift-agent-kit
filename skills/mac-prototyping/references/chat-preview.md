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

The private-font output restriction applies only when the build embeds a
subset. A symbol-free preview may write inside Git even when given an unused
font path. For `srcSet`/`srcset` props, assignments, or `setAttribute`, use
only one base64 image data URL with an optional width or density descriptor;
candidate lists and other literal forms fail. Computed values remain browser
verification work.

## Build the three showcase modes

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

`--component` mounts the entry module's default export. This managed example
uses the actual 11-story template, sheet-motion navigation, and explicitly
sets both `menuBar` and `windowManagement` to true. Gzip is the default because
the tested Chromium and WebKit targets both expose its native decoder. Use
`--format raw` only when the target host cannot decode gzip.

The window-only entry explicitly keeps both options false, so it has no menu
bar or Dock:

```sh
node cli.mjs \
  --entry ../../examples/chat-preview/showcase-window.tsx \
  --output /private/tmp/mac-chat-preview/showcase-window.html \
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

The static menu entry enables `menuBar` while keeping `windowManagement`
false:

```sh
node cli.mjs \
  --entry ../../examples/chat-preview/showcase-window-menu.tsx \
  --output /private/tmp/mac-chat-preview/showcase-window-menu.html \
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

All three wrappers accept the underlying presentation props, but the examples
make their intended feature level explicit.

`showcase-symbols.json` is intentionally `[]`: it asserts that this fixture
needs no symbols beyond recognized literal names. Named object members and
unbounded expressions require a complete JSON array with
`--additional-symbols`; an undeclared runtime glyph is an error.

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

From the repository root, verify the managed artifact and write private
screenshots and results outside Git:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-menu \
  --width 1024
```

Verify the static window with no menu separately. `--window-static` is
required for static artifacts, and `--menu-hidden` asserts the omitted menu:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase-window.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-window \
  --width 1024 \
  --menu-hidden \
  --window-static
```

Verify the static window with a menu separately:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase-window-menu.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-window-menu \
  --width 1024 \
  --window-static
```

`--input`, `--dependencies`, and `--output-directory` are required.
`--width`, `--menu-hidden`, and `--window-static` are optional in general.
Chromium and WebKit run in parallel, and the verifier refuses an output
directory inside a Git repository.
Static checks catch common direct resource calls and literals, but dynamic or
aliased resources and dependencies can evade them. Treat the inline/data-only
CSP and network-blocked sandbox browser verification as the enforcement
boundary.

The skill's independent design review remains required for a final
presentation.
