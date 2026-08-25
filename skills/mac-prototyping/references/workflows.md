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
  --exclude package.json --exclude pnpm-lock.yaml \
  --exclude tsconfig.json --exclude vitest.config.ts \
  "$SKILL_DIR"/packages/mac-chrome/ ~/Prototypes/$name/lib/mac-chrome/
```

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
navigation, collections, controls, menu/popover, Dock, and window primitives
rather than a second private set. `/example` remains the focused starter
window.

When adding a product surface, compose from the vendored primitives before
writing an ad-hoc equivalent. In particular, use `MacNavigationSplitView` for
two-column sidebar/detail or three-column sidebar/content/detail navigation,
then add `MacInspector` as a separate supplementary pane when appropriate.
Use `MacSourceList`, `MacList`, `MacDisclosureGroup`, the `Mac*` controls and
forms, and `MacContentUnavailable` for their matching patterns. A product
surface owns its data and product composition; mac-chrome owns repeatable
native anatomy, focus/keyboard behavior, and optical geometry.

Dock entries must use `DockIcon`/`MacDockAppIcon`'s shared normalizer. Supply
an `asset` for hydrated app artwork or a `symbol` for generated app artwork;
do not nest a custom full-size icon tile or write per-app scale overrides.

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

Gotcha: the vinext dev server binds IPv6 loopback only (`[::1]`) and ignores
`--host`. Always health-check via `http://localhost:<port>`, never
`http://127.0.0.1:<port>` (connection refused).

## Serve durably (macOS)

A launchd LaunchAgent keeps the dev server alive (KeepAlive + restart at
login). Fill `references/com.macproto.TEMPLATE.plist` — note `PNPM_DIR` must
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

Start or restart this Vite LaunchAgent before enabling or re-enabling
Tailscale Serve on the same port. Leaving the proxy listener active while
Vite restarts can make Vite fall forward to the next port. The template keeps
Vite's rebinding guard and allows only `.ts.net` remote hostnames through
`server.allowedHosts`, which is sufficient for Tailscale Serve.

Done when this returns 200 — typically 5–20s (first boot optimizes
dependencies); logs at `/tmp/com.macproto.<name>.{out,err}.log` if it never
comes up:

```sh
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:$port/)" = 200 ] && { echo up; break; }
  sleep 1
done
```

Optional — share over the tailnet. Use the full-URL target: the bare-port
form proxies to 127.0.0.1, which vinext does not bind:

```sh
tailscale serve --bg --https=$port http://localhost:$port
```

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
