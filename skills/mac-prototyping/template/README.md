# Mac Prototype

A mac-desktop-style product prototype: Next (App Router) on [vinext], served
by a Cloudflare-style worker (`worker/index.ts`), built with Vite.

## Run

```sh
pnpm install
pnpm dev            # dev server (add --port 86xx; see the toolkit's port convention)
pnpm typecheck      # tsc --noEmit — also runs as the first step of `pnpm test`
```

`pnpm build` + `pnpm start` serve the production build the same way the
worker serves it when deployed.

## Test

```sh
pnpm test
```

That runs, in order: `pnpm typecheck` (`tsc --noEmit`), the production
build, `tests/rendered-html.test.mjs` (imports the built worker from
`dist/server/index.js` and asserts on server-rendered HTML per route), and
`tests/example.test.tsx` (jsdom + Testing Library interaction tests — an
in-memory `localStorage` helper is included there for stateful surfaces).
`tests/setup.ts` shims ResizeObserver and CSS.escape, which jsdom lacks and
the vendored mac-chrome's libraries require.

## Starter surfaces

The launcher at `/` links both starter routes:

- `/showcase` is the interactive catalog and coverage surface for every
  mac-chrome runtime export. Use it to discover components and smoke-check a
  freshly vendored toolkit. It is also a running Dock app, so its desktop
  identity is visible while exercising the shell. Its persistent catalog
  layout dogfoods the public source list and navigation split view; it is not
  a one-off demo layout.
- `/example` is the deliberately small, coherent product-window starter.
  Build the product's first surface from it rather than treating the catalog
  as application UI.

New prototypes inherit both routes. Keep the launcher links when adding
product surfaces.

The catalog exercises real shared chrome. Use `MacMenu` for command menus and
`MacDetailsMenu` for anchored disclosures; do not add raw `<details>` or a
bespoke popup to a toolbar. The toolkit defaults to restrained opaque or
near-opaque materials, compact command menus, and readable status popovers —
not a web approximation of Liquid Glass.

## Compose with mac-chrome

Build a product surface from public primitives before adding local components:

- Use `MacNavigationSplitView` for sidebar/detail (two columns) or
  sidebar/content/detail (three navigation columns). Use `MacInspector` as a
  separate supplementary pane, not as the third navigation column.
- Use `MacSourceList` for source-list sidebars, `MacList` for selectable
  rows, and `MacDisclosureGroup` for controlled collapsed detail.
- Use `MacButton`, `MacTextField`, `MacToggle`, `MacSegmentedControl`,
  `MacControlGroup`, `MacForm`, `MacFormSection`, `MacLabeledContent`, and
  `MacContentUnavailable` instead of restyling raw controls and empty states.
- Use a typed `DockIcon` with `MacDock` for app tiles. Asset icons preserve
  their own safe area; generated symbol icons use the shared tile and glyph
  boxes. Do not create a local full-size Dock icon tile or per-app scaling.

`FinderWindow`, `ChooserWindow`, `SetupAssistant`, and `ChatWindow` are
complete recipes layered above the primitives. Use them when their flow fits;
otherwise compose the primitives for the product's own structure. Tables,
outline views, grid collections, alerts, full SwiftUI parity, and Liquid Glass
are intentionally not starter-library promises.

## Add a surface

1. A surface is two files. `app/<name>/page.tsx` is a small server file —
   `metadata` plus a delegation:

   ```tsx
   import type { Metadata } from "next";
   import { FilesSurface } from "./files-surface.tsx";

   export const metadata: Metadata = { title: "Files · Mac Prototype" };

   export default function FilesPage() {
     return <FilesSurface />;
   }
   ```

   The sibling component (`files-surface.tsx` here) starts with
   `"use client"`, owns the state, and composes `DesktopShell` +
   `WindowChrome` + `MacToolbar` + `MacDock` and the relevant shared layout,
   collection, and control primitives from `lib/mac-chrome` — follow
   `app/example/`. Its `example-desktop.tsx` supplies `DesktopShell` a
   client-side `onMenuAction` target and shows temporary visible feedback for
   each command; replace that feedback with the product behavior.
2. List it in `app/page.tsx` (the launcher).
3. Add the route to `tests/rendered-html.test.mjs` (title + content marker).

When `DesktopShell` date and clock props are omitted, it renders a live
host-local macOS-style date and clock and handles their hydration internally.
For product-owned time-dependent UI (such as "today" dates), keep the server
and first client render aligned, then go live inside `useEffect`; calling
`new Date()` during that product render is a hydration mismatch.

## Icons — three tiers

1. **SF-style glyphs** — `components/SFSymbol.tsx` (`symbolist`): name →
   codepoint, rendered by the system font on Macs; no Apple assets ship.
2. **Third-party service marks** — `components/BrandIcon.tsx`
   (`simple-icons`): inline SVG paths in the brand color (e.g.
   `<BrandIcon slug="notion" />`). Committable.
3. **Apple-system lookalikes, real wallpaper/app icons** — after setting
   `SKILL_DIR` as in the toolkit workflow, hydrate them with
   `"$SKILL_DIR"/scripts/hydrate-macos-assets.sh <prototype-root>`. It
   populates ignored `public/mac-assets/` with local system app/folder/Trash
   icons and the macOS Tahoe Day wallpaper; `ffmpeg` is preferred for the
   wallpaper extraction and `qlmanage` is the fallback. Never commit those
   Apple-owned files. `DesktopShell` defaults to the hydrated Tahoe wallpaper
   and falls back to the shipped abstract SVG when it is unavailable.

## Where mac-chrome comes from

`lib/mac-chrome/` ships as a small stub so the template works standalone.
It is populated at scaffold time from the toolkit's `packages/mac-chrome`
(copied over the stub, same `index.ts` entry point).

## Deploy

`.openai/hosting.json` plus `build/sites-vite-plugin.ts` package deploy
metadata into `dist/.openai` at build time. Fill in `project_id` for your
hosting target; local dev and Tailscale serving need none of it.

[vinext]: https://www.npmjs.com/package/vinext
