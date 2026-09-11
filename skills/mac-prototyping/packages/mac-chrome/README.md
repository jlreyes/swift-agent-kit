# mac-chrome — API reference

macOS-window chrome and a small composition-first standard library for React
prototypes. It provides managed app/window lifecycle, desktop chrome,
navigation, collections, forms/controls, commands, and four product-window
recipes (Finder, Chooser, Setup Assistant, Chat). Signatures below are copied from source. Every
component imports its own stylesheet, so importing a component is enough;
`styles/index.css` remains as the one-shot import for consumers who prefer a
single global stylesheet.
Vendoring rules — the rsync and its excludes — live in the skill's
`references/workflows.md`.

Two runtime dependencies (exact-pinned here and in the template) supply
behavior this package should not own: **react-aria-components** (menus,
source lists, lists, disclosures, and controls — their ARIA keyboard, focus,
selection, and dismissal semantics) and **react-resizable-panels** (the
navigation split's ARIA window-splitter separators). The visual layer —
classes, tokens, CSS anatomy — stays ours; the libraries are wired through
their className/data-attribute APIs.

Each component names its SwiftUI/AppKit counterpart (**maps to:**). Build
against the counterpart's anatomy; a component with **no native counterpart**
is flagged as such — treat reaching for one as a design-drift alarm.

Windows are **draggable and resizable by default**: any surface inside the window marked
`[data-window-drag-handle]` (every `MacToolbar` and each product window's
title-bar row already is) drags the window; interactive elements and anything
under `[data-no-window-drag]` are excluded. Windows also get **default
geometry** — a per-surface size, centered on the canvas — overridable via the
`frame` prop. Traffic lights are functional by default (hover reveals the
glyphs; close/minimize/zoom work) — see `WindowChrome` and `TrafficLights`.

## Exports (`index.ts`)

Values: `DesktopShell`, `fixedDesktopReviewViewport`, `macBookAirM1DisplaySize`, `useDesktopSpace`, `getElementScale`, `viewportPointToLocal`, `viewportDeltaToLocal`, `MacWindowManager`, `MacApp`, `MacAppDock`, `useMacWindowManager`, `MacEmbeddedPresentation`, `TrafficLights`, `useWindowDrag`, `WindowChrome`, `defaultDockItems`, `MacDock`, `MacDockAppIcon`, `SystemSymbol`, `MacToolbar`, `ToolbarButton`, `ToolbarCapsule`, `ToolbarGlyph`, `ToolbarSearchBubble`, `ToolbarToggle`, `MacDetailsMenu`, `MacMenu`, `MacPopover`, `MenuBarExtra`, `useModalFocusTrap`, `MacNavigationSplitView`, `MacInspector`, `MacSourceList`, `MacList`, `MacDisclosureGroup`, `MacButton`, `MacTextField`, `MacSearchField`, `MacToggle`, `MacSegmentedControl`, `MacControlGroup`, `MacForm`, `MacFormSection`, `MacLabeledContent`, `MacContentUnavailable`, `MacWindowStatusBar`, `MacAlert`, `MacSheet`, `Sheet` (legacy), `FinderWindow`, `finderKeyTarget`, `QuickLook`, `ChooserWindow`, `createStoredIdList`, `SetupAssistant`, `SetupHeading`, `ChatWindow`.
Types: `DesktopShellProps`, `FixedDesktopReviewViewport`, `MacDisplaySize`, `DesktopSpace`, `DesktopPoint`, `MacEmbeddedPresentationProps`, `MenuBarMenu`, `MenuCommand`, `MobileReviewMode`, `MacAppDefinition`, `MacManagedApp`, `MacManagedWindow`, `MacWindowThumbnail`, `MacAppPresentation`, `MacWindowManagerValue`, `MacWindowState`, `WindowFrame`, `WindowMobilePresentation`, `WindowSize`, `DockIcon`, `DockIconSource`, `DockItem`, `MacDockAppIconProps`, `SystemSymbolName`, `ToolbarGlyphName`, `MenuAction`, `MenuEntry`, `MacPopoverContentInset`, `MacPopoverLayout`, `MenuPopoverConfig`, `MenuSpec`, `MacNavigationColumnSizing`, `MacNavigationSplitViewProps`, `MacInspectorProps`, `MacSourceListItem`, `MacSourceListSection`, `MacSourceListProps`, `MacListRow`, `MacListSection`, `MacButtonVariant`, `MacToggleStyle`, `MacSegment`, `MacAlertAction`, `MacAlertActionRole`, `MacAlertPresentationScope`, `MacDialogAction`, `MacDialogActionRole`, `FinderEntry`, `FinderSearch`, `FinderSelection`, `FinderViewMode`, `SidebarItem`, `SidebarSection`, `ChooserChoice`, `ChooserCommand`, `ChooserCommandSection`, `ChooserSecondaryGroup`, `StoredIdList`, `SetupStep`, `ChatAuthor`, `ChatComposer`, `ChatMessage`, `ChatRole`, `ChatSearch`, `Conversation`.

The template's `/showcase` route is the canonical interactive catalog for
public building blocks and their main compositions against a working desktop
shell. Some helpers and recipe-specific or legacy APIs are exercised only
indirectly through those stories or through tests. Use the catalog to inspect
composition and interactions; use `/example` as the concise product starter.

Chrome favors faithful, restrained system materials over effect work. Menus,
status popovers, and toolbar capsules are opaque or near-opaque, compact, and
legible over the wallpaper; do not layer custom blur or saturation recipes on
top. Use `MacMenu` for command menus and `MacDetailsMenu` for anchored
disclosures rather than a local overlay or `<details>` control: the shared
primitives own focus, Escape/outside dismissal, and native-sized geometry.

## Compose a surface

Use the primitive that owns a native interaction contract rather than copying
catalog markup or rebuilding its CSS in product code. `/showcase` is the
canonical interactive catalog: it exercises these public primitives together
inside a desktop shell. The finished `FinderWindow`, `ChooserWindow`,
`SetupAssistant`, and `ChatWindow` are recipes layered above this foundation,
not the only way to build an app.

| Product need | Public primitive | Notes |
| --- | --- | --- |
| Windowed or menu-bar app identity and lifecycle | `MacWindowManager` + `MacApp` + `MacAppDock` | `presentation="windowed"` gets Dock/window lifecycle; `presentation="menuBar"` composes a status item without a Dock tile. |
| Fixed, bounded presentation embedded in chat | `MacEmbeddedPresentation` | Bounds caller-composed content; it does not enable dragging or resizing. |
| Sidebar/detail or sidebar/list/detail navigation | `MacNavigationSplitView` | Two or three **navigation** columns. |
| Supplementary metadata / settings | `MacInspector` | Separate trailing pane, not a third navigation column. |
| Sidebar source list | `MacSourceList` | Controlled row selection, optional selectable titled sections, and controlled collapsible sections. |
| Selectable rows | `MacList` | Single selection, sections, row actions, and accessories. |
| Expand/collapse detail | `MacDisclosureGroup` | Controlled expansion. |
| Standard controls and structured settings | `MacButton`, `MacTextField`, `MacSearchField`, `MacToggle`, `MacSegmentedControl`, `MacControlGroup`, `MacForm`, `MacFormSection`, `MacLabeledContent` | Use their built-in ARIA controls rather than local equivalents. |
| No-content state | `MacContentUnavailable` | Optional system-style icon, description, and actions. |
| Window feedback and modal decisions | `MacWindowStatusBar`, `MacAlert`, `MacSheet` | Status bar, short alert, or attached modal task. |
| Dock artwork | `MacDockAppIcon` + `DockIcon` data | One shared optical-size contract. |

This is intentionally an 80/20 library, not a web reimplementation of all
SwiftUI. Tables, outline views, grid collections, and full SwiftUI
parity are deferred until a reusable need proves them out. Liquid Glass is not
an offered material mode; use the existing opaque or near-opaque tokenized
materials.

### MacEmbeddedPresentation
maps to: a contained Mac desktop presentation; no direct SwiftUI counterpart.
`MacEmbeddedPresentation({ children, height = 640, menuBar = false, windowManagement = false }: { readonly children: ReactNode; readonly height?: number; readonly menuBar?: boolean; readonly windowManagement?: boolean })`

Use this as the outer boundary for a Mac surface embedded in a bounded host,
such as a chat preview. By default it presents supplied `WindowChrome`
children as fixed static surfaces with a 12px surround and inert visual traffic
lights: it
does not create a window or offer dragging, resizing, a Dock, or managed
window state. `menuBar` reveals menus supplied by a child `DesktopShell`.
The embedded surface sets `--accent` and `--muted` locally so host root values
cannot recolor Mac controls; customize those two tokens on
`.mc-embedded-presentation`, while ordinary root token customization remains
available outside the embedded surface.

Set `windowManagement` only when a prototype needs managed close, minimize,
restore, zoom, desktop insets, and a Dock. The presentation is only the
bounded context and host: it does not render a manager, shell, app, or Dock.
Its children must compose `MacWindowManager`, `DesktopShell`, `MacApp`, and
`MacAppDock` when that behavior is wanted. A multiple-window or
managed-desktop demo commonly enables both `windowManagement` and `menuBar`.

Menus and popovers must use the presentation's scoped host so they remain
inside the bounded surface. React Aria's modal isolation is still
document-wide; do not claim that an iframe changes that behavior.

### DesktopShell
maps to: the macOS menu bar + desktop (NSApplication main menu / NSStatusBar region); no single SwiftUI view — it is the app's stage, not a window.
`DesktopShell({ appName, displaySize = macBookAirM1DisplaySize, menuItems = defaultMenuItems, appleMenuItems, appMenuItems, onMenuAction, canPerformMenuAction, date, clock, menuBarExtras, mobileReviewMode, wallpaper, children }: DesktopShellProps)`
`interface DesktopShellProps { readonly appName: string; readonly displaySize?: MacDisplaySize | "viewport"; readonly menuItems?: readonly (string | MenuBarMenu)[]; readonly appleMenuItems?: MenuSpec; readonly appMenuItems?: MenuSpec; readonly onMenuAction?: (command: MenuCommand) => void; readonly canPerformMenuAction?: (command: MenuCommand) => boolean; readonly date?: string; readonly clock?: string; readonly menuBarExtras?: ReactNode; readonly mobileReviewMode?: "fixed-desktop"; readonly wallpaper?: string; readonly children: ReactNode }`
`type MenuBarMenu = { readonly title: string; readonly items: MenuSpec }`
`type MenuCommand = { readonly menu: string; readonly id: string; readonly label: string }`
- The shell always provides functional Apple and app menus; use
  `appleMenuItems` or `appMenuItems` to replace either menu's default items.
  When `menuItems` is omitted, it supplies File, Edit, View, Window, and Help.
  When provided, its array is the exact post-app-menu list: standard string
  names resolve to their built-in menus, while `MenuBarMenu` objects customize
  or replace menus with product commands.
- An action with `onSelect` or `href` owns its behavior. A handler-less action
  is enabled only when `onMenuAction` is present **and**
  `canPerformMenuAction` returns `true` for its `{ menu, id, label }` command.
  Use the resolver to name the commands this app supports; a dispatcher alone
  does not enable every menu row. `disabled: true` remains disabled, and
  `disabled: false` cannot enable an otherwise unsupported action. Managed
  window and lifecycle commands keep their own handlers and do not need the
  resolver.
- An active menu switches when its title is hovered. Left/Right moves between
  menu titles; Tab/Shift-Tab dismisses it and advances focus; Escape and an
  outside press dismiss it. When a menu was opened from an active sheet or
  alert, dismissal returns focus to a valid control in that modal unless focus
  intentionally moved to another window. The Apple mark and the Battery, Wi-Fi,
  and Control Center glyphs use the shared typed `SystemSymbol`/SF Symbols
  pipeline.
- Omit `date` and `clock` for a live host-local macOS-style date and clock.
- `menuBarExtras`: `MenuBarExtra` elements rendered **in flow** next to the status items, so they can never overlap the clock/date. A `MenuBarExtra` rendered outside this slot falls back to absolute positioning at `--mc-menubar-extra-right` (default `177px`) — set that var when composing standalone extras against non-default status text.
- `wallpaper` takes a CSS image value (`url(...)`, gradient, `var(...)`) or a bare image URL. Default: `/mac-assets/wallpapers/tahoe.jpg`; without hydrated assets, it falls back to the original abstract SVG at `styles/wallpaper.svg` (referenced from `styles/base.css`; replace the prop, not the file).
- `displaySize` selects the desktop's logical CSS-point coordinate space. Its default,
  `macBookAirM1DisplaySize`, is 1440×900: a supported scaled mode for the M1
  MacBook Air, not its 2560×1600 physical panel and not a prevalence claim.
  Pass another positive finite `{ width, height }` or `"viewport"` for the
  responsive stage. Host resizing changes presentation fit, not saved logical
  window frames; changing the logical display can recontain them. The existing
  full-page shell treats `100dvh` as a height constraint, capping presentation
  width by the logical width, available width, and the available height times
  the logical aspect ratio. An embedded presentation uses its explicit height.
  No extra display-sizing prop is required.
- Logical points, panel pixels, DPR, browser page zoom, and visual-viewport
  pinch zoom are distinct. Pointer/client geometry crosses the canvas through
  the exported conversion helpers. Use percentages or container-relative
  layout for a logical desktop; `vw`, `vh`, media queries, and
  `window.innerWidth` still see the physical browser viewport.
- Menus and the Dock intersect the logical canvas with the visible visual
  viewport, then recompute on resize and scroll. Their placement therefore
  stays owned by the logical desktop while its browser presentation is panned
  or zoomed.
- This is a browser presentation contract. It does not establish behavior for
  physical macOS display-setting changes, which have not been tested.
- The default is the 1440x900 logical desktop. To review the legacy 1200x750
  Mac canvas on a phone or coarse-pointer browser, use both
  `displaySize="viewport"` and `mobileReviewMode="fixed-desktop"` outside
  `MacEmbeddedPresentation`. The browser then owns page pan and zoom. Pair the
  shell props with route-local viewport metadata compatible with
  `fixedDesktopReviewViewport`; do not apply that metadata in a root layout
  unless every route is a Mac desktop review surface.
- Inside `MacWindowManager`, File › Close Window and the standard Window
  menu target the key managed window. Window lists the current app's open or
  minimized windows and can restore them. The standard application menu's
  Hide, Hide Others, and Quit commands target the registered app lifecycle.
  Derive `appName` and app-specific menus from
  `useMacWindowManager().keyAppId` when the desktop hosts more than one app.

### MacWindowManager, MacApp, and MacAppDock
maps to: `NSApplication` plus SwiftUI `App`/`WindowGroup` scene ownership and the system Dock.
`MacWindowManager({ children, initialApps }: { readonly children: ReactNode; readonly initialApps?: readonly MacAppDefinition[] })`
`MacApp({ id, name, icon, defaultRunning = true, dockGroup = "apps", presentation = "windowed", children }: { readonly id: string; readonly name: string; readonly icon: DockIconSource; readonly defaultRunning?: boolean; readonly dockGroup?: "apps" | "places"; readonly presentation?: "windowed" | "menuBar"; readonly children: ReactNode })`
`MacAppDock({ extraItems = [], label = "Dock", onAppActivate }: { readonly extraItems?: readonly DockItem[]; readonly label?: string; readonly onAppActivate?: (appId: string) => void })`
`useMacWindowManager(): MacWindowManagerValue`

`initialApps` is an immutable boot manifest for managed app identity and Dock
entries. Define each `MacAppDefinition` once, pass the full manifest to
`MacWindowManager`, and spread the same definition into its `MacApp`. This
prepopulates SSR with the final app identities and Dock entries so they do not
appear or shift after `MacApp` registration effects.

`MacWindowManager` is the canonical desktop lifecycle owner. A managed
`WindowChrome` registers with its nearest `MacApp`; pointer presses raise it,
keyboard navigation into it can make it key, and programmatic focus
restoration does not reorder windows. Z-indices are derived from the bounded
visible stack instead of growing on every click. Closing or minimizing
preserves the application subtree, so state survives and `MacAppDock` can
launch, restore, or activate it. Managed minimization captures the actual
`WindowChrome` with `html-to-image`, moves it through a stable View Transition
into a separate `windows` Dock group, and keeps the app tile's running dot.
Selecting that thumbnail restores the same window and removes the thumbnail.
If capture fails, the manager supplies a normalized mini-window fallback.
Running dots are derived from the same app registry.

Keep app `id`, `name`, icon, and `defaultRunning` stable for a mounted
`MacApp`. A one-window app may omit `WindowChrome.windowId` and receives
`${appId}:main`; every additional window needs an explicit unique stable ID.
Windowed apps appear in `MacAppDock`; menu-bar apps stay registered but do not
get a Dock tile and should compose `MenuBarExtra` as their visible surface.
Use `MacDock` only for a standalone decorative launcher. Do not combine
managed windows with product-local z-index, running, or conditional-mount
state.

### TrafficLights
maps to: `NSWindow.standardWindowButton(.closeButton/.miniaturizeButton/.zoomButton)`.
`TrafficLights({ disabled = false, onClose, onMinimize, onZoom }: { readonly disabled?: boolean; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void } = {})`
Inside a `WindowChrome`, the three controls are functional with no props: hovering the cluster reveals the ×/−/+ glyphs on all three (macOS behavior), close hides the window, managed minimize captures and transitions it to the Dock's separate window-thumbnail group, and zoom toggles the frame against a near-canvas size. An explicit handler prop **overrides** the enclosing window's internal default for that control (the window no longer hides itself — the consumer owns the behavior). `disabled` renders all three as solid gray inert dots.

### useWindowDrag
maps to: `NSWindow.performDrag(with:)` / `isMovableByWindowBackground`.
`useWindowDrag<T extends HTMLElement>(enabled: boolean, handleSelector: string = "[data-window-drag-handle]")`
Returns `{ windowRef, style, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }` to spread onto the window element. Its `style` uses the individual CSS `translate` property, so a caller-owned `transform` remains independent in either spread order. Drag reachability uses the nearest `.desktop-canvas`, falling back to the viewport only when no canvas exists. Pointer-downs on `button/input/textarea/select/a/[role='button']/.traffic-lights/[data-no-window-drag]` never start a drag. Touch pointers also never start a simulated drag; the browser retains pan, pinch, and double-tap behavior.

### WindowChrome
maps to: `NSWindow` (titled, full-size content view); SwiftUI `Window`/`WindowGroup` scene.
`WindowChrome({ children, className = "", defaultOpen = true, defaultSize = genericDefaultSize, draggable = true, dragHandleSelector, frame, label, minSize = { width: 420, height: 280 }, mobilePresentation = "authored", resizable = true, style, windowId, onClose, onMinimize, onZoom, onDragEnter, onDragLeave, onDragOver, onDrop }: { readonly children: ReactNode; readonly className?: string; readonly defaultOpen?: boolean; readonly defaultSize?: WindowSize; readonly draggable?: boolean; readonly dragHandleSelector?: string; readonly frame?: WindowFrame; readonly label: string; readonly minSize?: WindowSize; readonly mobilePresentation?: "authored" | "maximized"; readonly resizable?: boolean; readonly style?: CSSProperties; readonly windowId?: string; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void; readonly onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragOver?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDrop?: (event: ReactDragEvent<HTMLElement>) => void })`
`type WindowFrame = { readonly top?: number | string; readonly left?: number | string; readonly width?: number | string; readonly height?: number | string }` — numbers are px; strings pass through as CSS.
`type WindowSize = { readonly width: number; readonly height: number }`
- **Default geometry**: `defaultSize` (generic `720x480`; each product surface passes its own) is applied as inline `width`/`height`, horizontally centered and biased slightly above vertical center. Any side set in `frame` wins; `style` merges over the computed placement (CSS-position a window by passing `top`/`left` there or in `frame`). In a logical desktop, these are logical points in the configured 1440×900 default (or the caller's `displaySize`); `displaySize="viewport"` opts into responsive viewport layout. A host fit changes presentation scale only and does not physically recontain saved logical frames. For responsive custom frames, use canvas-relative `%` expressions (`calc(100% - 24px)`), never `vw`/`vh`; viewport units can be wider than an embedded browser pane.
- **Draggable by default** via `[data-window-drag-handle]` surfaces.
- **Resizable by default** from all four edges and corners. `minSize` is the preferred floor; a smaller logical canvas wins so a positive, reachable frame remains even when it is smaller than the normal safe insets. Dragging, resizing, and `ResizeObserver` containment use the nearest desktop canvas; standalone viewport windows recontain on viewport resize. Initial layout capture excludes caller-owned transform/translate/rotate/scale, so those effects are not baked into geometry and reapplied. A logical display-size change cancels an active gesture before containment may update the frame. A measured presentation-scale change also cancels an active gesture, preserving saved logical geometry; begin a new gesture after either change. Set `resizable={false}` for intentionally fixed-size utility windows.
- **Phone-review presentation** defaults to `authored`, preserving the
  window's role and frame inside an opted-in fixed desktop. Use
  `mobilePresentation="maximized"` only for a content workspace that should
  occupy the available Mac canvas below the menu bar. Touch never starts
  simulated window dragging or resizing. The toolkit does not auto-center a
  window when focus changes, so the browser's current pan position survives.
- **Nested split-view observation**: the shared ResizeObserver compatibility adapter defers and coalesces only observations whose target is a `react-resizable-panels` `[data-group]` to the following task. Ordinary ResizeObserver delivery remains synchronous. This prevents the feedback cycle at its source; it does not suppress browser error events or hide unrelated failures. The package patch uses the rendered viewport extent as the pointer-drag denominator and cancels an in-flight split drag only when its measured display scale changes, so zoom or presentation scaling cannot apply a stale pointer anchor. Nested or simultaneous resizing continues normally. See `patches/README.md` for scope and removal criteria.
- **Window controls**: provides close/minimize/zoom to any `TrafficLights` inside (React context). Internal defaults always run — close hides, managed minimize captures the window and transitions it to a separate Dock thumbnail (reduced motion skips the animation), and zoom toggles the frame against `~canvas − margins`; the `onClose/onMinimize/onZoom` props are notifications alongside those defaults. Standalone windows retain the local ~220ms hide fallback. Managed windows keep the application subtree mounted and move through `open`, `minimized`, and `closed` registry states so the Dock, thumbnail, or Window menu can restore them.

### MacDock
maps to: the system Dock (`NSDockTile` per app); no SwiftUI counterpart — system UI.
`MacDock({ items, label = "Dock" }: { readonly items?: readonly DockItem[]; readonly label?: string })`
`type DockIcon = { readonly kind: "asset"; readonly src: string } | { readonly kind: "systemSymbol"; readonly name: SystemSymbolName; readonly background?: string; readonly foreground?: string } | { readonly kind: "artwork"; readonly artwork: ReactNode; readonly background?: string; readonly foreground?: string } | { readonly kind: "symbol"; readonly symbol: ReactNode; readonly background?: string; readonly foreground?: string }`
`type DockIconSource = DockIcon | ReactNode | string`
`type MacWindowThumbnail = { readonly src?: string; readonly width: number; readonly height: number }`
`interface DockItem { readonly id: string; readonly label: string; readonly icon: DockIconSource; readonly running?: boolean; readonly group?: string; readonly windowThumbnail?: MacWindowThumbnail; readonly viewTransitionName?: string; readonly onActivate?: () => void; readonly draggablePayload?: Readonly<Record<string, string>> }`
When `items` is omitted, the Dock shows Finder, App Store, Google Chrome,
Downloads, and Trash. The local icons hydrated into `public/mac-assets/` are
private assets: they are ignored and must never be committed.

`windowThumbnail` is a compact preview surface, not alternate app artwork.
`MacAppDock` creates those items for minimized managed windows in its own
`windows` group; other consumers may use the same contract for a decorative
Dock. Pair `viewTransitionName` with the source window only for a single,
stable moving surface; do not assign it ad hoc to unrelated items.

### MacDockAppIcon
maps to: an app's normalized `NSDockTile` artwork; no SwiftUI counterpart — system UI.
`MacDockAppIcon({ icon, label }: MacDockAppIconProps)`
`interface MacDockAppIconProps { readonly icon: DockIconSource; readonly label?: string }`
This is the Dock's shared optical-size boundary. Prefer typed `DockIcon`:
`asset` preserves a supplied app icon's intrinsic safe area, while
`systemSymbol` accepts a typed `SystemSymbolName` and lets `MacDockAppIcon`
construct and size the glyph. Use `artwork` only as the explicit escape hatch
for custom generated React artwork. Both generated forms use the 50px canvas
and 42px tile. A generated `SystemSymbol` uses size 20 in a centered 34×30px
glyph frame; SVG artwork uses a separate selector and stays at most 26×26px.
The old `symbol` object, bare `ReactNode`, and string shorthands remain
supported for compatibility; `symbol` and bare `ReactNode` are deprecated for
new code. Do not wrap a local full-size tile in
`MacDock`, compensate for one icon with local scale or offset CSS, or let
generated ink escape the boundary. `overflow: hidden` is only a safety
boundary; all app icons must enter through this normalizer.

Raster Dock artwork is low-priority lazy-loaded by `mac-chrome`; callers only
supply right-sized source assets. The Dock canvas is 50px, so 256px source
artwork is ample for current zoom and Retina use.

### SystemSymbol
maps to: SwiftUI `Image(systemName:)` (SF Symbols).
`SystemSymbol({ className, name, size }: { readonly className?: string; readonly name: SystemSymbolName; readonly size?: number })`
`SystemSymbolName` is `symbolist`'s typed symbol-name union. `SystemSymbol`
renders the corresponding private-use codepoint using the macOS system SF
font; it ships no Apple font or exported symbol artwork. It is therefore
faithful on a Mac client and should receive an explicit fallback only when a
non-Mac client is in scope. If an invalid name reaches runtime despite the
typed boundary, the component renders no glyph and warns once for that name.
It renders the glyph directly with intrinsic
variable-width font metrics. It does no runtime measurement, observation,
scaling, translation, or per-symbol offset. Parent components provide fixed,
stable icon slots and center glyphs with Grid or Flex. Size font glyphs and
SVG artwork in separate selectors because a `font-size` is not a square SVG
box; choose optical font size by component role, never by symbol name. Do not
supply per-symbol CSS transforms or offsets, and do not substitute bespoke SVG
approximations. In a live audit, compare every visible symbol's geometry
immediately after render, after it settles, and across repeated reloads; it
must not change. Include wide symbols such as `laptopcomputer` and
`person.2.fill`. First-render HTML/CSS must already contain the final sizing:
do not add post-render symbol measurement, `ResizeObserver`, transform
correction, or icon-specific translate/scale hacks. The template retains
`components/SFSymbol.tsx` as a deprecated compatibility alias; package
consumers import `SystemSymbol`.

When that fallback is a symbol font, use `font-display: swap`. Product apps
must not globally preload a 1MB symbol font.

### MacToolbar
maps to: SwiftUI `.toolbar { ... }` / `NSToolbar` — rendered as a react-aria `Toolbar` (`role="toolbar"`), so arrow keys move focus between the controls.
`MacToolbar({ center, children, className = "", leading, title, trailing }: { readonly center?: ReactNode; readonly children?: ReactNode; readonly className?: string; readonly leading?: ReactNode; readonly title?: ReactNode; readonly trailing?: ReactNode })`
Two usage modes: **slot props** (`leading` / `title` / `center` / `trailing` compose the standard toolbar row — how `FinderWindow` now builds its default toolbar: 13px title left-aligned in the leading area, capsule controls trailing), or **className + children** for surfaces that bring their own toolbar grid (how `ChatWindow` uses it). The rendered toolbar carries `data-window-drag-handle`, so the toolbar surface drags its window.

Toolbars are functional chrome, not decorative content. Give the toolbar a
contextual title; keep glyphs in a 14–16px optical box; make persistent view
modes a divided, single-selected capsule; and place search last. Do not add
placeholder prose (including labels such as “Toolbar”) or inert controls:
every visible item needs a native role and observable action or state.
When the command is reusable, expose the same action in the app's View or
other matching menu so both paths operate on one state source.

### ToolbarGlyph
maps to: `Image(systemName:)` — the toolbar-weight glyph set.
`ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName })`
`type ToolbarGlyphName = "back" | "forward" | "grid" | "inspector" | "list" | "more" | "search"`

### ToolbarButton
maps to: `ToolbarItem { Button }` / `NSToolbarItem`.
`ToolbarButton({ children, className = "", disabled = false, label, pressed, ref, selected = false, title, onClick }: { readonly children: ReactNode; readonly className?: string; readonly disabled?: boolean; readonly label: string; readonly pressed?: boolean; readonly ref?: Ref<HTMLButtonElement>; readonly selected?: boolean; readonly title?: string; readonly onClick?: () => void })`

### ToolbarCapsule
maps to: `ToolbarItemGroup` / `NSToolbarItemGroup` (joined segmented capsule).
`ToolbarCapsule({ children, className = "", divided = false, label, role }: { readonly children: ReactNode; readonly className?: string; readonly divided?: boolean; readonly label?: string; readonly role?: "group" })`

### ToolbarToggle
maps to: `Toggle` in a toolbar (`.toggleStyle(.button)`).
`ToolbarToggle({ children, className = "", label, pressed, title, onPressedChange }: { readonly children: ReactNode; readonly className?: string; readonly label: string; readonly pressed: boolean; readonly title?: string; readonly onPressedChange: (pressed: boolean) => void })`

### ToolbarSearchBubble
maps to: `.searchable(...)` / `NSSearchToolbarItem` (collapsed-to-icon form).
`ToolbarSearchBubble({ label = "Search", open: openProp, placeholder = "Search", value, onChange, onOpenChange, onValueChange }: { readonly label?: string; readonly open?: boolean; readonly placeholder?: string; readonly value: string; readonly onChange?: (value: string) => void; readonly onOpenChange?: (open: boolean) => void; readonly onValueChange?: (value: string) => void })` — `onValueChange` is an alias of `onChange`; one of the two is required.

### MacMenu
maps to: `NSMenu` / SwiftUI `Menu` — via react-aria `MenuTrigger`/`Menu`/`MenuItem`, which supply open/close, Esc and outside-press dismissal, focus restore, arrow/Home/End navigation, and typeahead.
`MacMenu({ className = "", isOpen, items, label, onMenuKeyDown, onOpenChange, onTriggerPointerEnter, popover, trigger, triggerClassName = "", triggerLabel }: { readonly className?: string; readonly isOpen?: boolean; readonly items: MenuSpec; readonly label: string; readonly onMenuKeyDown?: (event: ReactKeyboardEvent) => void; readonly onOpenChange?: (open: boolean) => void; readonly onTriggerPointerEnter?: () => void; readonly popover?: MenuPopoverConfig; readonly trigger: ReactNode; readonly triggerClassName?: string; readonly triggerLabel?: string })`
`interface MenuAction { readonly kind: "action"; readonly id: string; readonly label: string; readonly detail?: string; readonly shortcut?: string; readonly disabled?: boolean; readonly icon?: ReactNode; readonly trailingIcon?: ReactNode; readonly href?: string; readonly target?: string; readonly checked?: boolean; readonly onSelect?: () => void }`
`type MenuEntry = MenuAction | { readonly kind: "separator"; readonly id: string } | { readonly kind: "section"; readonly id: string; readonly label: string }`
`type MenuSpec = readonly MenuEntry[]`
`type MenuPopoverConfig = { readonly className?: string; readonly placement?: "bottom start" | "bottom end"; readonly offset?: number; readonly nonModal?: boolean }`
`className` lands on the wrapper (`.mc-menu`). The popover itself is portalled and positioned by react-aria; `popover` carries the overlay knobs — the menu-bar dropdowns pass `{ className: "mc-menubar-menu-popover", placement: "bottom start", offset: 3, nonModal: true }` for the compact lead-aligned NSMenu skin and to keep other menu titles interactive. `shortcut` renders the native trailing shortcut text; `disabled` renders an unavailable row. Entries with `checked` render as `menuitemradio` inside a single-selection group.

### MacPopover
maps to: `NSPopover` / SwiftUI `.popover`.
`MacPopover({ children, className = "", contentInset = "regular", isOpen, label, layout = "content", offset = 6, onOpenChange, placement = "bottom end", trigger, triggerClassName = "", triggerRef }: { readonly children: ReactNode; readonly className?: string; readonly contentInset?: MacPopoverContentInset; readonly isOpen?: boolean; readonly label: string; readonly layout?: MacPopoverLayout; readonly offset?: number; readonly onOpenChange?: (open: boolean) => void; readonly placement?: "bottom start" | "bottom end"; readonly trigger: ReactNode; readonly triggerClassName?: string; readonly triggerRef?: Ref<HTMLButtonElement> })`
`type MacPopoverLayout = "content" | "status"`
`type MacPopoverContentInset = "regular" | "compact" | "flush"`
Use this for arbitrary labelled, anchored content that is not a command menu.
It shares the focus-return, Escape, and outside-press dismissal machinery with
the menu system. Use `MacMenu` for commands and `MacDetailsMenu` for the
account-style summary trigger; do not create a local overlay.

### MacDetailsMenu
maps to: `NSPopover` anchored to a control; SwiftUI `.popover`.
`MacDetailsMenu({ children, className = "", label, summary }: { readonly children: ReactNode; readonly className?: string; readonly label: string; readonly summary: ReactNode })`
This is the arbitrary-content counterpart to `MacMenu`, not a native
`<details>` disclosure. It uses the shared react-aria dialog/popover path for
outside-press dismissal, Escape handling, and focus restoration; `label`
names its trigger and dialog. Menus and popovers use opaque, restrained
system surfaces by default rather than simulated Liquid Glass.

Use it only for a labeled, actionable control. Its disclosure follows the
same Escape/outside-dismissal and focus-restore contract as `MacMenu`; do not
substitute a raw `<details>` element in toolbar chrome.

### MenuBarExtra
maps to: SwiftUI `MenuBarExtra` / `NSStatusItem`.
`MenuBarExtra({ badge, children, icon, isOpen, label, onOpenChange, triggerRef }: { readonly badge?: number | string; readonly children: ReactNode; readonly icon: ReactNode | string; readonly isOpen?: boolean; readonly label: string; readonly onOpenChange?: (open: boolean) => void; readonly triggerRef?: Ref<HTMLButtonElement> })`
Prefer passing it through `DesktopShell`'s `menuBarExtras` slot (in-flow, collision-free). Standalone, it overlays absolutely at `right: var(--mc-menubar-extra-right, 177px)`.
Its arbitrary content uses the same dialog/popover machinery as
`MacDetailsMenu`, including dismissal and focus-return behavior; the popover
resets menu-bar foreground and text-shadow inheritance so content remains
legible on the opaque surface.
Pass `isOpen`, `onOpenChange`, and a stable `triggerRef` when a status-item
action opens a desktop-scoped `MacAlert`: close the popover first, then open
the alert, so the shared modal host can clean up background isolation and
restore focus to the status trigger reliably.
Its popup is its own light-surface context: it resets menu-bar foreground and
text-shadow, stays compact, and uses a restrained opaque material.

### useModalFocusTrap
maps to: no native counterpart — AppKit's key-window/first-responder system provides this for free; the trap exists only because the web platform does not.
`useModalFocusTrap({ dialogRef, fallbackFocusRef, focusVersion, initialFocusSelector = focusableSelector, onCancel }: { readonly dialogRef: RefObject<HTMLElement | null>; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly focusVersion?: string; readonly initialFocusSelector?: string; readonly onCancel: () => void })`
Returns a keydown handler to attach to the dialog element.

### MacNavigationSplitView
maps to: SwiftUI `NavigationSplitView` / AppKit split view.
`MacNavigationSplitView({ sidebar, content, detail, sidebarVisible = true, sidebarLabel = "Sidebar", contentLabel = "Content", detailLabel = "Detail", sidebarSizing, contentSizing, detailSizing, className = "", id }: MacNavigationSplitViewProps)`
The required `sidebar` and `detail` create a two-column navigation split. Add
`content` for a three-column sidebar/content/detail selection hierarchy. Each
column accepts an optional min/default/max `MacNavigationColumnSizing` object;
the built-in separators are keyboard-operable ARIA window splitters. Keep
supplementary settings or metadata outside this hierarchy in `MacInspector`.
When every panel default uses the same CSS unit, the primitive derives a
normalized `defaultLayout` for SSR, so hydration starts with final proportions
instead of replacing raw pixel flex-bases. Unlike units cannot be resolved
without live group geometry; those values pass through to the panels verbatim
rather than incorrectly treating, for example, `50%` and `500px` as weights.
Use `MacNavigationSplitView`, not a local panel layout.

### MacInspector
maps to: SwiftUI `.inspector` / an AppKit inspector pane.
`MacInspector({ children, className = "", label = "Inspector", visible = true, width, defaultWidth = 260, minWidth = 220, maxWidth = 360, onWidthChange }: MacInspectorProps)`
A separate trailing supplementary pane with an accessible leading-edge
separator: drag it, or focus it and use Left/Right (Home/End reaches the
limits). Pass `width` with `onWidthChange` for controlled sizing, or omit
`width` and optionally pass `defaultWidth` for internal sizing. CSS-string
controlled widths are measured from the rendered pane and kept in sync via
`ResizeObserver`, so the separator's `aria-valuenow` reports actual pixels. It
does not turn a two-column navigation split into a three-column navigation split and
does not invent the toolbar toggle or persistence policy; the surface owner
keeps visibility and any persisted width in agreement.

### MacSourceList
maps to: SwiftUI `List` with `.listStyle(.sidebar)` / Finder source list.
`MacSourceList({ sections, label = "Sidebar", className = "", selectedId, onSelectionChange, selectedSectionId, onSectionSelectionChange, expandedSectionIds, onExpandedSectionIdsChange }: MacSourceListProps)`
A titled section may opt into application selection with `selectable: true`;
its controlled selection uses `selectedSectionId` / `onSectionSelectionChange`.
Disclosure remains a separate chevron action and does not select the section.
`MacSourceListItem` is an id, label, optional icon/badge, and optional
indent. `MacSourceListSection` groups items under an optional title and can be
collapsible. Row selection is controlled; expansion is controlled when the
expanded-id pair is supplied, otherwise sections begin expanded. The React
Aria tree supplies roving focus, arrows, typeahead, selection, and disclosure
semantics. By default, section headers are structural. A titled section with
`selectable: true` is an explicit controlled destination through
`selectedSectionId` / `onSectionSelectionChange`; the shared `SystemSymbol`
indicator only represents a real collapse action.

### MacList
maps to: SwiftUI `List` / `NSTableView`'s simple list usage.
`MacList({ ariaLabel, className = "", emptyState = "No items", selectedId, sections, onSelectionChange })`
Rows may contain an icon, label, description, secondary text, accessory,
disabled state, and action. Selection is single and controlled. This is a
selectable list, not a table or outline view. `MacListSection` accepts an
optional `ariaLabel`.

### MacDisclosureGroup
maps to: SwiftUI `DisclosureGroup` / `NSDisclosureButton`.
`MacDisclosureGroup({ ariaLabel, children, className = "", disabled = false, expanded, title, onExpandedChange })`
Expansion is controlled and inherits React Aria's disclosure keyboard and
accessibility semantics. Its shared SF Symbol indicator replaces CSS-drawn
chevrons and its panel does not use reveal-scale animation. For both
`MacListSection` and `MacDisclosureGroup`, the accessible label resolves once
in this order: explicit `ariaLabel`, text derived from the title, then a
compatibility fallback. Supply `ariaLabel` when a title is custom,
decorative, opaque, or generated; generators are normalized once.

### Controls, forms, and unavailable content
maps to: SwiftUI `Button`, `TextField`, `Toggle`, `Picker` (segmented),
`ControlGroup`, `Form`, `Section`, `LabeledContent`, and
`ContentUnavailableView`.

`MacButton` provides regular, primary, destructive, and borderless variants.
`MacTextField` is a controlled field with optional visible label, description,
and error. `MacToggle` is a controlled checkbox or switch. `MacSegmentedControl`
is a controlled single-selection segmented choice. `MacControlGroup` gives
adjacent controls one labelled group. `MacForm`, `MacFormSection`, and
`MacLabeledContent` create the settings/form layout. `MacContentUnavailable`
renders a labelled no-content state with optional icon, description, and
actions. Use these instead of product-local imitations so the control has one
focus, keyboard, and visual contract.

`MacSearchField` is the controlled generic search field. Give it `ariaLabel`
or a visible `label`, pass `value`/`onChange`, and use `onSubmit` for Enter.
Its magnifier, clear action, and input-focus restoration after clear are built
in. Escape clears a nonempty editable field before it can reach a containing
sheet; read-only and disabled fields stay immutable.

### MacWindowStatusBar, MacAlert, and MacSheet
maps to: a window-attached status area, SwiftUI `.alert` / `NSAlert`, and
SwiftUI `.sheet` / `NSWindow.beginSheet`.

`MacWindowStatusBar({ children, className = "", live, trailing })` renders a
compact bottom status area. Use it for feedback owned by that window; do not
send Dock-launch descriptions into an unrelated window's status bar.

`MacAlert({ open, onClose, title, message, icon, actions, fallbackFocusRef, applicationName, presentationScope = "automatic" }: { readonly actions: readonly MacDialogAction[]; readonly applicationName?: string; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly icon?: ReactNode; readonly message: ReactNode; readonly onClose: () => void; readonly open: boolean; readonly presentationScope?: MacAlertPresentationScope; readonly title: string })`
`MacSheet({ open, onClose, title, children, actions, bodyScroll = "automatic", contentInset = "standard", headerAccessory, fallbackFocusRef, initialFocusSelector, presentationKey, size = "compact" }: { readonly actions: readonly MacDialogAction[]; readonly bodyScroll?: "automatic" | "contained"; readonly children: ReactNode; readonly contentInset?: "standard" | "none"; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly headerAccessory?: ReactNode; readonly initialFocusSelector?: string; readonly onClose: () => void; readonly open: boolean; readonly presentationKey?: string; readonly size?: "compact" | "wide" | "large"; readonly title: string })`
`type MacDialogAction = { readonly id: string; readonly label: string; readonly role?: "cancel" | "destructive"; readonly placement?: "leading" | "trailing"; readonly isDefault?: boolean; readonly disabled?: boolean; readonly onPress?: () => void }`
`type MacAlertPresentationScope = "automatic" | "desktop"`

`MacSheet` owns the visible title, body, actions, and insets for an attached
task; callers supply content and `MacDialogAction` data, not a dialog heading
or button row. `MacAlert` is a short decision owned by the active window;
pass `presentationScope="desktop"` for a menu-bar app. `isDefault` is
independent of `cancel`/`destructive` semantics. Escape invokes the enabled
cancel action, dismissal restores focus, and the default action receives
initial focus. `Sheet` remains a freeform compatibility surface only.

Its `compact`, `wide`, and `large` widths cap at 420, 700, and 960 logical
points within the owner. `contentInset="none"` removes only body insets;
`bodyScroll="contained"` delegates scrolling to a scrollable child while the
owned header/footer remain fixed. `headerAccessory` is independently labelled header content,
such as `MacSearchField`. Mark secondary actions `placement: "leading"`; the
trailing group retains its semantic and default-action order. `MacList` exposes
React Aria's `escapeKeyBehavior`; use `"none"` in a sheet list when Escape
must leave selection intact and invoke the sheet's enabled Cancel action.

For motion, keep one `MacSheet` and every ancestor through its calling tree
mounted; drive it with `open`. Setting `open={false}` retains the last open
props for its exit. A new `presentationKey` requests a replacement: the
outgoing sheet completes its exit, then the latest request enters. With the
same key, props update the active sheet in place. Do not conditionally unmount
or key `MacSheet`, or wrap it in a product callback tree that remounts, while
asking the host to animate.

Inactive keyed content remains hidden and inert for the open session, retaining
React-local state; closing discards that session. For a new canceled or
reopened visit, callers choose a fresh key or reset their own draft state.
Business state remains caller-owned. When action handlers own request changes,
use a no-op `onClose`; let `onClose` clear the request only when dismissal owns
closing. During an exit or replacement, parent isolation remains in place, one
dialog is active, and input is locked. Escape cancels the latest requested
sheet once. When a key returns, the host restores its cached focused control
when it is still connected and tabbable; after motion, Enter invokes the
default action and Space activates the focused button. Reduced Motion skips
transforms. Do not add product delays or CSS animations around `MacSheet`.

```tsx
// Keep this component and its ancestors mounted for the whole transition.
// These action handlers own request changes, including closing.
<MacSheet
  open={request !== null}
  presentationKey={request?.id}
  title={request?.title ?? ""}
  actions={request?.actions ?? []}
  onClose={() => {}}
>
  {request?.content}
</MacSheet>
```

The attached top-edge treatment is a historical prototype pattern, not a claim
about the current universal macOS default: the current [Apple HIG sheet
guidance](https://developer.apple.com/design/human-interface-guidelines/sheets)
shows rounded, floating, centered cards. Apple’s archived [sheet](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/Sheets/Tasks/UsingCascadingSheets.html)
guidance closes a sheet before showing the next; this host’s replacement
continuity and its 180ms enter / 140ms exit are prototype choices, not Apple
specifications. Attached sheets slide down from the top edge and exit upward,
without spring or scale; see Apple’s [motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion).

### FinderWindow
maps to: `NavigationSplitView` + `List` with `.listStyle(.sidebar)` + `.inspector` — the three-pane split is react-resizable-panels (`Group`/`Panel`/`Separator`, the ARIA window-splitter pattern), and the sidebar genuinely maps to `List(.sidebar)` via a react-aria `Tree` (an ARIA tree: treegrid rows with arrow-key navigation, typeahead, expand/collapse, and selection).
`FinderWindow({ sidebar, sidebarHeader, sidebarVisible, onSidebarVisibleChange, entries, mode, onModeChange, search, selection, onOpen, onDrop, preview, previewVisible, onPreviewVisibleChange, statusBar, toolbarExtras, title, label, frame, onClose, onMinimize, onZoom, iconColumns }: { readonly sidebar: readonly SidebarSection[]; readonly sidebarHeader?: ReactNode; readonly sidebarVisible?: boolean; readonly onSidebarVisibleChange?: (visible: boolean) => void; readonly entries: readonly FinderEntry[]; readonly mode: FinderViewMode; readonly onModeChange: (mode: FinderViewMode) => void; readonly search: FinderSearch; readonly selection: FinderSelection; readonly onOpen: (entry: FinderEntry) => void; readonly onDrop?: (transfer: DataTransfer) => void; readonly preview?: (selection: FinderEntry | null) => ReactNode; readonly previewVisible?: boolean; readonly onPreviewVisibleChange?: (visible: boolean) => void; readonly statusBar?: ReactNode; readonly toolbarExtras?: ReactNode; readonly title?: string; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void; readonly iconColumns?: number })`
`type FinderEntry = { readonly id: string; readonly name: string; readonly kind: string; readonly icon: ReactNode; readonly modified?: string; readonly size?: string; readonly badge?: string; readonly draggable?: boolean }`
`type SidebarItem = { readonly id: string; readonly icon?: ReactNode; readonly label: string; readonly badge?: ReactNode; readonly indent?: boolean; readonly selected?: boolean; readonly onSelect: () => void }`
`type SidebarSection = { readonly id: string; readonly title?: string; readonly collapsible?: boolean; readonly count?: number; readonly selected?: boolean; readonly onTitleSelect?: () => void; readonly action?: ReactNode; readonly className?: string; readonly items: readonly SidebarItem[] }`
`type FinderViewMode = "icons" | "list"`
`type FinderSelection = { readonly selectedId: string | null; readonly onSelect: (id: string | null) => void }`
`type FinderSearch = { readonly value: string; readonly onChange: (value: string) => void }`
- Default geometry `940x580`, centered; override with `frame`.
- The sidebar renders the macOS **source list** anatomy: full-height translucent material, quiet 11px section headers with a hover-revealed trailing disclosure chevron, 28px rows (accent-colored symbol + 13px label, 6px-radius tinted selection), sections separated by spacing — not dividers. Keyboard semantics (arrows, typeahead, collapse, selection-follows-focus) come from the react-aria Tree; the tree flattens rows in the DOM, so `SidebarSection.className` lands on the section's **lead row** (its header, or an untitled section's first item) — still the hook for product-layer placement (e.g. a bottom-anchored section via `margin-top: auto`) without reaching into chrome internals.
- `sidebarVisible` and `onSidebarVisibleChange` are optional, backward-compatible props. The sidebar is default-visible and internally managed when they are omitted. Pass the pair when a View-menu command and the toolbar need one controlled source of truth. The toolbar toggle emits through the same setter; when the sidebar is hidden, the traffic lights move into the toolbar.
- The preview pane is a collapsible panel clamped to 220–350px (default 270): drag or use the separator's arrow keys to resize; dragging below 150px (or the separator's Enter) collapses it, returning focus to the toolbar's Show/Hide Preview toggle. Visibility is default-visible and internal when `previewVisible` is omitted; pass `previewVisible` with `onPreviewVisibleChange` when a View-menu command and the toolbar need one controlled source of truth. The component does not persist visibility or pane width.
- The default toolbar is the parity composition: left-aligned title in the leading area, then trailing `toolbarExtras`, the segmented icons/list view capsule, the search bubble, and (when `preview` is provided) the inspector toggle — zero consumer CSS required.
- The content grid is one tab stop (roving tabindex on the selected entry).

### QuickLook
maps to: `QLPreviewPanel` / `.quickLookPreview`.
`QuickLook({ entry, detail, onClose }: { readonly entry: FinderEntry; readonly detail?: ReactNode; readonly onClose: () => void })`
Modal focus contract (`useModalFocusTrap`): focus moves to the close button on open, Tab is trapped inside, Escape cancels, and focus restores to the opener on close.

### finderKeyTarget
maps to: no counterpart — pure grid-navigation math for the listbox (AppKit's `NSCollectionView` does this internally).
`finderKeyTarget(key: string, index: number, columns: number, count: number): number | null`

### ChooserWindow
maps to: the document template-chooser pattern (`NSOpenPanel`-adjacent); no direct SwiftUI counterpart.
`ChooserWindow({ title, subtitle, finePrint, windowTitle, toolbarExtras, choices, selected, onSelect, onActivate, secondaryGroup, footer, label, frame, onClose, onMinimize, onZoom }: { readonly title: string; readonly subtitle: string; readonly finePrint?: string; readonly windowTitle?: string; readonly toolbarExtras?: ReactNode; readonly choices: readonly ChooserChoice[]; readonly selected: string | null; readonly onSelect: (id: string) => void; readonly onActivate?: (id: string) => void; readonly secondaryGroup?: ChooserSecondaryGroup; readonly footer: ReactNode; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void })`
`type ChooserChoice = { readonly id: string; readonly symbol: SystemSymbolName; readonly title: string; readonly caption: string; readonly preview?: ReactNode }`
`type ChooserCommand = { readonly id: string; readonly symbol?: SystemSymbolName; readonly title: string; readonly caption?: string; readonly checked?: boolean; readonly onSelect: () => void }`
`type ChooserCommandSection = { readonly id: string; readonly label?: string; readonly commands: readonly ChooserCommand[] }`
`type ChooserSecondaryGroup = { readonly label: string; readonly caption?: string; readonly activeCaption?: string; readonly sections: readonly ChooserCommandSection[] }`
Default geometry `820x520`, centered; override with `frame`.

### createStoredIdList
maps to: `@AppStorage` / `UserDefaults` (persisted, change-observed small state).
`createStoredIdList(key: string, isValid: (id: string) => boolean = () => true): StoredIdList`
`type StoredIdList = { readonly key: string; readonly useStoredIds: () => readonly string[]; readonly read: () => readonly string[]; readonly add: (id: string) => void; readonly remove: (id: string) => void }`

### SetupAssistant
maps to: the macOS Setup Assistant app pattern (no public API; nearest AppKit shape is `NSPageController` + a fixed footer).
`SetupAssistant({ steps, currentStep, furthestIndex, onSelectStep, onBack, backLabel = "Back", onContinue, continueLabel = "Continue", continueDisabled = false, modalOpen = false, label, frame, onClose, onMinimize, onZoom, children }: { readonly steps: readonly SetupStep[]; readonly currentStep: string; readonly furthestIndex: number; readonly onSelectStep: (id: string) => void; readonly onBack: () => void; readonly backLabel?: string; readonly onContinue: () => void; readonly continueLabel?: string; readonly continueDisabled?: boolean; readonly modalOpen?: boolean; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void; readonly children: ReactNode })`
`type SetupStep = { readonly id: string; readonly name: string; readonly symbol?: SystemSymbolName }`
Default geometry `720x560`, centered; override with `frame`.

### SetupHeading
maps to: part of the Setup Assistant pattern above (hero symbol + title header).
`SetupHeading({ symbol, title }: { readonly symbol?: SystemSymbolName; readonly title: string })`

### Sheet
maps to: SwiftUI `.sheet` / `NSWindow.beginSheet`.
`Sheet({ open, onClose, label, fallbackFocusRef, initialFocusSelector, children }: { readonly open: boolean; readonly onClose: () => void; readonly label?: string; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly initialFocusSelector?: string; readonly children: ReactNode })`
Deprecated compatibility API. New code uses `MacSheet`, whose owned title,
body, and `MacDialogAction[]` action region prevent sheet-specific padding and
button-row drift.

### ChatWindow
maps to: no direct counterpart — a Messages-style `NavigationSplitView` (sidebar + transcript + composer) built from parts; AppKit/SwiftUI ship no chat surface.
`ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", sidebarVisible, onSidebarVisibleChange, toolbarExtras, emptyTranscript, label, frame, onClose, onMinimize, onZoom }: { readonly conversations: readonly Conversation[]; readonly activeConversationId: string; readonly onSelectConversation: (id: string) => void; readonly composer: ChatComposer; readonly search?: ChatSearch; readonly sidebarLabel?: string; readonly sidebarVisible?: boolean; readonly onSidebarVisibleChange?: (visible: boolean) => void; readonly toolbarExtras?: ReactNode; readonly emptyTranscript?: ReactNode; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void })`
`type ChatRole = "owner" | "agent" | "system"`
`type ChatAuthor = { readonly name: string; readonly icon?: ReactNode; readonly role: ChatRole }`
`type ChatMessage = { readonly id: string; readonly author: ChatAuthor; readonly at: string; readonly body: ReactNode; readonly status?: string }`
`type Conversation = { readonly id: string; readonly title: string; readonly icon?: ReactNode; readonly messages: readonly ChatMessage[] }`
`type ChatComposer = { readonly value: string; readonly onChange: (value: string) => void; readonly onSend: () => void; readonly placeholder?: string; readonly accessory?: ReactNode }`
`type ChatSearch = { readonly value: string; readonly onChange: (value: string) => void }`
Default geometry `760x540`, centered; override with `frame`.
`sidebarVisible` and `onSidebarVisibleChange` are optional, backward-compatible
props. The sidebar is default-visible and internally managed when they are
omitted. Use the controlled pair when the app's View menu and the recipe's
toolbar must target the same active-window state; the toolbar invokes the same
setter.
