# mac-chrome — API reference

macOS-window chrome for React prototypes: desktop shell, windows, toolbars,
menus, and four product-window surfaces (Finder, Chooser, Setup Assistant,
Chat). Signatures below are copied from source. Consumers import the
stylesheet once per app: `import "<this dir>/styles/index.css";` (components
also import their own CSS when bundled directly). Vendoring rules — the rsync
and its excludes — live in the skill's `references/workflows.md`.

## Exports (`index.ts`)

Values: `DesktopShell`, `TrafficLights`, `useWindowDrag`, `WindowChrome`, `MacDock`, `SystemSymbol`, `MacToolbar`, `ToolbarButton`, `ToolbarCapsule`, `ToolbarGlyph`, `ToolbarSearchBubble`, `ToolbarToggle`, `MacDetailsMenu`, `MacMenu`, `MenuBarExtra`, `useModalFocusTrap`, `FinderWindow`, `finderKeyTarget`, `QuickLook`, `ChooserWindow`, `createStoredIdList`, `SetupAssistant`, `SetupHeading`, `Sheet`, `ChatWindow`.
Types: `DesktopShellProps`, `DockItem`, `SystemSymbolName`, `ToolbarGlyphName`, `MenuAction`, `MenuEntry`, `MenuSpec`, `FinderEntry`, `FinderSearch`, `FinderSelection`, `FinderViewMode`, `SidebarItem`, `SidebarSection`, `ChooserChoice`, `ChooserCommand`, `ChooserCommandSection`, `ChooserSecondaryGroup`, `StoredIdList`, `SetupStep`, `ChatAuthor`, `ChatComposer`, `ChatMessage`, `ChatRole`, `ChatSearch`, `Conversation`.

### DesktopShell
`DesktopShell({ appName, menuItems = defaultMenuItems, date = "Wed Aug 6", clock = "9:47 AM", wallpaper, children }: DesktopShellProps)`
`interface DesktopShellProps { readonly appName: string; readonly menuItems?: readonly string[]; readonly date?: string; readonly clock?: string; readonly wallpaper?: string; readonly children: ReactNode }` — `wallpaper` takes a CSS image value (`url(...)`, gradient, `var(...)`) or a bare image URL.

### TrafficLights
`TrafficLights({ onClose }: { readonly onClose?: () => void } = {})`

### useWindowDrag
`useWindowDrag<T extends HTMLElement>(enabled: boolean, handleSelector: string = "[data-window-drag-handle]")`
Returns `{ windowRef, style, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }` to spread onto the window element.

### WindowChrome
`WindowChrome({ children, className = "", draggable = false, dragHandleSelector, label, style, onDragEnter, onDragLeave, onDragOver, onDrop }: { readonly children: ReactNode; readonly className?: string; readonly draggable?: boolean; readonly dragHandleSelector?: string; readonly label: string; readonly style?: CSSProperties; readonly onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDragOver?: (event: ReactDragEvent<HTMLElement>) => void; readonly onDrop?: (event: ReactDragEvent<HTMLElement>) => void })`

### MacDock
`MacDock({ items, label = "Dock" }: { readonly items: readonly DockItem[]; readonly label?: string })`
`interface DockItem { readonly id: string; readonly label: string; readonly icon: ReactNode | string; readonly running?: boolean; readonly group?: string; readonly onActivate?: () => void; readonly draggablePayload?: Readonly<Record<string, string>> }`

### SystemSymbol
`SystemSymbol({ className, name, size }: { readonly className?: string; readonly name: SystemSymbolName; readonly size?: number })`
`SystemSymbolName` is the string-literal union of the shipped glyph names — see `system-symbol.tsx` for the list.

### MacToolbar
`MacToolbar({ center, children, className = "", leading, title, trailing }: { readonly center?: ReactNode; readonly children?: ReactNode; readonly className?: string; readonly leading?: ReactNode; readonly title?: ReactNode; readonly trailing?: ReactNode })`
Two usage modes: **slot props** (`leading` / `title` / `center` / `trailing` compose the standard toolbar row), or **className + children** for surfaces that bring their own toolbar grid (how `FinderWindow` and `ChatWindow` use it).

### ToolbarGlyph
`ToolbarGlyph({ name }: { readonly name: ToolbarGlyphName })`
`type ToolbarGlyphName = "back" | "forward" | "grid" | "inspector" | "list" | "more" | "search"`

