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
   `WindowChrome` + `MacToolbar` + `MacDock` from `lib/mac-chrome` — follow
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
