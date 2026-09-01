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
  identity is visible while exercising the shell. Full compositions launch
  as simultaneous managed apps: click an exposed background window to bring
  it forward, drag its toolbar, use its traffic lights or Window-menu
  commands, minimize it into the Dock's separate window-thumbnail group, then
  restore that same thumbnail. Its persistent catalog layout dogfoods the
  public source list and navigation split view; it is not a one-off demo
  layout.
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

### Review a Mac desktop from a phone

The `/showcase` route demonstrates the opt-in fixed-desktop review mode. Its
route-local layout exports `fixedDesktopReviewViewport`, and its
`DesktopShell` uses `mobileReviewMode="fixed-desktop"`. Together they keep the
1200x750 Mac canvas intact while the browser owns pan, pinch, and double-tap
zoom. Other routes remain responsive.

Windows keep their authored frame by default. A content workspace may pass
`mobilePresentation="maximized"` to `WindowChrome`; utility and comparison
windows should normally remain `authored`. Touch never starts simulated window
dragging or resizing, and focus changes do not recenter the browser viewport.

### Browser acceptance

Run the real-browser acceptance lane after installing its official browser
builds:

```sh
pnpm exec playwright install chromium webkit
pnpm test:browser
```

The lane builds and serves the production prototype, then exercises both a
desktop Chromium project and a phone-sized WebKit project. It protects the
interactions that jsdom cannot faithfully cover: settled and reloaded Dock
symbol geometry; menu/status separation and hit testing; split-view resizing
and contained windows; visible error overlays and browser failures; and the
fixed 1200x750 phone review mode, including hidden resize handles,
touch-owned navigation, and focus that does not recenter the viewport.

The optional unhydrated Tahoe wallpaper may return 404; the browser checks
explicitly exempt that asset URL. Any other failed response, failed request,
page error, or console error fails the run.

## Compose with mac-chrome

Build a product surface from public primitives before adding local components:

- Wrap the desktop in `MacWindowManager`, place each simulated application in
  a stable `MacApp`, let `WindowChrome` register the app's windows, and use
  `MacAppDock` for launch, activation, running state, and restore. Give every
  additional window in one app an explicit stable `windowId`; do not maintain
  local z-index or “active window” mount state. `WindowChrome` owns
  click-to-front, contained drag, ResizeObserver recontainment, and default
  eight-edge resizing; set its `minSize`/`resizable` props rather than
  reimplementing geometry or overriding `.mac-window` positioning.
  Managed minimize is part of this same lifecycle: it captures the actual
  window, transitions it into the Dock's separate thumbnail group, leaves the
  app tile running, and restores through that thumbnail. Do not make a local
  minimized-window UI. Standalone unmanaged `WindowChrome` uses its local hide
  fallback instead.
  Define each managed app's immutable `MacAppDefinition` once, pass the full
  manifest to `MacWindowManager` as `initialApps`, and spread the same
  definitions into `MacApp`; this puts the final app identities and Dock tiles
  in SSR rather than adding or shifting them after registration effects.
- Use `MacApp presentation="windowed"` for ordinary Dock apps and
  `presentation="menuBar"` with `MenuBarExtra` for status-item-only apps.
- Use `MacAlert presentationScope="desktop"` for a menu-bar app's system
  alert. Windowed alerts and `MacSheet` attach to their owning window. When a
  status-item popover launches that alert, control `MenuBarExtra` with
  `isOpen`/`onOpenChange` and a stable `triggerRef`, close it, then open the
  alert so the shared modal host can clean up background isolation and restore
  focus to the status trigger.
- Use `MacNavigationSplitView` for sidebar/detail (two columns) or
  sidebar/content/detail (three navigation columns). Use `MacInspector` as a
  separate supplementary pane, not as the third navigation column.
- Use `MacSourceList` for source-list sidebars, `MacList` for selectable
  rows, and `MacDisclosureGroup` for controlled collapsed detail. Source-list
  section headers are structural by default. A titled section may opt into a
  controlled navigation destination with `selectable: true` and
  `selectedSectionId` / `onSectionSelectionChange`; both disclosure surfaces
  use the shared SF Symbol indicator.
- Use `MacButton`, `MacTextField`, `MacToggle`, `MacSegmentedControl`,
  `MacControlGroup`, `MacForm`, `MacFormSection`, `MacLabeledContent`, and
  `MacContentUnavailable` instead of restyling raw controls and empty states.
- Use `MacWindowStatusBar` for window-owned status, `MacAlert` for short
  decisions, and `MacSheet` for a scoped modal workflow. `MacSheet` owns its
  title, body insets, and action row; pass `MacDialogAction` data instead of
  composing a heading or button row in the caller. `Sheet` is compatibility
  only.
- Use `MacMenu` for 13px/24px command rows and `MacPopover` for arbitrary
  anchored content (`layout` and `contentInset` are explicit). Do not style
  arbitrary content as a command menu or build raw overlay/details widgets.
  Both `MacPopover` and `MenuBarExtra` expose controlled
  `isOpen`/`onOpenChange` state and `triggerRef` for a popover-to-desktop-alert
  handoff with stable focus restoration.
- Use typed `DockIcon` data with `MacDock` for app tiles; `MacDockAppIcon` is
  the shared runtime renderer. Asset icons preserve their own safe area;
  `{ kind: "systemSymbol", name }` lets it construct and size a typed system
  glyph, while `{ kind: "artwork", artwork }` is the explicit custom-artwork
  escape hatch. Generated icons use the shared tile and glyph boxes. Do not
  create a local full-size Dock icon tile or per-app scaling.

`FinderWindow`, `ChooserWindow`, `SetupAssistant`, and `ChatWindow` are
complete recipes layered above the primitives. Use them when their flow fits;
otherwise compose the primitives for the product's own structure. Tables,
outline views, grid collections, full SwiftUI parity, and Liquid Glass
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
   `"use client"`, owns the state, and composes `MacWindowManager` +
   `DesktopShell` + `MacApp` + `WindowChrome` + `MacToolbar` + `MacAppDock`
   and the relevant shared layout, collection, and control primitives from `lib/mac-chrome` — follow
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

1. **SF-style glyphs** — `SystemSymbol` (`symbolist`): typed name → private-use
   codepoint, rendered by the installed system SF font on Macs; no Apple
   assets ship. `components/SFSymbol.tsx` is a deprecated compatibility alias;
   new code imports `SystemSymbol`. Do not draw or ship bespoke SVG
   approximations. Exact glyph rendering therefore depends on a Mac client.
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