### ToolbarButton
`ToolbarButton({ children, className = "", disabled = false, label, pressed, ref, selected = false, title, onClick }: { readonly children: ReactNode; readonly className?: string; readonly disabled?: boolean; readonly label: string; readonly pressed?: boolean; readonly ref?: Ref<HTMLButtonElement>; readonly selected?: boolean; readonly title?: string; readonly onClick?: () => void })`

### ToolbarCapsule
`ToolbarCapsule({ children, className = "", divided = false, label, role }: { readonly children: ReactNode; readonly className?: string; readonly divided?: boolean; readonly label?: string; readonly role?: "group" })`

### ToolbarToggle
`ToolbarToggle({ children, className = "", label, pressed, title, onPressedChange }: { readonly children: ReactNode; readonly className?: string; readonly label: string; readonly pressed: boolean; readonly title?: string; readonly onPressedChange: (pressed: boolean) => void })`

### ToolbarSearchBubble
`ToolbarSearchBubble({ label = "Search", open: openProp, placeholder = "Search", value, onChange, onOpenChange, onValueChange }: { readonly label?: string; readonly open?: boolean; readonly placeholder?: string; readonly value: string; readonly onChange?: (value: string) => void; readonly onOpenChange?: (open: boolean) => void; readonly onValueChange?: (value: string) => void })` — `onValueChange` is an alias of `onChange`; one of the two is required.

### MacMenu
`MacMenu({ items, label, trigger, triggerClassName = "" }: { readonly items: MenuSpec; readonly label: string; readonly trigger: ReactNode; readonly triggerClassName?: string })`
`interface MenuAction { readonly kind: "action"; readonly id: string; readonly label: string; readonly detail?: string; readonly icon?: ReactNode; readonly trailingIcon?: ReactNode; readonly href?: string; readonly target?: string; readonly checked?: boolean; readonly onSelect?: () => void }`
`type MenuEntry = MenuAction | { readonly kind: "separator"; readonly id: string } | { readonly kind: "section"; readonly id: string; readonly label: string }`
`type MenuSpec = readonly MenuEntry[]`

### MacDetailsMenu
`MacDetailsMenu({ children, className = "", summary }: { readonly children: ReactNode; readonly className?: string; readonly summary: ReactNode })`

### MenuBarExtra
`MenuBarExtra({ badge, children, icon, label }: { readonly badge?: number | string; readonly children: ReactNode; readonly icon: ReactNode | string; readonly label: string })`

### useModalFocusTrap
`useModalFocusTrap({ dialogRef, fallbackFocusRef, focusVersion, initialFocusSelector = focusableSelector, onCancel }: { readonly dialogRef: RefObject<HTMLElement | null>; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly focusVersion?: string; readonly initialFocusSelector?: string; readonly onCancel: () => void })`
Returns a keydown handler to attach to the dialog element.

### FinderWindow
`FinderWindow({ sidebar, sidebarHeader, entries, mode, onModeChange, search, selection, onOpen, onDrop, preview, statusBar, toolbarExtras, title, label, iconColumns }: { readonly sidebar: readonly SidebarSection[]; readonly sidebarHeader?: ReactNode; readonly entries: readonly FinderEntry[]; readonly mode: FinderViewMode; readonly onModeChange: (mode: FinderViewMode) => void; readonly search: FinderSearch; readonly selection: FinderSelection; readonly onOpen: (entry: FinderEntry) => void; readonly onDrop?: (transfer: DataTransfer) => void; readonly preview?: (selection: FinderEntry | null) => ReactNode; readonly statusBar?: ReactNode; readonly toolbarExtras?: ReactNode; readonly title?: string; readonly label?: string; readonly iconColumns?: number })`
`type FinderEntry = { readonly id: string; readonly name: string; readonly kind: string; readonly icon: ReactNode; readonly modified?: string; readonly size?: string; readonly badge?: string; readonly draggable?: boolean }`
`type SidebarItem = { readonly id: string; readonly icon?: ReactNode; readonly label: string; readonly badge?: ReactNode; readonly indent?: boolean; readonly selected?: boolean; readonly onSelect: () => void }`
`type SidebarSection = { readonly id: string; readonly title?: string; readonly collapsible?: boolean; readonly count?: number; readonly selected?: boolean; readonly onTitleSelect?: () => void; readonly action?: ReactNode; readonly items: readonly SidebarItem[] }`
`type FinderViewMode = "icons" | "list"`
`type FinderSelection = { readonly selectedId: string | null; readonly onSelect: (id: string | null) => void }`
`type FinderSearch = { readonly value: string; readonly onChange: (value: string) => void }`

