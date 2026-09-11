# Prototype workflows

Composable commands for creating, forking, and serving mac-style prototypes.
Set this once and every command below is paste-able (`SKILL_DIR` = the
directory holding this skill's `SKILL.md`, `template/`, and
`packages/mac-chrome/` — you just loaded this file from it):

```sh
SKILL_DIR=/path/to/skills/mac-prototyping
```

All commands verified on macOS with pnpm 10+.

## New prototype

Copy the template, name it, vendor mac-chrome, hydrate private macOS assets,
then install. Done when `pnpm test` is green.

```sh
name=myproto
cp -R "$SKILL_DIR"/template ~/Prototypes/$name   # or: rsync -a "$SKILL_DIR"/template/ ~/Prototypes/$name/
cd ~/Prototypes/$name
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json'));p.name=process.argv[1];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')" $name
```

(`pnpm install` prints "Ignored build scripts: esbuild, sharp, …" — that is
pnpm 10's default posture and benign here; the binaries resolve from
optionalDependencies and the build passes.)

Vendor the real mac-chrome over the shipped stub (skip if the package is
absent — the stub keeps everything working). The excludes matter: the
package's own scaffolding must not land inside a consumer (a nested
`package.json` confuses pnpm, and the package tests never run from there):

```sh
# --delete-excluded: excluded stale files must not survive re-vendoring (found live).
rsync -a --delete --delete-excluded --exclude node_modules --exclude test \
  --exclude package.json --exclude pnpm-lock.yaml --exclude pnpm-workspace.yaml \
  --exclude tsconfig.json --exclude vitest.config.ts \
  "$SKILL_DIR"/packages/mac-chrome/ ~/Prototypes/$name/lib/mac-chrome/
```

The template's `pnpm-workspace.yaml` points at the mirrored stub asset under
`lib/mac-chrome/patches/`; re-vendoring replaces that stub with the canonical
patch. Each consumer keeps its own `pnpm-workspace.yaml`. Merge this entry into
its top-level `patchedDependencies` map after re-vendoring, preserving any
existing entries, then run `pnpm install`:

```yaml
patchedDependencies:
  react-resizable-panels@4.12.2: lib/mac-chrome/patches/react-resizable-panels@4.12.2.patch
```

The vendored directory carries a mirrored patch asset; the consumer workspace
is the place pnpm resolves it. The patch fixes only the split panel's rendered
viewport pointer-delta denominator under a transformed logical desktop and
cancels an active gesture when that rendered extent changes, avoiding a stale
pointer anchor after zoom or presentation scaling. It does not change panel
constraints or add/change a dependency version. See the patch README for its
removal criterion.

Hydrate local private assets before running the prototype. This copies and
converts local system app, folder, and Trash icons and extracts the actual
macOS Tahoe Day wallpaper into `public/mac-assets/`. The output is ignored by
the template and must never be committed. The script prefers `ffmpeg` for the
Tahoe extraction and uses `qlmanage` as its fallback:

```sh
"$SKILL_DIR"/scripts/hydrate-macos-assets.sh ~/Prototypes/$name
```

```sh
pnpm install
pnpm test                                          # typecheck + build + rendered-html + jsdom tests
```

After vendoring, smoke-check `http://localhost:<port>/showcase` once the
prototype is served. It is the template's interactive mac-chrome coverage
surface and canonical component catalog: it must dogfood the public
navigation, collections, controls, menu/popover, managed app/window, and Dock
primitives rather than a second private set. `/example` remains the focused
starter window.

When adding a product surface, compose from the vendored primitives before
writing an ad-hoc equivalent. In particular, use `MacNavigationSplitView` for
two-column sidebar/detail or three-column sidebar/content/detail navigation,
then add `MacInspector` as a separate supplementary pane when appropriate.
Use `MacSourceList`, `MacList`, `MacDisclosureGroup`, the `Mac*` controls and
forms, and `MacContentUnavailable` for their matching patterns. A product
surface owns its data and product composition; mac-chrome owns repeatable
native anatomy, focus/keyboard behavior, and optical geometry.

Wrap every multi-app desktop in `MacWindowManager`. Put each persistent app
surface under a stable `MacApp`, let its `WindowChrome` instances register
there, and render one `MacAppDock`. Multiple windows in the same app need
explicit stable `windowId` values. The provider owns key-window focus,
z-order, running state, traffic-light actions, Window-menu targeting, and
Dock launch/restore; do not duplicate those with route-local active-window
state or z-index counters. `WindowChrome` owns contained drag/resize geometry
and recontains itself when its desktop canvas changes; use its `minSize` and
`resizable` props, and never override `.mac-window` positioning from a recipe.
Managed minimize belongs to this registry too: it captures the actual window,
uses a shared View Transition, and places a restorable preview in the Dock's
separate `windows` group while the app tile stays running. Do not create a
product-local minimized state or thumbnail. Standalone unmanaged windows keep
their local hide fallback.

