# macOS pattern rubric

The checklist a macOS-style surface is judged against. Each rule names the
native precedent it comes from; a violation is a finding only when the
precedent applies. Distilled 2026-08 from a corpus of design audits whose
findings the owner accepted; revise when macOS conventions move.

**The first question.** Every surface and control names the SwiftUI/AppKit
component it imitates (NavigationSplitView, List(.sidebar), NSToolbar,
NSMenu, Inspector, .sheet…). A surface that cannot name its native
counterpart is presumed non-native until it can; an auditor's first question
about any surface is "which native component is this, and does its anatomy
match?"

Contents: [Toolbar](#toolbar-anatomy) · [Windows](#window-roles--chrome) ·
[Menu bar](#menu-bar) ·
[Controls](#control-roles--emphasis) · [Sidebar](#sidebar--source-list) ·
[Preview/inspector](#preview--inspector) · [Grid & empty states](#grid--empty-states) ·
[Creation windows](#creation-window-precedents) · [Keyboard & a11y](#keyboard--accessibility) ·
[Animation](#animation--transition-discipline) · [Content semantics](#content-semantics)

## Toolbar anatomy

(Precedent: Finder, macOS 26/27.)

- One horizontal toolbar: history/back-forward capsule → left-aligned
  single-line title → independent utility capsules → search as a compact
  right-side bubble that expands on focus.
- No subtitle or item count under the title; a centered title — one line or
  two — reads as web, not Mac. The title is always leading-aligned.
- Toolbar glyphs are SVG/system symbols, never Unicode approximations.
- Glass (blur + translucency) lives in the toolbar capsules and chrome, not
  in content areas.

## Window roles & chrome

- A standalone window keeps traffic lights. Hide a heavy titlebar *strip*
  rather than going borderless; borderless loses expected window behavior
  (movable-by-background remains Apple guidance).
- One shared desktop/window shell per app — a flow (onboarding, chooser)
  enters the same environment, never a second simulated desktop.
- Window size signals role: creation/utility windows sit near 820×520; a
  1100×570 window with a centered 760px column and hero art reads as a
  marketing page, not a Mac window.
- Never mix window models in one surface (template chooser + Settings
  list-detail + marketing hero + wizard footer is the classic collision).
- Default placement: horizontally centered, biased slightly above vertical
  center, title bar below the menu bar and clear of the Dock; a window
  flush to a canvas edge, under chrome, or off-center at rest is a
  placement defect — verify with live geometry, never from the code.

## Menu bar

- By default, `DesktopShell` supplies Apple and app menus plus functional
  File/Edit/View/Window/Help menus. A caller that deliberately supplies
  `menuItems` owns that post-app-menu list; standard titles retain their
  built-in menus and `MenuBarMenu` objects customize or replace them.
- While a menu is open, pointer-hover switches menus; Left/Right moves between
  menu titles; Tab/Shift-Tab dismisses and advances focus; Escape and an
  outside press dismiss.
- Menu rows show native shortcut and disabled anatomy where those fields
  apply. Every enabled action has `onSelect`, `href`, or the shell's
  `onMenuAction` command target. The Apple mark and Battery, Wi-Fi, and
  Control Center status glyphs are self-contained SVGs; do not recreate Wi-Fi
  with CSS arcs.
- Omitted date and clock props show a live host-local macOS-style date and
  clock. Omitted Dock items show Finder, App Store, Google Chrome, Downloads,
  and Trash, using ignored private hydrated assets when available.

## Control roles & emphasis

- Exactly one emphasized (default) button per surface — the primary action;
  Back/secondary actions are regular weight. (HIG button roles.)
- Choices that are not navigation are not tabs: auth methods, options, and
  modes present as one preferred path plus subordinate alternates, never as
  `aria-pressed` tab rows.
- Secondary escape hatches ("Other ways to start…") are borderless commands
  or pull-downs, never a peer card beside the primary choices.
- All options in one chooser share one axis — never mix data domains,
  creation methods, and escape hatches as visual peers.

## Sidebar / source list

- The sidebar is full-height translucent source-list material, visually
  distinct from the content area.
- Rows are ~28px with a 6px-radius tinted selection; sections separate by
  spacing, not dividers.
- Section labels are quiet and small, their disclosure revealed on hover —
  never persistent web-style disclosure boxes.
- Special items are distinguished by icon, not by dividers.
- Add flows anchor a menu on the section's add control (NSMenu pattern) —
  never in-place content replacement that acts like hidden navigation.
- Identity headers sit flat on the sidebar material: ~32×32 mark, 14px
  semibold title, 11px secondary line; no card, border, shadow, or
  selection state.
- Prefer a flat list with per-item badges over introduced grouping levels.
- Clicking an item navigates; disclosure is the secondary affordance.

## Preview / inspector

(Precedent: Finder Preview pane.)

- Show/Hide toggle in the toolbar, a View-menu item, ⇧⌘P; per-window
  persisted visibility and width; resizable divider, drag-fully-closed
  allowed; the content grid reflows when hidden.
- Metadata is quiet secondary content — an always-expanded metadata block
  consuming a quarter of the window styled as primary content is a defect.
- Label semantics are load-bearing: "Size" shows bytes only; use Items /
  Source / etc. otherwise — in Preview and in list-view columns. (FinderWindow's
  list columns are currently fixed at Name/Modified/Size — an API limitation,
  with a columns override as a follow-up — so don't flag that unreachable half
  as a prototype defect.)
- Disclosure chevrons appear only where a real expand/collapse exists.

## Grid & empty states

- Empty-state and call-to-action tiles are grid citizens: normal grid-item
  size, dashed boundary, drag-active highlight, understated copy. An action
  tile must never be visually louder than real content.
- Drop targets are generously sized (~150px+, not a thin strip).

## Creation-window precedents

- Precedents are composites to borrow mechanisms from, never layouts to
  clone: Pages/Numbers contribute creation-first launch; Xcode the wizard
  footer and option pages; Shortcuts the gallery; System Settings
  list-detail; Obsidian the "define the container concept" opening;
  Migration Assistant the guided first-run.
- Scale the pattern to the catalog: a category sidebar is earned by
  Pages-scale template counts; at a handful of templates use a featured
  filmstrip plus a "Browse All…" expansion of the same window.
- Thumbnails must preview *this product's* outcome. Pages shows the
  document because documents are visual; if the artifact isn't visual, show
  what will happen, don't fake a document.
- Global commands (Open…, Account, Sign In) live in chrome outside the
  selection workflow, not as workflow steps.

## Keyboard & accessibility

- Menus: one roving focus target; open-menu descendants leave the Tab
  sequence; Esc/Tab/arrows/Home/End all handled; Left/Right moves among
  menu-bar titles and Tab/Shift-Tab dismisses before focus advances.
- Grids: ArrowUp/Down move by the active column count; boundary clamping
  stays in-column; no modulo wrap into adjacent columns.
- Dialogs/sheets contain focus (it never escapes to BODY); Cancel unwinds
  exactly one layer; focus restores to the invoking control on close.
- `tabIndex` is never coupled to selection state — a hidden or secondary
  selection must not make controls keyboard-unreachable.
- Verify at small viewports and with Reduce Motion; activation under
  Reduce Motion still restores focus and announces.

## Animation & transition discipline

- A state change is one coordinated transition of persistent elements —
  never unmount-here/mount-there (reads as a page reload), never several
  simultaneous competing animations.
- No artificial pre-commit delays; drops and clicks commit immediately.
- Never animate layout-forcing properties (heights) per-frame across a
  grid; measure destination geometry after layout settles; one short
  (~160ms) transform owns the moving element.

## Content semantics

- Feeds are consistently ordered and timestamps respect causality
  (approval precedes release).
- Icon direction encodes action direction (outbound submission points
  up/out, not download-down); canonical type icon first, personalization
  layered smaller.
- Names and hierarchy make the use case legible at the root — no generic
  bucket folders in a demo meant to tell a story.
