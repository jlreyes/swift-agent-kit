# mac-chrome — API reference

macOS-window chrome for React prototypes: desktop shell, windows, toolbars,
menus, and four product-window surfaces (Finder, Chooser, Setup Assistant,
Chat). Signatures below are copied from source. Every component imports its
own stylesheet, so importing a component is enough; `styles/index.css` remains
as the one-shot import for consumers who prefer a single global stylesheet.
Vendoring rules — the rsync and its excludes — live in the skill's
`references/workflows.md`.

Two runtime dependencies (exact-pinned here and in the template) supply
behavior this package should not own: **react-aria-components** (menus,
sidebar tree, toolbar — the ARIA keyboard/focus/dismissal semantics) and
**react-resizable-panels** (the three-pane split with an ARIA window-splitter
separator). The visual layer — classes, tokens, CSS anatomy — stays ours;
the libraries are wired through their className/data-attribute APIs.

Each component names its SwiftUI/AppKit counterpart (**maps to:**). Build
against the counterpart's anatomy; a component with **no native counterpart**
is flagged as such — treat reaching for one as a design-drift alarm.

Windows are **draggable by default**: any surface inside the window marked
`[data-window-drag-handle]` (every `MacToolbar` and each product window's
title-bar row already is) drags the window; interactive elements and anything
under `[data-no-window-drag]` are excluded. Windows also get **default
geometry** — a per-surface size, centered on the canvas — overridable via the
`frame` prop. Traffic lights are functional by default (hover reveals the
glyphs; close/minimize/zoom work) — see `WindowChrome` and `TrafficLights`.

## Exports (`index.ts`)

Values: `DesktopShell`, `TrafficLights`, `useWindowDrag`, `WindowChrome`, `defaultDockItems`, `MacDock`, `SystemSymbol`, `MacToolbar`, `ToolbarButton`, `ToolbarCapsule`, `ToolbarGlyph`, `ToolbarSearchBubble`, `ToolbarToggle`, `MacDetailsMenu`, `MacMenu`, `MenuBarExtra`, `useModalFocusTrap`, `FinderWindow`, `finderKeyTarget`, `QuickLook`, `ChooserWindow`, `createStoredIdList`, `SetupAssistant`, `SetupHeading`, `Sheet`, `ChatWindow`.
Types: `DesktopShellProps`, `MenuBarMenu`, `MenuCommand`, `WindowFrame`, `DockItem`, `SystemSymbolName`, `ToolbarGlyphName`, `MenuAction`, `MenuEntry`, `MenuPopoverConfig`, `MenuSpec`, `FinderEntry`, `FinderSearch`, `FinderSelection`, `FinderViewMode`, `SidebarItem`, `SidebarSection`, `ChooserChoice`, `ChooserCommand`, `ChooserCommandSection`, `ChooserSecondaryGroup`, `StoredIdList`, `SetupStep`, `ChatAuthor`, `ChatComposer`, `ChatMessage`, `ChatRole`, `ChatSearch`, `Conversation`.

The template's `/showcase` route is the canonical interactive catalog: it
covers every runtime export against a working desktop shell. Use it to
inspect composition and interactions; use `/example` as the concise product
starter.

Chrome favors faithful, restrained system materials over effect work. Menus,
status popovers, and toolbar capsules are opaque or near-opaque, compact, and
legible over the wallpaper; do not layer custom blur or saturation recipes on
top. Use `MacMenu` for command menus and `MacDetailsMenu` for anchored
disclosures rather than a local overlay or `<details>` control: the shared
primitives own focus, Escape/outside dismissal, and native-sized geometry.

