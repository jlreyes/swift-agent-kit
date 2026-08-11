---
name: mac-prototyping
description: Builds native-macOS-style app prototypes on the web using the bundled mac-chrome React/TypeScript toolkit — desktop shell, draggable windows, dock, Liquid Glass toolbar, Finder/chooser/setup-assistant/chat surfaces, tokens, and composable new/fork/serve command recipes. Use when creating, forking, changing, or reviewing a macOS-look prototype, or when asked to make a web UI look and behave like a Mac app.
compatibility: macOS host for the serve/launchd workflow; Node 24+ and pnpm for the template. Components are plain React 19 + CSS.
metadata:
  author: jlreyes
---

# Mac prototyping

Web-rendered prototypes that read as native macOS 26/27 apps. The toolkit
lives in this skill directory:

- `packages/mac-chrome/` — the chrome components + tokens (vendored into
  each prototype as `lib/mac-chrome/`).
- `template/` — a runnable starter (vinext + React 19 + vitest); a new
  prototype is a copy of it.
- [references/workflows.md](references/workflows.md) — the command recipes:
  new, fork, pick a port, serve durably via launchd, stop, clean up. These
  are ordinary `cp`/`rsync`/`pnpm`/`launchctl`/`curl` compositions —
  compose and adapt them; there is deliberately no wrapper CLI.
- [references/mac-pattern-rubric.md](references/mac-pattern-rubric.md) —
  the macOS pattern checklist every surface is judged against.
- The `mac-design-audit` agent (bundled with this plugin) — pattern-based
  design review; convene it as described below.

## Start or fork a prototype

New = copy `template/` to a stable path (`~/Prototypes/<name>`), rename,
vendor `packages/mac-chrome` as `lib/mac-chrome/`, `pnpm install`. Fork =
rsync an existing prototype (minus `node_modules`/build dirs), rename,
install. Exact recipes, the 8600–8699 port convention (`lsof` is the
registry), and the launchd serve/stop recipes are in
[references/workflows.md](references/workflows.md).

Fork instead of complicating: when an idea would fight the current
prototype's complexity, fork it (it's an rsync), give it its own port and
service, and strip what the experiment doesn't need. Forking is the
intended way to try directions, not a failure mode. Never park a prototype
in a per-session scratch directory — a stable path is what lets services
and later sessions find it.

A prototype is one composition per page: a ≤25-line `app/<surface>/page.tsx`
that renders `DesktopShell` + windows (`FinderWindow`, `ChooserWindow`,
`WindowChrome`+`MacToolbar`, …) over plain data props. Product state and
fixtures live outside `lib/mac-chrome/`.

## Invariants

These exist because their violations are exactly what made past prototypes
slow to work on (a 9,400-line globals.css with 1,094 hard-coded colors):

- **Tokens or nothing.** Every color, radius, blur, and shadow goes through
  `lib/mac-chrome/styles/tokens.css`. `--accent` (system blue) styles
  controls and focus; `--brand` (product color) styles identity only.
- **One CSS file per component/surface.** Never a shared growing global
  stylesheet; never a new backdrop-filter recipe when a token exists.
- **The chrome package never imports product code.** Product → chrome only.
- **Icons come in three tiers.** SF-style glyphs: `SystemSymbol` (original
  SVGs) or `symbolist` + the `SFSymbol` wrapper (system-font-rendered at
  view time). Third-party brand marks (Drive, Notion, Slack…):
  `simple-icons` via the `BrandIcon` wrapper — committable. Apple-system
  lookalikes (Finder/Safari dock icons, wallpapers): private local assets
  hydrated at creation time, never committed. **No Apple-owned assets in
  any repo** — no SF Pro font files, no exported SF Symbol SVGs, no macOS
  app-icon bitmaps.
- **No Unicode stand-ins for system glyphs** (`▦ ☷ ⌕` etc.) — SVG or
  symbolist only.
- **Glass belongs to chrome** (toolbars, dock, menu bar, popovers), never to
  content backgrounds.
- If a house TypeScript-standards skill is loaded in this environment, it
  governs prototype code too; this skill adds prototyping-specific rules,
  it does not waive house ones.

## Verify like a user, then audit

1. After a change: run the prototype's tests, then look at the real thing —
   screenshot or click the changed flow at the served URL. Automate
   multi-path checks (Playwright/console) instead of hand-stepping.
2. Deploy/serve first and share the URL; reviews run after, not before.
3. For direction decisions, new surfaces, or a final pass, convene the
   `mac-design-audit` agent with exactly: the pattern rubric, the diff or
   surface, the live URL, and current screenshots. One audit + one
   re-verify round; findings it can't prove live are hypotheses, not blocks.
4. Keep found-issue continuity in the prototype's `REVIEW-LEDGER.md` (a
   finding + resolution log), not in long-lived reviewer conversations.

## When a rule fights you

These rules encode one team's decisions, not physics. If an invariant blocks
the obvious path, or host specifics (ports, launchd, Tailscale) don't match
this machine, say so and ask the owner rather than silently working around
it — and record the resolution in the project's own docs.
