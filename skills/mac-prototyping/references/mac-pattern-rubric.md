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
[Composition](#composition--split-view-semantics) · [Controls](#control-roles--emphasis) · [Sidebar](#sidebar--source-list) ·
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
- Every visible non-title item is traffic-light chrome, navigation/search, an
  actionable command or menu, an exclusive-selection control, or genuine
  status. Decorative glyphs, bare prose, and implementation labels such as
  “Toolbar” or “Controls” have no `NSToolbarItem` counterpart and are P1.
- Inventory each toolbar descendant during review: accessible name, role,
  action, state, and the matching menu command when the item represents a
  reusable command rather than transient input or status. An enabled item
  must activate observable behavior; omit unconfigured actions instead of
  shipping inert chrome. “Window contents need not function” never exempts
  window chrome.
- Use one explicit 14–16px optical box for toolbar glyphs inside 28–30px
  controls. Browser-dependent SVG sizing or mixed icon weight is a defect.
- Finder-style persistent view modes follow Finder’s `NSSegmentedControl`
  pattern: clearly divided segments with exactly one visible selection, or a
  single View menu. An ambiguous undivided icon capsule is P1.
- Fidelity beats simulated material effects. Use restrained opaque or
  near-opaque toolbar and capsule surfaces with hairlines and subtle shadows;
  never add custom blur, saturation, or Liquid Glass recipes unless the owner
  explicitly asks for that experiment. The effect must not compete with the
  iconography or reduce contrast.
- A command dropdown or anchored toolbar disclosure is `NSMenu`/`NSPopover`:
  use the shared menu/popover primitive, its focus and dismissal behavior, and
  compact native geometry. A local `<details>` widget or bespoke overlay is a
  P1 even if its contents happen to look correct.

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
  placement defect — verify with live geometry at normal and small viewports,
  never from the code.

## Composition & split-view semantics

(Precedent: SwiftUI `NavigationSplitView`, `List`, `DisclosureGroup`, `Form`,
and `.inspector`.)

- Start with the matching shared mac-chrome primitive. A local source-list,
  selectable list, disclosure, standard control, form row, empty state, menu,
  or Dock tile is a P1 when the library already owns that native pattern.
  Product composition may arrange primitives and supply content; it must not
  duplicate their focus, keyboard, selection, dismissal, or optical-size
  contracts.
- A navigation split has two columns (sidebar + detail) or three navigation
  columns (sidebar + content + detail). The middle column earns itself by
  representing a real selection hierarchy; it is not a convenient place for
  metadata or settings.
- An inspector is a separate supplementary trailing pane. Do not call a
  sidebar + detail + inspector layout a three-column navigation split, and do
  not make an inspector stand in for the content column.
- Inspect a responsive split live: columns respect reasonable min/max widths,
  dividers are visibly resizable and keyboard-operable, and small viewports
  retain an intelligible hierarchy rather than compressing all columns into
  unreadable strips.
- Product UI must not silently import a showcase-local component or duplicate
  showcase styling. `/showcase` is evidence that public primitives compose;
  it is not a private component source.

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
- `NSMenu` command menus are compact: compact row height, padding, type scale,
  icon box, separators, and a modest content-width popover — never an
  oversized card. They use an opaque or near-opaque material, not a glassy
  page overlay. Where the current macOS Apple menu presents a row icon, retain
  that row icon in the prototype; the Apple-menu active state is a compact
  menu-title selection, not a large decorative tile.
- `NSStatusItem`/`MenuBarExtra` popovers reset foreground color and
  `text-shadow` inside their surface so menu-bar white text cannot inherit
  into a light popup. Audit an open status popover, not only its trigger.
- Omitted date and clock props show a live host-local macOS-style date and
  clock. Omitted Dock items show Finder, App Store, Google Chrome, Downloads,
  and Trash, using ignored private hydrated assets when available.
- A showcase is an app in this desktop: give it a distinct, running Dock item
  in addition to the default system set.
- Audit Dock icons as one optical system, not just equal CSS dimensions. Each
  item enters through `MacDockAppIcon`: hydrated asset art retains its safe
  area, while generated art uses the shared tile/glyph geometry. A nested
  custom 50px tile, per-icon `transform: scale`, or one icon that is visibly
  larger than its neighbors is P1.

## Control roles & emphasis

- Exactly one emphasized (default) button per surface — the primary action;
  Back/secondary actions are regular weight. (HIG button roles.)
- Standard buttons, fields, toggles, segmented choices, control groups, form
  rows, and unavailable-content states use their shared primitives. Styling a
  raw browser input until it looks close is insufficient when it drops the
  shared accessible name, disabled, validation, focus, or keyboard contract.
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
- A reusable sidebar is `MacSourceList`, not a hand-built column of buttons.
  Audit arrow navigation, typeahead, selection, and controlled collapsible
  sections in addition to its source-list anatomy.

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
- `MacInspector` is supplementary content owned by the enclosing surface.
  Its visibility, width, toolbar/View-menu command, and persistence policy
  must agree where the product exposes them; the primitive does not invent
  those policies automatically.

## Grid & empty states

- Empty-state and call-to-action tiles are grid citizens: normal grid-item
  size, dashed boundary, drag-active highlight, understated copy. An action
  tile must never be visually louder than real content.
- Drop targets are generously sized (~150px+, not a thin strip).
- A simple unavailable-content state uses `MacContentUnavailable`; do not
  create a competing oversized landing-page hero inside a list/detail pane.

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