### DesktopShell
maps to: the macOS menu bar + desktop (NSApplication main menu / NSStatusBar region); no single SwiftUI view — it is the app's stage, not a window.
`DesktopShell({ appName, menuItems = defaultMenuItems, appleMenuItems, appMenuItems, onMenuAction, date, clock, menuBarExtras, wallpaper, children }: DesktopShellProps)`
`interface DesktopShellProps { readonly appName: string; readonly menuItems?: readonly (string | MenuBarMenu)[]; readonly appleMenuItems?: MenuSpec; readonly appMenuItems?: MenuSpec; readonly onMenuAction?: (command: MenuCommand) => void; readonly date?: string; readonly clock?: string; readonly menuBarExtras?: ReactNode; readonly wallpaper?: string; readonly children: ReactNode }`
`type MenuBarMenu = { readonly title: string; readonly items: MenuSpec }`
`type MenuCommand = { readonly menu: string; readonly id: string; readonly label: string }`
- The shell always provides functional Apple and app menus; use
  `appleMenuItems` or `appMenuItems` to replace either menu's default items.
  When `menuItems` is omitted, it supplies File, Edit, View, Window, and Help.
  When provided, its array is the exact post-app-menu list: standard string
  names resolve to their built-in menus, while `MenuBarMenu` objects customize
  or replace menus with product commands.
- An action with `onSelect` or `href` owns its behavior. Otherwise,
  `onMenuAction` receives its `{ menu, id, label }` command; without either a
  per-action target or `onMenuAction`, the shell disables the action.
- An active menu switches when its title is hovered. Left/Right moves between
  menu titles; Tab/Shift-Tab dismisses it and advances focus; Escape and an
  outside press dismiss it. The Apple mark and the Battery, Wi-Fi, and Control
  Center glyphs are self-contained SVGs.
- Omit `date` and `clock` for a live host-local macOS-style date and clock.
- `menuBarExtras`: `MenuBarExtra` elements rendered **in flow** next to the status items, so they can never overlap the clock/date. A `MenuBarExtra` rendered outside this slot falls back to absolute positioning at `--mc-menubar-extra-right` (default `177px`) — set that var when composing standalone extras against non-default status text.
- `wallpaper` takes a CSS image value (`url(...)`, gradient, `var(...)`) or a bare image URL. Default: `/mac-assets/wallpapers/tahoe.jpg`; without hydrated assets, it falls back to the original abstract SVG at `styles/wallpaper.svg` (referenced from `styles/base.css`; replace the prop, not the file).

### TrafficLights
maps to: `NSWindow.standardWindowButton(.closeButton/.miniaturizeButton/.zoomButton)`.
`TrafficLights({ disabled = false, onClose, onMinimize, onZoom }: { readonly disabled?: boolean; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void } = {})`
Inside a `WindowChrome`, the three controls are functional with no props: hovering the cluster reveals the ×/−/+ glyphs on all three (macOS behavior), close hides the window, minimize animates out then hides, zoom toggles the frame against a near-canvas size. An explicit handler prop **overrides** the enclosing window's internal default for that control (the window no longer hides itself — the consumer owns the behavior). `disabled` renders all three as solid gray inert dots.

### useWindowDrag
maps to: `NSWindow.performDrag(with:)` / `isMovableByWindowBackground`.
`useWindowDrag<T extends HTMLElement>(enabled: boolean, handleSelector: string = "[data-window-drag-handle]")`
Returns `{ windowRef, style, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }` to spread onto the window element. Pointer-downs on `button/input/textarea/select/a/[role='button']/.traffic-lights/[data-no-window-drag]` never start a drag.

