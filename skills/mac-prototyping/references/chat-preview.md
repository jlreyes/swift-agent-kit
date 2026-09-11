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
font path. For `srcSet`/`srcset` props, assignments, or `setAttribute`, one
base64 image data URL with an optional width or density descriptor is the
recognized form. Other literals and computed values are advisory diagnostics
for browser verification, not build failures.

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

Both verifiers also require `--visualize-skill` pointing to the installed
visualization skill directory. Their Python 3 loader reads `render.py` and
checks the installed renderer assets before reconstructing the requested
profile:

```sh
export CHAT_PREVIEW_VISUALIZE_SKILL='/path/to/installed/visualize-skill'
```

From the repository root, verify the managed artifact and write private
screenshots and results outside Git:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-menu \
  --visualize-skill "$CHAT_PREVIEW_VISUALIZE_SKILL" \
  --width 1024
```

Verify the static window with no menu separately. `--window-static` is
required for static artifacts, and `--menu-hidden` asserts the omitted menu:

```sh
node skills/mac-prototyping/examples/chat-preview/verify.mjs \
  --input /private/tmp/mac-chat-preview/showcase-window.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-window \
  --visualize-skill "$CHAT_PREVIEW_VISUALIZE_SKILL" \
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
  --visualize-skill "$CHAT_PREVIEW_VISUALIZE_SKILL" \
  --width 1024 \
  --window-static
```

`--input`, `--dependencies`, `--output-directory`, and `--visualize-skill`
are required.
`--width`, `--menu-hidden`, and `--window-static` are optional in general.
Chromium and WebKit run in parallel, and the verifier refuses an output
directory inside a Git repository.
`authoredDiagnostics` and `runtimeDiagnostics` are advisory hints for common
direct resource and API patterns; dynamic or aliased resources and dependencies
can evade them. The fragment does not add an iframe or CSP. The delivery host
owns runtime restrictions. The installed renderer code requests a profile with
`blob:`/`data:` connections and those schemes plus approved CDNs for resources,
but the remotely loaded Skybridge inner document has not been inspected. Treat
that as a requested profile, not proof of the effective runtime policy.

Inspect the preview in its intended host for fidelity. Separately, use the
requested-profile reconstruction, extracted host styles, and network-blocked
browser verification to expose missing prototype dependencies; that test does
not change the real host policy. Do not treat this recipe as proof of universal
zero-network behavior or as a substitute for actual host acceptance.

## Verify a second consumer

Build the independent document-settings example with the same builder inputs,
substituting `../../examples/chat-preview/second-consumer.tsx` as `--entry`
and `/private/tmp/mac-chat-preview/second-consumer.html` as `--output`. Then
run:

```sh
node skills/mac-prototyping/examples/chat-preview/verify-second-consumer.mjs \
  --input /private/tmp/mac-chat-preview/second-consumer.html \
  --dependencies skills/mac-prototyping/template \
  --output-directory /private/tmp/mac-chat-preview/verify-second-consumer \
  --visualize-skill "$CHAT_PREVIEW_VISUALIZE_SKILL" \
  --width 1024
```

This consumer checks reconstructed-profile connection failures and an
approved-CDN positive control. It is evidence for the reconstruction, not
inspection of the live remote host.

The skill's independent design review remains required for a final
presentation.
