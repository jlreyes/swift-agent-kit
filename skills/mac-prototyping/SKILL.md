---
name: mac-prototyping
description: Builds native-macOS-style app prototypes on the web using the bundled mac-chrome React/TypeScript toolkit — managed apps and windows, desktop shell, Dock, navigation split views, source lists, forms, controls, menus, window recipes, tokens, and composable new/fork/serve command recipes. Use when creating, forking, changing, or reviewing a macOS-look prototype, or when asked to make a web UI look and behave like a Mac app.
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
vendor `packages/mac-chrome` as `lib/mac-chrome/`, hydrate its local macOS
assets, then `pnpm install`. Fork = rsync an existing prototype (minus
`node_modules`/build dirs), rename, install. Exact recipes, the 8600–8699
port convention (`lsof` is the registry), and the launchd serve/stop recipes are in
[references/workflows.md](references/workflows.md).

Fork instead of complicating: when an idea would fight the current
prototype's complexity, fork it (it's an rsync), give it its own port and
service, and strip what the experiment doesn't need — forking is the
intended way to try directions. Never park a prototype in a per-session
scratch directory; a stable path is what lets services and later sessions
find it.

A surface is two files: a small server `app/<surface>/page.tsx` that exports
`metadata` and only delegates, plus a `"use client"` component beside it that
owns the state and composes `MacWindowManager` + `DesktopShell`, one `MacApp`
per simulated application, their windows (`FinderWindow`, `ChooserWindow`,
`WindowChrome`+`MacToolbar`, …), and one `MacAppDock`. Product state and
fixtures live outside `lib/mac-chrome/`.

Every new prototype includes two starter routes. Open `/showcase` first when
discovering components or auditing mac-chrome: it is the interactive coverage
surface for every runtime export. Keep `/example` as the small, coherent
starter surface for product work. The template launcher links both routes.

## Compose from the standard library

`mac-chrome` is a composition-first, 80/20 library, not only a collection of
finished demo windows. Start product surfaces with its primitives, then use
the finished windows as recipes when their interaction model fits. The
canonical public contracts are in `packages/mac-chrome/README.md`; do not
copy a showcase layout or private component into product code.

| Need | Use | Native precedent |
| --- | --- | --- |
| Desktop stage, app menus, status items | `DesktopShell` | menu bar + desktop |
| Windowed or menu-bar app identity, key-window focus, z-order, launch/restore/quit | `MacWindowManager` + `MacApp` (`presentation="windowed" | "menuBar"`) | `NSApplication` + `NSWindow` scene ownership |
| Managed app launcher and running state | `MacAppDock` + typed `DockIcon` / `MacDockAppIcon` | Dock tile |
| Standalone decorative Dock | `MacDock` | Dock-like launcher without app lifecycle |
| Two- or three-column navigation | `MacNavigationSplitView` | `NavigationSplitView` |
| Supplementary metadata or controls | `MacInspector` beside the split view | inspector / preview pane |
| Sectioned sidebar navigation | `MacSourceList` | `List(.sidebar)` / source list |
| Selectable rows | `MacList` | `List` |
| Collapsible grouped detail | `MacDisclosureGroup` | `DisclosureGroup` |
| Buttons, fields, toggles, segmented choices, forms | `MacButton`, `MacTextField`, `MacToggle`, `MacSegmentedControl`, `MacControlGroup`, `MacForm`, `MacFormSection`, `MacLabeledContent` | standard AppKit / SwiftUI controls |
| No-content state | `MacContentUnavailable` | `ContentUnavailableView` |
| Window-local status and system decisions | `MacWindowStatusBar`, `MacAlert`, `MacSheet` | window status area, `.alert`, `.sheet` |
| Commands and anchored choices | `MacMenu`, `MacDetailsMenu`, `MacPopover` | `NSMenu` / `NSPopover` |
| A complete Finder, chooser, setup flow, or chat window | `FinderWindow`, `ChooserWindow`, `SetupAssistant`, `ChatWindow` | recipes composed above the primitives |

`MacNavigationSplitView` has either two columns (sidebar + detail) or three
navigation columns (sidebar + content + detail). Its optional middle column
represents a selection hierarchy. `MacInspector` is deliberately a separate,
supplementary trailing pane; do not treat it as the third navigation column.