### WindowChrome
maps to: `NSWindow` (titled, full-size content view); SwiftUI `Window`/`WindowGroup` scene.
`WindowChrome({ children, className = "", defaultSize = genericDefaultSize, draggable = true, dragHandleSelector, frame, label, style, onClose, onMinimize, onZoom, onDragEnter, onDragLeave, onDragOver, onDrop }: { readonly children: ReactNode; readonly className?: string; readonly defaultSize?: WindowSize; readonly draggable?: boolean; readonly dragHandleSelector?: string; readonly frame?: WindowFrame; readonly label: string; readonly style?: CSSProperties; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void; readonly onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragOver?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDrop?: (event: ReactDragEvent<HTMLElement>) => void })`
`type WindowFrame = { readonly top?: number | string; readonly left?: number | string; readonly width?: number | string; readonly height?: number | string }` — numbers are px; strings pass through as CSS.
- **Default geometry**: `defaultSize` (generic `720x480`; each product surface passes its own) applied as inline `width/height`, horizontally centered and biased slightly above vertical center. Any side set in `frame` wins; `style` merges over the computed placement (CSS-position a window by passing `top/left` there or in `frame`).
- **Draggable by default** via `[data-window-drag-handle]` surfaces.
- **Window controls**: provides close/minimize/zoom to any `TrafficLights` inside (React context). Internal defaults always run — close hides, minimize animates out (~220ms, reduced-motion aware) then hides, zoom toggles the frame against `~canvas − margins`; the `onClose/onMinimize/onZoom` props are notifications alongside those defaults. Hiding unmounts the window subtree — re-mount (e.g. a `key` change) to bring it back.

### MacDock
maps to: the system Dock (`NSDockTile` per app); no SwiftUI counterpart — system UI.
`MacDock({ items, label = "Dock" }: { readonly items?: readonly DockItem[]; readonly label?: string })`
`interface DockItem { readonly id: string; readonly label: string; readonly icon: ReactNode | string; readonly running?: boolean; readonly group?: string; readonly onActivate?: () => void; readonly draggablePayload?: Readonly<Record<string, string>> }`
When `items` is omitted, the Dock shows Finder, App Store, Google Chrome,
Downloads, and Trash. The local icons hydrated into `public/mac-assets/` are
private assets: they are ignored and must never be committed.

### SystemSymbol
maps to: SwiftUI `Image(systemName:)` (SF Symbols).
`SystemSymbol({ className, name, size }: { readonly className?: string; readonly name: SystemSymbolName; readonly size?: number })`
`SystemSymbolName` is the string-literal union of the shipped glyph names — see `system-symbol.tsx` for the list.

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
`MenuBarExtra({ badge, children, icon, label }: { readonly badge?: number | string; readonly children: ReactNode; readonly icon: ReactNode | string; readonly label: string })`
Prefer passing it through `DesktopShell`'s `menuBarExtras` slot (in-flow, collision-free). Standalone, it overlays absolutely at `right: var(--mc-menubar-extra-right, 177px)`.
Its arbitrary content uses the same dialog/popover machinery as
`MacDetailsMenu`, including dismissal and focus-return behavior; the popover
resets menu-bar foreground and text-shadow inheritance so content remains
legible on the opaque surface.
Its popup is its own light-surface context: it resets menu-bar foreground and
text-shadow, stays compact, and uses a restrained opaque material.

### useModalFocusTrap
maps to: no native counterpart — AppKit's key-window/first-responder system provides this for free; the trap exists only because the web platform does not.
`useModalFocusTrap({ dialogRef, fallbackFocusRef, focusVersion, initialFocusSelector = focusableSelector, onCancel }: { readonly dialogRef: RefObject<HTMLElement | null>; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly focusVersion?: string; readonly initialFocusSelector?: string; readonly onCancel: () => void })`
Returns a keydown handler to attach to the dialog element.

