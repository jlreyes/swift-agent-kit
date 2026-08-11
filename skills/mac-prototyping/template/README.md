# Mac Prototype

A mac-desktop-style product prototype: Next (App Router) on [vinext], served
by a Cloudflare-style worker (`worker/index.ts`), built with Vite.

## Run

```sh
pnpm install
pnpm dev            # dev server (add --port 86xx; see the toolkit's port convention)
```

`pnpm build` + `pnpm start` serve the production build the same way the
worker serves it when deployed.

## Test

```sh
pnpm test
```

That runs, in order: the production build, `tests/rendered-html.test.mjs`
(imports the built worker from `dist/server/index.js` and asserts on
server-rendered HTML per route), and `tests/example.test.tsx` (jsdom +
Testing Library interaction tests — an in-memory `localStorage` helper is
included there for stateful surfaces).

## Add a surface

1. Create `app/<name>/page.tsx`. Follow `app/example/page.tsx`: wrap the
   surface in `DesktopShell`, compose `WindowChrome` + `MacToolbar` +
   `MacDock` from `lib/mac-chrome`, and export `metadata` with a title.
2. List it in `app/page.tsx` (the launcher).
3. Add the route to `tests/rendered-html.test.mjs` (title + content marker).

## Icons — three tiers

1. **SF-style glyphs** — `components/SFSymbol.tsx` (`symbolist`): name →
   codepoint, rendered by the system font on Macs; no Apple assets ship.
2. **Third-party service marks** — `components/BrandIcon.tsx`
   (`simple-icons`): inline SVG paths in the brand color (e.g.
   `<BrandIcon slug="notion" />`). Committable.
3. **Apple-system lookalikes, real wallpaper/app icons** — private local
   assets: copy your asset dir into `public/` after scaffolding and point
   dock items / the `.desktop-canvas` background at them. Never committed;
   the shipped gradient wallpaper and `public/dock/` SVGs are the stand-ins.

## Where mac-chrome comes from

`lib/mac-chrome/` ships as a small stub so the template works standalone.
It is populated at scaffold time from the toolkit's `packages/mac-chrome`
(copied over the stub, same `index.ts` entry point).

## Deploy

`.openai/hosting.json` plus `build/sites-vite-plugin.ts` package deploy
metadata into `dist/.openai` at build time. Fill in `project_id` for your
hosting target; local dev and Tailscale serving need none of it.

[vinext]: https://www.npmjs.com/package/vinext