Use the managed app layer for every multi-window desktop. `MacApp` stays
mounted so closing or minimizing a window does not destroy its product state;
`MacAppDock` launches, restores, and activates from the same registry.
`WindowChrome` registers itself with the enclosing app. It owns key-window
focus, click-to-front, traffic lights, contained dragging, ResizeObserver
recontainment, and the default eight-edge resize affordances. Multiple windows
in one app must have distinct stable `windowId` values; the single-window
default is `${appId}:main`. Use `resizable` and `minSize` on `WindowChrome`
instead of recipe-local geometry. Every full-window recipe composes it and
must not override `.mac-window` positioning. Do not manage product windows by
conditional rendering plus local z-index counters.

Use the default `presentation="windowed"` for an app with managed windows and
a Dock tile. Use `presentation="menuBar"` for an app whose visible surface is
a `MenuBarExtra`; it remains registered but is intentionally omitted from the
Dock. Status feedback belongs in `MacWindowStatusBar` inside the owning
window. A Dock launch should activate a registered app/window, not write a
description of the Dock item into an unrelated app's status bar. A menu-bar
app uses `MacAlert presentationScope="desktop"` for a system decision so it
never attaches to an unrelated key window. If the decision originates in a
`MenuBarExtra` popover, control it with `isOpen`/`onOpenChange` and a stable
`triggerRef`, close it, then open the desktop alert; this lets the shared
modal host clean up background isolation and restore status-trigger focus.

The Dock owns icon normalization. Pass a typed `DockIcon` where possible:
asset artwork retains its own safe area, while generated symbol artwork is
drawn in the shared tile and glyph boxes. Do not create a local 50px tile,
wrap it in a Dock item, or tune one app icon with ad-hoc scale CSS — that
breaks the shared optical-size contract.

The library deliberately does not promise full SwiftUI parity. Tables,
outline views, grid collections, and other specialized patterns stay
out until there is a demonstrated product need. Liquid Glass is explicitly
not a default capability. Use the restrained material tokens rather than
attempting to simulate a system compositor.

### Promote a pattern deliberately

Promote repeated product UI into `mac-chrome` only when it has a real native
counterpart and a reusable contract: documented accessibility and keyboard
behavior, responsive behavior, focused tests, and a working `/showcase`
example. Prefer evidence from two independent consumers before promotion. A
one-off product layout remains product code; a close-but-not-identical native
pattern is a design question, not an excuse for another local component.

## Invariants

These exist because their violations are exactly what made past prototypes
slow to work on (a 9,400-line globals.css with 1,094 hard-coded colors):

- **Tokens or nothing.** Every color, radius, blur, and shadow goes through
  `lib/mac-chrome/styles/tokens.css`. `--accent` (system blue) styles
  controls and focus; `--brand` (product color) styles identity only.
- **One CSS file per component/surface.** Never a shared growing global
  stylesheet. Do not add `backdrop-filter` recipes to the default chrome.
- **The chrome package never imports product code.** Product → chrome only.
- **Icons come in three tiers.** SF-style glyphs: `SystemSymbol`, backed by
  typed `symbolist` private-use codepoints and the macOS system SF font at
  render time. The template's `SFSymbol` is a deprecated compatibility alias;
  new chrome code imports `SystemSymbol`. Do not draw or ship bespoke SVG
  approximations of SF Symbols. This path intentionally depends on a Mac
  client resolving the installed system font. Third-party brand marks (Drive,
  Notion, GitHub…):
  `simple-icons` via the `BrandIcon` wrapper — committable. Verify the slug
  exists — `BrandIcon` warns in dev on unknown slugs; brands missing from
  simple-icons (Slack and Salesforce are absent from v16) fall back to the
  private-assets tier. Chrome icon slots render aria-hidden, so `BrandIcon`
  titles carry no accessible name there — test icons by data attribute, not
  role. Apple-system lookalikes (Finder/Safari dock icons, wallpapers):
  private local assets hydrated at creation time, never committed. Hydration
  gets the local system app/folder/trash icons and Tahoe Day wallpaper; its
  output stays ignored. **No
  Apple-owned assets in any repo** — no SF Pro font files, no exported SF
  Symbol SVGs, no macOS app-icon bitmaps.
- **No Unicode stand-ins for system glyphs** (`▦ ☷ ⌕` etc.) — SVG or
  symbolist only.
- **Fidelity before effect.** Default chrome to restrained opaque or
  near-opaque system materials with a hairline and a subtle system-like
  shadow. Do not emulate Liquid Glass or introduce custom
  `backdrop-filter`/saturation recipes unless the owner explicitly asks for
  that experiment. Menus and status popovers must remain legible over any
  wallpaper.