When smoke-checking a served desktop, minimize both from traffic lights and
the Window menu, verify the same preview appears in the separate Dock section,
then restore it and verify removal. Resize a split-view window and shrink then
reset the viewport; the shared adapter must prevent ResizeObserver overlays
and console errors without suppressing unrelated errors.

`DesktopShell` defaults to a 1440×900 logical CSS-point desktop, the supported
scaled mode documented for an M1 MacBook Air. It is not the 2560×1600 physical
panel or a prevalence claim. Set a custom `displaySize` for another logical
desktop, or `displaySize="viewport"` for responsive layout. Keep window frames
and layout in logical points; DPR, browser page zoom, and visual-viewport pinch
zoom affect presentation or input conversion. Use canvas percentages and
container-relative rules instead of `vw`, `vh`, or `window.innerWidth`.

When checking a scaled desktop, distinguish page zoom from visual-viewport
pinch zoom and confirm drag/resize, split panels, menus, modals, Dock tooltips,
and minimized thumbnails remain attached to their logical owner. Host resizing
may change presentation fit but must not rewrite saved logical frames. An
in-flight split-panel pointer gesture cancels when its rendered extent changes;
release and begin a new drag after zoom or scale changes.

These are browser presentation contracts. They do not establish behavior when
physical macOS display settings change; that platform case has not been tested.

Choose `MacApp presentation="windowed"` for an ordinary Dock app, or
`presentation="menuBar"` with `MenuBarExtra` for a status-item app. Use
`MacAlert presentationScope="desktop"` for a menu-bar app's system decision;
`MacSheet` and ordinary alerts attach to the owning window. Keep Dock activity
out of `MacWindowStatusBar`, which is window-local feedback only.

Dock entries must use `DockIcon`/`MacDockAppIcon`'s shared normalizer. Supply
an `asset` for hydrated app artwork, `systemSymbol` with a typed name for an SF
glyph, or the explicit `artwork` escape hatch for other generated artwork. Do
not nest a custom full-size icon tile or write per-app scale overrides.

Use `SystemSymbol` for SF-style glyphs. It maps typed `symbolist` codepoints
through the macOS system SF font; it deliberately ships neither font files nor
hand-drawn SF-symbol SVGs, and therefore needs a Mac client for exact glyph
rendering. The template's `SFSymbol` remains only as a deprecated compatibility
alias; new chrome code imports `SystemSymbol`.

Use `MacMenu` for command rows and `MacPopover` for arbitrary anchored content
(`layout` and `contentInset` make that choice explicit). Use
`MacDisclosureGroup` for collapsed detail and `MacSourceList` for sidebar
navigation. Source-list headers are structural and disclosure-only by default.
A titled section may explicitly become a controlled navigation target with
`selectable: true` and `selectedSectionId` / `onSectionSelectionChange`; its
disclosure remains a separate action.

Use `MacSearchField` for a generic controlled search input: provide an
accessible name (or a visible label), preserve its input ref when needed, and
handle `onSubmit` for Enter. Its magnifier and clear affordance are built in;
clearing returns focus to the input. Escape clears an editable nonempty query
before a containing sheet can cancel; read-only and disabled fields do not
clear. For an attached task, `MacSheet` provides `compact` (420), `wide` (700),
and `large` (960) logical-width caps, `contentInset`, `bodyScroll`, and
`headerAccessory`. Use `MacDialogAction.placement="leading"` for secondary
actions; trailing actions retain their semantic/default ordering. A sheet list
can use `escapeKeyBehavior="none"` to pass Escape to Cancel while retaining
selection.

## Fork an existing prototype

Copy everything except installed/built state; keep `.git` out unless you want
the history to continue. Done when `pnpm test` is green in the fork.

```sh
rsync -a --exclude node_modules --exclude .next --exclude dist \
  --exclude .vinext --exclude .wrangler --exclude .git \
  ~/Prototypes/myproto/ ~/Prototypes/myfork/
cd ~/Prototypes/myfork
node -e "const fs=require('fs'),p=JSON.parse(fs.readFileSync('package.json'));p.name=process.argv[1];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')" myfork
pnpm install && pnpm test
```

Drop `--exclude .git` to carry the source's history along.

## Port convention

Prototypes live on ports 8600–8699, one port per prototype for its lifetime.
Find a free one (no output = all free; any LISTEN line shows a taken port):

```sh
lsof -nP -iTCP:8600-8699 -sTCP:LISTEN
```