### QuickLook
`QuickLook({ entry, detail, onClose }: { readonly entry: FinderEntry; readonly detail?: ReactNode; readonly onClose: () => void })`

### finderKeyTarget
`finderKeyTarget(key: string, index: number, columns: number, count: number): number | null`

### ChooserWindow
`ChooserWindow({ title, subtitle, finePrint, windowTitle, toolbarExtras, choices, selected, onSelect, onActivate, secondaryGroup, footer, label }: { readonly title: string; readonly subtitle: string; readonly finePrint?: string; readonly windowTitle?: string; readonly toolbarExtras?: ReactNode; readonly choices: readonly ChooserChoice[]; readonly selected: string | null; readonly onSelect: (id: string) => void; readonly onActivate?: (id: string) => void; readonly secondaryGroup?: ChooserSecondaryGroup; readonly footer: ReactNode; readonly label?: string })`
`type ChooserChoice = { readonly id: string; readonly symbol: SystemSymbolName; readonly title: string; readonly caption: string; readonly preview?: ReactNode }`
`type ChooserCommand = { readonly id: string; readonly symbol?: SystemSymbolName; readonly title: string; readonly caption?: string; readonly checked?: boolean; readonly onSelect: () => void }`
`type ChooserCommandSection = { readonly id: string; readonly label?: string; readonly commands: readonly ChooserCommand[] }`
`type ChooserSecondaryGroup = { readonly label: string; readonly caption?: string; readonly activeCaption?: string; readonly sections: readonly ChooserCommandSection[] }`

### createStoredIdList
`createStoredIdList(key: string, isValid: (id: string) => boolean = () => true): StoredIdList`
`type StoredIdList = { readonly key: string; readonly useStoredIds: () => readonly string[]; readonly read: () => readonly string[]; readonly add: (id: string) => void; readonly remove: (id: string) => void }`

### SetupAssistant
`SetupAssistant({ steps, currentStep, furthestIndex, onSelectStep, onBack, backLabel = "Back", onContinue, continueLabel = "Continue", continueDisabled = false, modalOpen = false, label, children }: { readonly steps: readonly SetupStep[]; readonly currentStep: string; readonly furthestIndex: number; readonly onSelectStep: (id: string) => void; readonly onBack: () => void; readonly backLabel?: string; readonly onContinue: () => void; readonly continueLabel?: string; readonly continueDisabled?: boolean; readonly modalOpen?: boolean; readonly label?: string; readonly children: ReactNode })`
`type SetupStep = { readonly id: string; readonly name: string; readonly symbol?: SystemSymbolName }`

### SetupHeading
`SetupHeading({ symbol, title }: { readonly symbol?: SystemSymbolName; readonly title: string })`

### Sheet
`Sheet({ open, onClose, label, fallbackFocusRef, initialFocusSelector, children }: { readonly open: boolean; readonly onClose: () => void; readonly label?: string; readonly fallbackFocusRef?: RefObject<HTMLElement | null>; readonly initialFocusSelector?: string; readonly children: ReactNode })`

### ChatWindow
`ChatWindow({ conversations, activeConversationId, onSelectConversation, composer, search, sidebarLabel = "Conversations", toolbarExtras, emptyTranscript, label }: { readonly conversations: readonly Conversation[]; readonly activeConversationId: string; readonly onSelectConversation: (id: string) => void; readonly composer: ChatComposer; readonly search?: ChatSearch; readonly sidebarLabel?: string; readonly toolbarExtras?: ReactNode; readonly emptyTranscript?: ReactNode; readonly label?: string })`
`type ChatRole = "owner" | "agent" | "system"`
`type ChatAuthor = { readonly name: string; readonly icon?: ReactNode; readonly role: ChatRole }`
`type ChatMessage = { readonly id: string; readonly author: ChatAuthor; readonly at: string; readonly body: ReactNode; readonly status?: string }`
`type Conversation = { readonly id: string; readonly title: string; readonly icon?: ReactNode; readonly messages: readonly ChatMessage[] }`
`type ChatComposer = { readonly value: string; readonly onChange: (value: string) => void; readonly onSend: () => void; readonly placeholder?: string; readonly accessory?: ReactNode }`
`type ChatSearch = { readonly value: string; readonly onChange: (value: string) => void }`