- **One menu/popover system.** `MacMenu` owns compact 13px/24px command rows;
  `MacPopover` owns arbitrary anchored content with named layout and content
  inset choices. `MacDetailsMenu` composes the latter for an account-style
  summary trigger. Do not conflate commands with content popovers or add
  bespoke overlays/native `<details>` controls; they skip the shared
  dismissal, focus, and geometry contract.
- **One presentation host.** Use `MacSheet` for an attached task with owned
  title/body/actions/insets and `MacAlert` for a short system decision. Pass
  `MacDialogAction` data (semantic `cancel`/`destructive` role plus independent
  `isDefault`) rather than authoring a button row inside a sheet. The legacy
  `Sheet` is compatibility-only; `SetupHeading` is recipe artwork, not a
  general dialog API.
- **One disclosure contract.** Use `MacDisclosureGroup` for grouped detail and
  `MacSourceList` for navigable sidebar sections. The shared indicator is a
  `SystemSymbol`; source-list section headers are structural, never selection
  destinations. Do not draw chevrons in CSS or animate a reveal by scaling it.
- **Chrome earns its controls.** Reusable toolbar commands have matching
  functional menu commands. The current app appears as a running Dock item;
  default windows remain clear of the menu bar and Dock, including at small
  viewports. Size explicit frames against the desktop canvas with `%`, not
  `vw`/`vh`; the shell contracts below its 1200px reference width and an
  initial window must be wholly visible without horizontal scrolling.
- **One app/window lifecycle.** A desktop with multiple simulated apps uses
  `MacWindowManager`, `MacApp`, managed `WindowChrome`, and `MacAppDock`.
  Click-to-front, key-window state, close/minimize/zoom, Window-menu commands,
  and Dock restoration must all resolve through that registry.
- **Compose before styling.** Use the shared navigation, source-list, list,
  disclosure, form, control, menu, and content-state primitives before
  writing a local layout or control. Product CSS may arrange a surface around
  those primitives; it must not reimplement their selection, focus,
  keyboard, or optical-geometry contracts.
- If a house TypeScript-standards skill is loaded in this environment, it
  governs prototype code too; this skill adds prototyping-specific rules,
  it does not waive house ones.

## Verify like a user, then audit

1. After a change: run the prototype's tests, then look at the real thing —
   screenshot or click the changed flow at the served URL. Automate
   multi-path checks (Playwright/console) instead of hand-stepping. For
   component discovery or a broad chrome audit, begin at `/showcase` before
   checking the product surface.
2. Deploy/serve first and share the URL; reviews run after, not before.
3. For direction decisions, new surfaces, or a final pass, convene the
   `mac-design-audit` agent with exactly: the pattern rubric, the diff or
   surface, the live URL, and current screenshots. The agent ships with this
   plugin; if it isn't installed, give a general-purpose agent
   `references/mac-pattern-rubric.md` plus those same inputs. One audit + one
   re-verify round; findings it can't prove live are hypotheses, not blocks.
   With no owner to send a URL to and no audit agent (CI, cold-start
   sessions), the loop degrades to: serve → DOM/content checks against the
   served pages → a rubric self-pass; screenshots optional. The showcase must
   dogfood public primitives, demonstrate both windowed and menu-bar apps, and
   cover window containment/focus/resize plus attached and desktop modal
   scopes. Do not fix a catalog defect with story-local geometry, padding, or
   icon code.
4. Keep found-issue continuity in the prototype's `REVIEW-LEDGER.md`, not in
   long-lived reviewer conversations — one line per finding
   (date · finder · [Pn] finding — file:line → resolution):

   ```text
   2026-08-11 · mac-design-audit · [P1] centered two-line toolbar title — app/files/page.tsx:24 → left-aligned single line
   2026-08-11 · owner · [P2] glass on content background — app/files/files-surface.tsx:58 → blur moved to toolbar capsule
   2026-08-12 · self · [P3] Unicode ⌕ in search bubble — app/files/files-surface.tsx:71 → SystemSymbol magnifyingglass
   ```

## When a rule fights you

These rules encode one team's decisions, not physics. If an invariant blocks
the obvious path, or host specifics (ports, launchd, Tailscale) don't match
this machine, say so and ask the owner rather than silently working around
it — and record the resolution in the project's own docs.