### FinderWindow
maps to: `NavigationSplitView` + `List` with `.listStyle(.sidebar)` + `.inspector` — the three-pane split is react-resizable-panels (`Group`/`Panel`/`Separator`, the ARIA window-splitter pattern), and the sidebar genuinely maps to `List(.sidebar)` via a react-aria `Tree` (an ARIA tree: treegrid rows with arrow-key navigation, typeahead, expand/collapse, and selection).
`FinderWindow({ sidebar, sidebarHeader, entries, mode, onModeChange, search, selection, onOpen, onDrop, preview, previewVisible, onPreviewVisibleChange, statusBar, toolbarExtras, title, label, frame, onClose, onMinimize, onZoom, iconColumns }: { readonly sidebar: readonly SidebarSection[]; readonly sidebarHeader?: ReactNode; readonly entries: readonly FinderEntry[]; readonly mode: FinderViewMode; readonly onModeChange: (mode: FinderViewMode) => void; readonly search: FinderSearch; readonly selection: FinderSelection; readonly onOpen: (entry: FinderEntry) => void; readonly onDrop?: (transfer: DataTransfer) => void; readonly preview?: (selection: FinderEntry | null) => ReactNode; readonly previewVisible?: boolean; readonly onPreviewVisibleChange?: (visible: boolean) => void; readonly statusBar?: ReactNode; readonly toolbarExtras?: ReactNode; readonly title?: string; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void; readonly iconColumns?: number })`
`type FinderEntry = { readonly id: string; readonly name: string; readonly kind: string; readonly icon: ReactNode; readonly modified?: string; readonly size?: string; readonly badge?: string; readonly draggable?: boolean }`
`type SidebarItem = { readonly id: string; readonly icon?: ReactNode; readonly label: string; readonly badge?: ReactNode; readonly indent?: boolean; readonly selected?: boolean; readonly onSelect: () => void }`
`type SidebarSection = { readonly id: string; readonly title?: string; readonly collapsible?: boolean; readonly count?: number; readonly selected?: boolean; readonly onTitleSelect?: () => void; readonly action?: ReactNode; readonly className?: string; readonly items: readonly SidebarItem[] }`
`type FinderViewMode = "icons" | "list"`
`type FinderSelection = { readonly selectedId: string | null; readonly onSelect: (id: string | null) => void }`
`type FinderSearch = { readonly value: string; readonly onChange: (value: string) => void }`
- Default geometry `940x580`, centered; override with `frame`.
- The sidebar renders the macOS **source list** anatomy: full-height translucent material, quiet 11px section headers with a hover-revealed trailing disclosure chevron, 28px rows (accent-colored symbol + 13px label, 6px-radius tinted selection), sections separated by spacing — not dividers. Keyboard semantics (arrows, typeahead, collapse, selection-follows-focus) come from the react-aria Tree; the tree flattens rows in the DOM, so `SidebarSection.className` lands on the section's **lead row** (its header, or an untitled section's first item) — still the hook for product-layer placement (e.g. a bottom-anchored section via `margin-top: auto`) without reaching into chrome internals.
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

### ChatWindow
maps to: no direct counterpart — a Messages-style `NavigationSplitView` (sidebar + transcript + composer) built from parts; AppKit/SwiftUI ship no chat surface.
`ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", toolbarExtras, emptyTranscript, label, frame, onClose, onMinimize, onZoom }: { readonly conversations: readonly Conversation[]; readonly activeConversationId: string; readonly onSelectConversation: (id: string) => void; readonly composer: ChatComposer; readonly search?: ChatSearch; readonly sidebarLabel?: string; readonly toolbarExtras?: ReactNode; readonly emptyTranscript?: ReactNode; readonly label?: string; readonly frame?: WindowFrame; readonly onClose?: () => void; readonly onMinimize?: () => void; readonly onZoom?: () => void })`
`type ChatRole = "owner" | "agent" | "system"`
`type ChatAuthor = { readonly name: string; readonly icon?: ReactNode; readonly role: ChatRole }`
`type ChatMessage = { readonly id: string; readonly author: ChatAuthor; readonly at: string; readonly body: ReactNode; readonly status?: string }`
`type Conversation = { readonly id: string; readonly title: string; readonly icon?: ReactNode; readonly messages: readonly ChatMessage[] }`
`type ChatComposer = { readonly value: string; readonly onChange: (value: string) => void; readonly onSend: () => void; readonly placeholder?: string; readonly accessory?: ReactNode }`
`type ChatSearch = { readonly value: string; readonly onChange: (value: string) => void }`
Default geometry `760x540`, centered; override with `frame`.