The launchd plist is the port's single owner — its `ProgramArguments` pass
`--port` (see "Serve durably" below). Leave `scripts.dev` portless so the
plist and a manual run can never disagree; for a manual run, pass the port
on the command line (`vinext dev` accepts `--port`; verified). `86xx` here
and below is a placeholder — substitute the port you picked from the scan:

```sh
pnpm dev --port 86xx
```

`vinext dev` accepts `--hostname` (not `--host`) and defaults to localhost;
the observed default listener is IPv6 loopback (`[::1]`). Always health-check
via `http://localhost:<port>` for that default. Use
`http://127.0.0.1:<port>` only when the service explicitly binds to
`127.0.0.1` with `--hostname`. Inspect the actual listener and proxy target if
a service does not respond; `strictPort: true` prevents a silent fallback to
another port. Adjust only a mapping that conflicts with the authorized
prototype service.

## Serve durably (macOS)

A launchd LaunchAgent keeps the `vinext dev` server alive (KeepAlive + restart
at login). It is the normal editing loop: run it from the stable prototype
source or worktree, keep its private Tailscale full-origin proxy, edit source,
and observe the browser update through HMR. Do not run `build`/`start`, restart
the agent, or manually refresh for an ordinary edit. Fill
`references/com.macproto.TEMPLATE.plist` — note `PNPM_DIR` must
be substituted before `PNPM`:

```sh
name=myproto dir=~/Prototypes/myproto port=86xx   # 86xx = the port picked from the lsof scan
pnpm_bin=$(command -v pnpm)
plist=~/Library/LaunchAgents/com.macproto.$name.plist
sed -e "s|PNPM_DIR|$(dirname "$pnpm_bin")|g" -e "s|PNPM|$pnpm_bin|g" \
    -e "s|NAME|$name|g" -e "s|DIR|$dir|g" -e "s|PORT|$port|g" \
    "$SKILL_DIR"/references/com.macproto.TEMPLATE.plist > "$plist"
plutil -lint "$plist"
launchctl bootstrap gui/$(id -u) "$plist"
```

The template keeps Vite's rebinding guard and allows only `.ts.net` remote
hostnames through `server.allowedHosts`, which is sufficient for Tailscale
Serve. Do not disable and recreate the proxy on each restart: inspect the
actual listener and target instead.

Done when this returns 200 — typically 5–20s (first boot optimizes
dependencies); logs at `/tmp/com.macproto.<name>.{out,err}.log` if it never
comes up:

```sh
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:$port/)" = 200 ] && { echo up; break; }
  sleep 1
done
```

Optional — share over the tailnet. With the default listener, use the
full-URL target; the bare-port form assumes `127.0.0.1`. If the service
explicitly binds to `127.0.0.1`, use a target that matches that binding:

```sh
tailscale serve --bg --https=$port http://localhost:$port
```

## Development versus built previews

`pnpm test` includes a build as a verification step; it does not mean the
prototype should serve built output while editing. Use the persistent dev
service for development. Create and serve a built snapshot only when a task
needs a public demo, deliberate stable review snapshot, or performance,
poor-network, or offline acceptance. A disconnected browser cannot receive
new edits through HMR, so assess offline behavior on that built snapshot.

Do not automatically replace an existing public or Funnel preview with a dev
server. Keep its current service unless the owner authorizes a change.

## HMR, service workers, and diagnosis

Service workers can coexist with HMR. Keep development HTML, code, and RSC
responses network-fresh, and do not route the HMR transport through a cache.
Follow the product's cache policy for stable assets and its service-worker
scope. If a controlled document is stale, unregister only that prototype's
worker and clear only its caches as a migration or diagnosis step; do not
clear unrelated browser caches or disable workers wholesale.

When an edit does not appear, diagnose in this order: confirm that the served
source and strict port are the intended ones; confirm the dev server detected
the file update; inspect the browser WebSocket through the actual shared
origin, including the proxy's upgrade path; then check for a stale controlled
document. Do not preemptively set HMR host or client-port options: the verified
Vite 8 default uses the browser origin. If those checks do not identify the
break, report their results and stop rather than guessing a topology.

## Status / stop / cleanup

List running prototype agents, and liveness-check a port:

```sh
launchctl list | grep com.macproto
curl -s -o /dev/null -w '%{http_code}\n' --max-time 2 http://localhost:86xx/
```

Stop one, remove its agent, and delete its logs (done when `launchctl list`
no longer shows it and the port scan comes back empty):

```sh
launchctl bootout gui/$(id -u)/com.macproto.myproto
rm ~/Library/LaunchAgents/com.macproto.myproto.plist
rm -f /tmp/com.macproto.myproto.{out,err}.log
lsof -nP -iTCP:8600-8699 -sTCP:LISTEN
```

If it was shared, also `tailscale serve --https=<port> off`.
