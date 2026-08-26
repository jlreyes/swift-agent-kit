"use client";

import { useMemo, useRef, useState } from "react";

import {
  ChatWindow,
  ChooserWindow,
  createStoredIdList,
  defaultDockItems,
  DesktopShell,
  FinderWindow,
  MacApp,
  MacAppDock,
  MacAlert,
  MacButton,
  MacContentUnavailable,
  MacControlGroup,
  MacDetailsMenu,
  MacDisclosureGroup,
  MacDockAppIcon,
  MacForm,
  MacFormSection,
  MacInspector,
  MacLabeledContent,
  MacList,
  MacMenu,
  MacNavigationSplitView,
  MacPopover,
  MacSheet,
  MacSegmentedControl,
  MacSourceList,
  MacTextField,
  MacToggle,
  MacToolbar,
  MacWindowManager,
  MacWindowStatusBar,
  MenuBarExtra,
  SetupAssistant,
  SetupHeading,
  SystemSymbol,
  ToolbarButton,
  ToolbarCapsule,
  ToolbarGlyph,
  ToolbarSearchBubble,
  ToolbarToggle,
  TrafficLights,
  useMacWindowManager,
  WindowChrome,
  type ChatComposer,
  type ChatMessage,
  type ChooserChoice,
  type FinderEntry,
  type FinderViewMode,
  type MacAppDefinition,
  type MacListSection,
  type MacDialogAction,
  type MacSourceListSection,
  type MenuBarMenu,
  type MenuSpec,
  type SetupStep,
  type SidebarSection,
  type SystemSymbolName,
  type WindowSize,
} from "../../lib/mac-chrome/index.ts";

type StoryId =
  | "anatomy"
  | "window-toolbar"
  | "navigation"
  | "collections"
  | "controls"
  | "menus"
  | "presentation"
  | "finder"
  | "chooser"
  | "setup"
  | "chat";
type RecipeId = "finder" | "chooser" | "setup" | "chat";

type StoryDefinition = {
  readonly id: StoryId;
  readonly label: string;
  readonly symbol: SystemSymbolName;
  readonly nativeCounterpart: string;
  readonly summary: string;
};

const storyGroups: ReadonlyArray<{
  readonly id: string;
  readonly title: string;
  readonly stories: readonly StoryDefinition[];
}> = [
  {
    id: "overview",
    title: "Overview",
    stories: [
      {
        id: "anatomy",
        label: "App Anatomy",
        symbol: "laptopcomputer",
        nativeCounterpart: "NSWindow + NavigationSplitView",
        summary: "The live showcase is assembled from the same public shell, window, navigation, toolbar, inspector, and Dock primitives available to prototypes.",
      },
    ],
  },
  {
    id: "building-blocks",
    title: "Building Blocks",
    stories: [
      {
        id: "window-toolbar",
        label: "Window & Toolbar",
        symbol: "laptopcomputer",
        nativeCounterpart: "NSWindow + NSToolbar",
        summary: "Window controls, contextual titles, grouped commands, search, and toolbar/menu command parity.",
      },
      {
        id: "navigation",
        label: "Navigation & Split View",
        symbol: "sidebar.left",
        nativeCounterpart: "NavigationSplitView + List(.sidebar)",
        summary: "Two or three navigation columns with resizable dividers. A supplementary inspector stays separate from the navigation hierarchy.",
      },
      {
        id: "collections",
        label: "Lists & Collections",
        symbol: "list.bullet",
        nativeCounterpart: "List + DisclosureGroup",
        summary: "Selectable rows, sections, secondary values, accessories, disabled states, and content disclosure.",
      },
      {
        id: "controls",
        label: "Controls & Forms",
        symbol: "gear",
        nativeCounterpart: "Form + LabeledContent",
        summary: "Compact Mac buttons, fields, toggles, segmented controls, form sections, and aligned labeled content.",
      },
      {
        id: "menus",
        label: "Menus & Popovers",
        symbol: "list.bullet",
        nativeCounterpart: "Menu + Popover",
        summary: "Command menus and arbitrary-content popovers share dismissal, focus return, anchoring, and restrained solid materials.",
      },
      {
        id: "presentation",
        label: "Presentation & Feedback",
        symbol: "briefcase.fill",
        nativeCounterpart: "Alert + Sheet + ContentUnavailableView",
        summary: "Native-shaped alerts, attached modal tasks, empty states, and window-attached status feedback.",
      },
    ],
  },
  {
    id: "compositions",
    title: "Compositions",
    stories: [
      { id: "finder", label: "Finder", symbol: "folder", nativeCounterpart: "Finder-style browser", summary: "Source list, selectable collection, preview, Quick Look, toolbar, and status-bar recipe." },
      { id: "chooser", label: "Chooser", symbol: "square.grid.2x2", nativeCounterpart: "Selection chooser", summary: "Choice collection, contextual preview, secondary commands, and an action footer." },
      { id: "setup", label: "Setup Assistant", symbol: "sparkles", nativeCounterpart: "Setup Assistant", summary: "Ordered step navigation, focused content, fixed actions, and an attached sheet." },
      { id: "chat", label: "Chat", symbol: "person.2.fill", nativeCounterpart: "Sidebar conversation app", summary: "Conversation source list, transcript, composer, toolbar search, and participant popover." },
    ],
  },
];

const stories = storyGroups.flatMap((group) => group.stories);

/** Runtime-export coverage for the embedded catalog and its live recipes. */
export const coveredExports = [
  "ChatWindow",
  "ChooserWindow",
  "createStoredIdList",
  "defaultDockItems",
  "DesktopShell",
  "finderKeyTarget",
  "FinderWindow",
  "MacApp",
  "MacAppDock",
  "MacAlert",
  "MacButton",
  "MacContentUnavailable",
  "MacControlGroup",
  "MacDetailsMenu",
  "MacDisclosureGroup",
  "MacDock",
  "MacDockAppIcon",
  "MacForm",
  "MacFormSection",
  "MacInspector",
  "MacLabeledContent",
  "MacList",
  "MacMenu",
  "MacNavigationSplitView",
  "MacPopover",
  "MacSheet",
  "MacSegmentedControl",
  "MacSourceList",
  "MacTextField",
  "MacToggle",
  "MacToolbar",
  "MacWindowManager",
  "MacWindowStatusBar",
  "MenuBarExtra",
  "QuickLook",
  "SetupAssistant",
  "SetupHeading",
  "Sheet",
  "SystemSymbol",
  "ToolbarButton",
  "ToolbarCapsule",
  "ToolbarGlyph",
  "ToolbarSearchBubble",
  "ToolbarToggle",
  "TrafficLights",
  "useModalFocusTrap",
  "useMacWindowManager",
  "useWindowDrag",
  "WindowChrome",
] as const;

const finderEntries: readonly FinderEntry[] = [
  { id: "brief", name: "Project Brief.md", kind: "document", icon: <SystemSymbol name="doc.text.fill" />, modified: "Today, 10:24 AM", size: "18 KB" },
  { id: "references", name: "References", kind: "folder", icon: <SystemSymbol name="folder" />, modified: "Yesterday", size: "—" },
  { id: "research", name: "Research Notes.md", kind: "document", icon: <SystemSymbol name="doc.text.fill" />, modified: "Monday", size: "42 KB" },
  { id: "archive", name: "Archive", kind: "folder", icon: <SystemSymbol name="folder" />, modified: "Aug 18", size: "—" },
];

const chooserChoices: readonly ChooserChoice[] = [
  { id: "personal", symbol: "person.crop.circle", title: "Personal", caption: "A private workspace for one person", preview: <StoryPreview symbol="person.crop.circle" title="Personal workspace" detail="A focused starting point with private defaults." /> },
  { id: "team", symbol: "person.2.fill", title: "Team", caption: "Shared work for a small group", preview: <StoryPreview symbol="person.2.fill" title="Team workspace" detail="A shared space with roles and collaborative activity." /> },
  { id: "organization", symbol: "building.2.fill", title: "Organization", caption: "Structured access across departments", preview: <StoryPreview symbol="building.2.fill" title="Organization workspace" detail="A structured home for multiple groups and policies." /> },
];

const setupSteps: readonly SetupStep[] = [
  { id: "welcome", name: "Welcome", symbol: "sparkles" },
  { id: "account", name: "Account", symbol: "person.crop.circle" },
  { id: "privacy", name: "Privacy", symbol: "shield.fill" },
];

const recentChoiceIds = createStoredIdList("mac-chrome-showcase-recent-choices", (id) =>
  chooserChoices.some((choice) => choice.id === id),
);

const catalogMinimumSize: WindowSize = { width: 680, height: 480 };
const preferenceDefaults = {
  analytics: false,
  density: "comfortable",
  name: "Mac Chrome",
  updates: true,
} as const;

function StoryPreview({ detail, symbol, title }: {
  readonly detail: string;
  readonly symbol: SystemSymbolName;
  readonly title: string;
}) {
  return (
    <div className="showcase-preview-card">
      <SystemSymbol name={symbol} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function StoryHeader({ description, title }: { readonly description: string; readonly title: string }) {
  return (
    <header className="showcase-story-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function AppAnatomyStory() {
  const anatomy = [
    ["MacWindowManager + MacApp", "app identity, key window, focus stack, lifecycle"],
    ["MacApp presentation", "windowed Dock app or menu-bar-only app"],
    ["DesktopShell + MacAppDock", "wallpaper, active-app menus, launch and restore"],
    ["WindowChrome", "frame, active traffic lights, dragging, close/minimize/zoom"],
    ["MacNavigationSplitView", "sidebar and flexible detail column"],
    ["MacSourceList", "persistent catalog navigation"],
    ["MacToolbar", "context title and duplicate menu commands"],
    ["MacInspector", "optional supplementary controls, outside navigation"],
    ["MacAlert + MacSheet", "system decisions and attached modal workflows"],
    ["MacWindowStatusBar", "feedback owned by the active window"],
  ] as const;
  return (
    <div className="showcase-story-scroll">
      <StoryHeader title="Mac app anatomy" description="This app window is the example: each visible region is a reusable public primitive, composed rather than redrawn for the screenshot." />
      <section className="showcase-anatomy" aria-label="Mac app anatomy layers">
        <div className="showcase-anatomy-icon">
          <MacDockAppIcon
            icon={{ kind: "symbol", symbol: <SystemSymbol name="laptopcomputer" />, background: "#0a84ff", foreground: "#ffffff" }}
            label="Showcase app icon"
          />
        </div>
        <dl>
          {anatomy.map(([name, detail]) => (
            <div key={name}><dt>{name}</dt><dd>{detail}</dd></div>
          ))}
        </dl>
      </section>
      <p className="showcase-note">Navigation split views can have two or three navigation columns. The inspector on the right is supplementary and is deliberately not counted as the third navigation column.</p>
    </div>
  );
}

function WindowToolbarStory() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [status, setStatus] = useState("Ready");
  const items = ["Briefs", "References", "Research", "Archive"].filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="showcase-story-pane">
      <StoryHeader title="Window and toolbar" description="Toolbars contain navigation, contextual titles, commands, view controls, and search—not decorative labels such as “Toolbar.”" />
      <div className="showcase-toolbar-example">
        <MacToolbar
          className="showcase-example-toolbar"
          leading={
            <ToolbarCapsule divided role="group" label="History">
              <ToolbarButton label="Back" onClick={() => setStatus("Back")}><ToolbarGlyph name="back" /></ToolbarButton>
              <ToolbarButton label="Forward" disabled onClick={() => setStatus("Forward")}><ToolbarGlyph name="forward" /></ToolbarButton>
            </ToolbarCapsule>
          }
          title="Library"
          trailing={
            <>
            <MacSegmentedControl
              ariaLabel="Library view"
              value={view}
              onChange={setView}
              options={[
                { id: "grid", label: "Grid", icon: <SystemSymbol name="square.grid.2x2" /> },
                { id: "list", label: "List", icon: <SystemSymbol name="list.bullet" /> },
              ]}
            />
            <ToolbarSearchBubble value={query} onChange={setQuery} placeholder="Search Library" />
            </>
          }
        />
        <div className={`showcase-library-items is-${view}`}>
          {items.map((label) => (
            <button type="button" key={label} onClick={() => setStatus(`Selected ${label}`)}>
              <SystemSymbol name={label === "Briefs" || label === "Research" ? "doc.text.fill" : "folder"} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <output className="showcase-inline-status" aria-live="polite">{status}</output>
      </div>
    </div>
  );
}

function NavigationStory() {
  const [section, setSection] = useState("projects");
  const [item, setItem] = useState("website");
  const sidebarSections: readonly MacSourceListSection[] = [{
    id: "workspace",
    title: "Workspace",
    collapsible: true,
    items: [
      { id: "projects", label: "Projects", icon: <SystemSymbol name="folder" /> },
      { id: "archive", label: "Archive", icon: <SystemSymbol name="folder" /> },
    ],
  }];
  const listSections: readonly MacListSection[] = [{
    id: "projects",
    items: [
      { id: "website", label: "Website refresh", description: "Updated today", icon: <SystemSymbol name="network" /> },
      { id: "launch", label: "Launch plan", description: "Updated yesterday", icon: <SystemSymbol name="doc.text.fill" /> },
      { id: "research", label: "Research", description: "Updated Monday", icon: <SystemSymbol name="folder" /> },
    ],
  }];
  const selectedLabel = listSections[0]?.items.find((row) => row.id === item)?.label ?? "No selection";
  return (
    <div className="showcase-story-pane">
      <StoryHeader title="A true three-column navigation split" description="Sidebar → content list → detail is a navigation hierarchy. The showcase inspector remains a separate fourth, supplementary region." />
      <div className="showcase-navigation-demo">
        <MacNavigationSplitView
          id="navigation-story"
          sidebar={<MacSourceList label="Example sidebar" sections={sidebarSections} selectedId={section} onSelectionChange={setSection} />}
          content={<MacList ariaLabel="Projects" sections={listSections} selectedId={item} onSelectionChange={(id) => id !== null && setItem(id)} />}
          detail={
            <div className="showcase-navigation-detail">
              <SystemSymbol name={section === "archive" ? "folder" : "doc.text.fill"} />
              <h3>{selectedLabel}</h3>
              <p>The detail column responds to the selection in the middle content list.</p>
            </div>
          }
          sidebarLabel="Example sidebar"
          contentLabel="Project list"
          detailLabel="Project detail"
          sidebarSizing={{ defaultSize: 160, minSize: 130, maxSize: 220 }}
          contentSizing={{ defaultSize: 210, minSize: 170, maxSize: 280 }}
          detailSizing={{ defaultSize: 320, minSize: 220 }}
        />
      </div>
    </div>
  );
}

function CollectionsStory() {
  const [selectedId, setSelectedId] = useState<string | null>("design");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const sections: readonly MacListSection[] = [
    {
      id: "pinned",
      title: "Pinned",
      items: [
        { id: "design", label: "Design system", description: "12 components", secondary: "Today", icon: <SystemSymbol name="sparkles" /> },
        { id: "research", label: "Research notes", description: "8 documents", secondary: "Mon", icon: <SystemSymbol name="doc.text.fill" /> },
      ],
    },
    {
      id: "shared",
      title: "Shared",
      items: [
        { id: "handoff", label: "Engineering handoff", description: "Read only", accessory: <SystemSymbol name="shield.fill" />, disabled: true, icon: <SystemSymbol name="folder" /> },
      ],
    },
  ];
  return (
    <div className="showcase-story-scroll">
      <StoryHeader title="Lists and disclosure" description="Use a source list for window navigation and a standard list for selectable content. They share selection semantics but not the same visual role." />
      <div className="showcase-two-up">
        <section className="showcase-sample-group" aria-label="Standard list example">
          <h3>Standard list</h3>
          <MacList ariaLabel="Example documents" sections={sections} selectedId={selectedId} onSelectionChange={setSelectedId} />
        </section>
        <section className="showcase-sample-group" aria-label="Disclosure example">
          <h3>Disclosure groups</h3>
          <MacDisclosureGroup title="General" expanded={detailsOpen} onExpandedChange={setDetailsOpen}>
            The disclosure controls content in place without changing the current navigation selection.
          </MacDisclosureGroup>
          <MacDisclosureGroup title="Advanced" expanded={false} disabled onExpandedChange={() => undefined}>
            Disabled content.
          </MacDisclosureGroup>
        </section>
      </div>
    </div>
  );
}

function ControlsStory() {
  const [name, setName] = useState<string>(preferenceDefaults.name);
  const [updates, setUpdates] = useState<boolean>(preferenceDefaults.updates);
  const [analytics, setAnalytics] = useState<boolean>(preferenceDefaults.analytics);
  const [density, setDensity] = useState<string>(preferenceDefaults.density);
  const [status, setStatus] = useState("No changes yet");
  function restoreDefaults() {
    setName(preferenceDefaults.name);
    setDensity(preferenceDefaults.density);
    setUpdates(preferenceDefaults.updates);
    setAnalytics(preferenceDefaults.analytics);
    setStatus("Defaults restored");
  }
  return (
    <div className="showcase-story-scroll">
      <StoryHeader title="Controls and forms" description="Form rows align labels and values while the controls keep compact Mac geometry and native web semantics." />
      <MacForm ariaLabel="Example preferences" className="showcase-form" onSubmit={(event) => { event.preventDefault(); setStatus("Preferences saved"); }}>
        <MacFormSection title="General" description="Standard controls compose inside labeled rows.">
          <MacLabeledContent label="Workspace name"><MacTextField ariaLabel="Workspace name" value={name} onChange={setName} /></MacLabeledContent>
          <MacLabeledContent label="Density"><MacSegmentedControl ariaLabel="Interface density" value={density} onChange={setDensity} options={[{ id: "compact", label: "Compact" }, { id: "comfortable", label: "Comfortable" }]} /></MacLabeledContent>
          <MacLabeledContent label="Updates"><MacToggle selected={updates} onChange={setUpdates}>Install automatically</MacToggle></MacLabeledContent>
          <MacLabeledContent label="Analytics"><MacToggle style="switch" selected={analytics} onChange={setAnalytics}>Share diagnostics</MacToggle></MacLabeledContent>
        </MacFormSection>
        <div className="showcase-form-actions">
          <MacControlGroup ariaLabel="Preference actions">
            <MacButton onPress={restoreDefaults}>Restore Defaults</MacButton>
            <MacButton type="submit" variant="primary">Save</MacButton>
          </MacControlGroup>
          <output aria-live="polite">{status}</output>
        </div>
      </MacForm>
    </div>
  );
}

function MenusStory() {
  const [status, setStatus] = useState("Choose a command or open the info popover.");
  const [exampleOption, setExampleOption] = useState(true);
  const items: MenuSpec = [
    { kind: "section", id: "create", label: "Create" },
    { kind: "action", id: "folder", label: "New Folder", shortcut: "⇧⌘N", icon: <SystemSymbol name="folder.badge.plus" />, onSelect: () => setStatus("New Folder selected") },
    { kind: "action", id: "document", label: "New Document", shortcut: "⌘N", icon: <SystemSymbol name="doc.text.fill" />, onSelect: () => setStatus("New Document selected") },
    { kind: "separator", id: "separator" },
    { kind: "action", id: "refresh", label: "Refresh", icon: <SystemSymbol name="arrow.triangle.2.circlepath" />, onSelect: () => setStatus("Refreshed") },
  ];
  return (
    <div className="showcase-story-scroll">
      <StoryHeader title="Menus and popovers" description="Menus are command lists. Popovers host small arbitrary interfaces. Both use shared overlay behavior rather than ad hoc dropdown CSS." />
      <section className="showcase-control-row" aria-label="Menu and popover examples">
        <MacMenu trigger={<><SystemSymbol name="list.bullet" /> Actions</>} triggerLabel="Actions" label="Example actions" items={items} />
        <MacPopover contentInset="regular" label="Component information" layout="content" trigger={<><SystemSymbol name="person.crop.circle" /> Info</>}>
          <div className="showcase-popover-copy">
            <strong>Popover content</strong>
            <p>Use this for a small amount of transient functionality, not a list of commands.</p>
            <MacToggle
              selected={exampleOption}
              onChange={(selected) => {
                setExampleOption(selected);
                setStatus(selected ? "Example option enabled" : "Example option disabled");
              }}
            >
              Example option
            </MacToggle>
          </div>
        </MacPopover>
      </section>
      <output className="showcase-inline-status" aria-live="polite">{status}</output>
    </div>
  );
}

function PresentationStory() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [presentationStatus, setPresentationStatus] = useState("No projects created.");
  const [projectName, setProjectName] = useState("Untitled Project");
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);
  const alertTriggerRef = useRef<HTMLButtonElement>(null);
  const sheetActions: readonly MacDialogAction[] = [
    { id: "cancel", label: "Cancel", role: "cancel" },
    {
      id: "create",
      label: "Create",
      isDefault: true,
      disabled: projectName.trim().length === 0,
      onPress: () => setPresentationStatus(`Created ${projectName.trim()}.`),
    },
  ];
  return (
    <div className="showcase-story-pane">
      <StoryHeader title="Presentation and feedback" description="Use MacAlert for a short system decision, MacSheet for a scoped modal task, and MacWindowStatusBar for persistent window-local feedback." />
      <MacContentUnavailable
        icon={<SystemSymbol name="folder" />}
        title="No projects"
        description="Create a project to see it in this collection. The status belongs in the active window, not on the desktop."
        actions={<div className="showcase-presentation-actions"><MacButton ref={sheetTriggerRef} className="showcase-sheet-trigger" variant="primary" onPress={() => setSheetOpen(true)}>Create Project…</MacButton><MacButton ref={alertTriggerRef} onPress={() => setAlertOpen(true)}>Delete Draft…</MacButton></div>}
      />
      <MacWindowStatusBar live="polite" trailing="Window status">{presentationStatus}</MacWindowStatusBar>
      <MacSheet
        actions={sheetActions}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Create Project"
        fallbackFocusRef={sheetTriggerRef}
        initialFocusSelector=".mc-field-input"
      >
        <MacTextField ariaLabel="Project name" value={projectName} onChange={setProjectName} />
      </MacSheet>
      <MacAlert
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        fallbackFocusRef={alertTriggerRef}
        applicationName="Mac Chrome"
        icon={<SystemSymbol name="trash" />}
        title="Delete the draft project?"
        message="This draft will be removed from the prototype. This action cannot be undone."
        actions={[
          { id: "cancel", label: "Cancel", role: "cancel", onPress: () => setPresentationStatus("Kept the draft project.") },
          { id: "delete", label: "Delete", role: "destructive", isDefault: true, onPress: () => setPresentationStatus("Deleted the draft project.") },
        ]}
      />
    </div>
  );
}

function CompositionStory({ story, onOpen }: { readonly story: StoryDefinition; readonly onOpen: (id: RecipeId) => void }) {
  const recipe = story.id as RecipeId;
  const parts: Record<RecipeId, readonly string[]> = {
    finder: ["MacNavigationSplitView", "MacSourceList", "MacToolbar", "collection + preview", "Quick Look"],
    chooser: ["WindowChrome", "selection collection", "MacMenu", "preview", "action footer"],
    setup: ["WindowChrome", "step rail", "form content", "MacSheet", "fixed actions"],
    chat: ["MacNavigationSplitView", "MacSourceList", "MacToolbar", "transcript", "composer"],
  };
  return (
    <div className="showcase-story-scroll">
      <StoryHeader title={story.label} description={story.summary} />
      <section className="showcase-recipe-summary">
        <SystemSymbol name={story.symbol} />
        <h3>Composed from</h3>
        <ul>{parts[recipe].map((part) => <li key={part}>{part}</li>)}</ul>
        <MacButton variant="primary" onPress={() => onOpen(recipe)}>Open Example Window</MacButton>
      </section>
      <p className="showcase-note">The complete recipe opens as its own window over the desktop. It is not squeezed into or visually nested inside the component catalog.</p>
    </div>
  );
}

function StoryContent({ story, onOpenRecipe }: { readonly story: StoryDefinition; readonly onOpenRecipe: (id: RecipeId) => void }) {
  if (story.id === "anatomy") return <AppAnatomyStory />;
  if (story.id === "window-toolbar") return <WindowToolbarStory />;
  if (story.id === "navigation") return <NavigationStory />;
  if (story.id === "collections") return <CollectionsStory />;
  if (story.id === "controls") return <ControlsStory />;
  if (story.id === "menus") return <MenusStory />;
  if (story.id === "presentation") return <PresentationStory />;
  return <CompositionStory story={story} onOpen={onOpenRecipe} />;
}

function CatalogWindow({ activeStory, canGoBack, canGoForward, inspectorVisible, query, sidebarVisible, status, onBack, onForward, onInspectorVisibleChange, onOpenRecipe, onQueryChange, onSelectStory, onSidebarVisibleChange }: {
  readonly activeStory: StoryDefinition;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly inspectorVisible: boolean;
  readonly query: string;
  readonly sidebarVisible: boolean;
  readonly status: string;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onInspectorVisibleChange: (visible: boolean) => void;
  readonly onOpenRecipe: (id: RecipeId) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onSelectStory: (id: StoryId) => void;
  readonly onSidebarVisibleChange: (visible: boolean) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const sourceSections: readonly MacSourceListSection[] = storyGroups.flatMap((group) => {
    const matchingStories = group.stories.filter((story) => story.label.toLowerCase().includes(normalizedQuery));
    return matchingStories.length === 0 ? [] : [{
      id: group.id,
      title: group.title,
      collapsible: true,
      items: matchingStories.map((story) => ({
        id: story.id,
        label: story.label,
        icon: <SystemSymbol name={story.symbol} />,
      })),
    }];
  });
  return (
    <WindowChrome
      className="showcase-catalog-window"
      label="Mac Chrome component showcase"
      frame={{ top: 38, left: "max(16px, calc(50% - 550px))", width: "min(1100px, calc(100% - 32px))", height: "min(632px, calc(100% - 126px))" }}
      minSize={catalogMinimumSize}
      resizable
    >
      <div className="showcase-catalog-shell">
        <div className="showcase-catalog-navigation">
          <MacNavigationSplitView
            id="showcase-catalog"
            sidebarVisible={sidebarVisible}
            sidebarLabel="Component catalog"
            detailLabel={`${activeStory.label} story`}
            sidebarSizing={{ defaultSize: 224, minSize: 190, maxSize: 290 }}
            detailSizing={{ defaultSize: 620, minSize: 430 }}
            sidebar={
              <div className="showcase-catalog-sidebar">
                <div className="showcase-sidebar-titlebar" data-window-drag-handle=""><TrafficLights /></div>
                <div className="showcase-source-list-scroll">
                  {sourceSections.length > 0 ? (
                    <MacSourceList
                      label="Component catalog"
                      sections={sourceSections}
                      selectedId={activeStory.id}
                      onSelectionChange={(id) => {
                        const story = stories.find((candidate) => candidate.id === id);
                        if (story !== undefined) onSelectStory(story.id);
                      }}
                    />
                  ) : <MacContentUnavailable title="No components" description="Try a different search." />}
                </div>
              </div>
            }
            detail={
              <div className="showcase-catalog-main">
                <MacToolbar
                  leading={
                    <div className="showcase-toolbar-leading">
                      {!sidebarVisible ? <TrafficLights /> : null}
                      <ToolbarToggle label={sidebarVisible ? "Hide Sidebar" : "Show Sidebar"} pressed={sidebarVisible} onPressedChange={onSidebarVisibleChange}>
                        <SystemSymbol name="sidebar.left" />
                      </ToolbarToggle>
                      <ToolbarCapsule divided role="group" label="History">
                        <ToolbarButton label="Back" disabled={!canGoBack} onClick={onBack}><ToolbarGlyph name="back" /></ToolbarButton>
                        <ToolbarButton label="Forward" disabled={!canGoForward} onClick={onForward}><ToolbarGlyph name="forward" /></ToolbarButton>
                      </ToolbarCapsule>
                    </div>
                  }
                  title={activeStory.label}
                  trailing={
                    <>
                      <ToolbarToggle label={inspectorVisible ? "Hide Inspector" : "Show Inspector"} pressed={inspectorVisible} onPressedChange={onInspectorVisibleChange}>
                        <ToolbarGlyph name="inspector" />
                      </ToolbarToggle>
                      <ToolbarSearchBubble label="Search components" value={query} onChange={onQueryChange} placeholder="Search Components" />
                    </>
                  }
                />
                <main className="showcase-story-content" data-showcase-story={activeStory.id} aria-label={`${activeStory.label} story`}>
                  <StoryContent story={activeStory} onOpenRecipe={onOpenRecipe} />
                </main>
                <MacWindowStatusBar live="polite" trailing={`${stories.length} examples`}>{status}</MacWindowStatusBar>
              </div>
            }
          />
        </div>
        <MacInspector visible={inspectorVisible} label="Component inspector" className="showcase-component-inspector" defaultWidth={250}>
          <header><SystemSymbol name="sidebar.trailing" /><strong>Component</strong></header>
          <dl>
            <div><dt>Native counterpart</dt><dd>{activeStory.nativeCounterpart}</dd></div>
            <div><dt>Public composition</dt><dd>{activeStory.id === "navigation" ? "Three navigation columns; inspector separate" : activeStory.summary}</dd></div>
            <div><dt>State owner</dt><dd>Controlled by the application</dd></div>
            <div><dt>Material</dt><dd>Opaque, restrained, no simulated Liquid Glass</dd></div>
          </dl>
        </MacInspector>
      </div>
    </WindowChrome>
  );
}

function FinderRecipe({ mode, previewVisible, sidebarVisible, onClose, onModeChange, onPreviewVisibleChange, onSidebarVisibleChange }: {
  readonly mode: FinderViewMode;
  readonly previewVisible: boolean;
  readonly sidebarVisible: boolean;
  readonly onClose: () => void;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly onPreviewVisibleChange: (visible: boolean) => void;
  readonly onSidebarVisibleChange: (visible: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>("brief");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Documents");
  const [status, setStatus] = useState("Select an item, then press Space for Quick Look.");
  const sidebar: readonly SidebarSection[] = [
    { id: "favorites", title: "Favorites", collapsible: true, items: [
      { id: "recents", label: "Recents", icon: <SystemSymbol name="arrow.triangle.2.circlepath" />, selected: location === "Recents", onSelect: () => setLocation("Recents") },
      { id: "documents", label: "Documents", icon: <SystemSymbol name="doc.text.fill" />, badge: 4, selected: location === "Documents", onSelect: () => setLocation("Documents") },
    ] },
    { id: "locations", title: "Locations", items: [{ id: "cloud", label: "Shared Server", icon: <SystemSymbol name="network" />, selected: location === "Shared Server", onSelect: () => setLocation("Shared Server") }] },
  ];
  const shownEntries = finderEntries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <FinderWindow
      title={location}
      label="Finder showcase"
      frame={{ top: 54, left: "max(12px, calc(50% - 480px))", width: "min(960px, calc(100% - 24px))", height: "min(590px, calc(100% - 144px))" }}
      sidebar={sidebar}
      sidebarVisible={sidebarVisible}
      onSidebarVisibleChange={onSidebarVisibleChange}
      entries={shownEntries}
      mode={mode}
      onModeChange={onModeChange}
      previewVisible={previewVisible}
      onPreviewVisibleChange={onPreviewVisibleChange}
      search={{ value: query, onChange: setQuery }}
      selection={{ selectedId, onSelect: setSelectedId }}
      onOpen={(entry) => setStatus(`Opened ${entry.name}`)}
      preview={(entry) => entry === null ? <p className="showcase-empty-preview">Select an item to preview it.</p> : <StoryPreview symbol={entry.kind === "folder" ? "folder" : "doc.text.fill"} title={entry.name} detail={[entry.modified, entry.size].filter(Boolean).join(" · ")} />}
      statusBar={<span>{shownEntries.length} items · {status}</span>}
      toolbarExtras={<ToolbarButton label="Create folder" onClick={() => setStatus("Created a folder")}><SystemSymbol name="folder.badge.plus" /></ToolbarButton>}
      iconColumns={4}
      onClose={onClose}
    />
  );
}

function ChooserRecipe({ onClose }: { readonly onClose: () => void }) {
  const recentIds = recentChoiceIds.useStoredIds();
  const [selectedId, setSelectedId] = useState<string | null>("personal");
  const [status, setStatus] = useState("Choose a workspace type.");
  function select(id: string) { setSelectedId(id); recentChoiceIds.add(id); }
  return (
    <ChooserWindow
      title="Choose a workspace"
      subtitle="Start with a shape that matches how you work."
      finePrint={recentIds.length > 0 ? `Recently viewed: ${recentIds.length}` : "You can change this later."}
      windowTitle="New Workspace"
      label="Chooser showcase"
      frame={{ top: 72, left: "max(12px, calc(50% - 420px))", width: "min(840px, calc(100% - 24px))", height: "min(530px, calc(100% - 162px))" }}
      choices={chooserChoices}
      selected={selectedId}
      onSelect={select}
      onActivate={(id) => setStatus(`Opened ${chooserChoices.find((choice) => choice.id === id)?.title ?? id}`)}
      secondaryGroup={{ label: "More Options", caption: "Import or connect instead", activeCaption: "An alternate path is active", sections: [{ id: "other", commands: [
        { id: "import", title: "Import a workspace…", symbol: "arrow.down.doc", onSelect: () => setStatus("Import selected") },
        { id: "connect", title: "Connect to a server…", symbol: "network", onSelect: () => setStatus("Connect selected") },
      ] }] }}
      footer={<><span className="showcase-footer-status" aria-live="polite">{status}</span><MacButton variant="primary" disabled={selectedId === null} onPress={() => setStatus("Workspace created")}>Create</MacButton></>}
      onClose={onClose}
    />
  );
}

function SetupRecipe({ onCancel, onClose, onComplete }: {
  readonly onCancel: () => void;
  readonly onClose: () => void;
  readonly onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetFallbackRef = useRef<HTMLButtonElement>(null);
  const step = setupSteps[stepIndex] ?? setupSteps[0];
  const detailActions: readonly MacDialogAction[] = [
    { id: "done", label: "Done", role: "cancel", isDefault: true },
  ];
  return (
    <SetupAssistant
      label="Setup Assistant showcase"
      frame={{ top: 58, left: "max(12px, calc(50% - 370px))", width: "min(740px, calc(100% - 24px))", height: "min(580px, calc(100% - 148px))" }}
      steps={setupSteps}
      currentStep={step.id}
      furthestIndex={furthestIndex}
      onSelectStep={(id) => { const index = setupSteps.findIndex((candidate) => candidate.id === id); if (index >= 0 && index <= furthestIndex) setStepIndex(index); }}
      onBack={() => {
        if (stepIndex === 0) {
          onCancel();
          return;
        }
        setStepIndex((current) => current - 1);
      }}
      onContinue={() => {
        if (stepIndex === setupSteps.length - 1) {
          onComplete();
          return;
        }
        const next = stepIndex + 1;
        setFurthestIndex((current) => Math.max(current, next));
        setStepIndex(next);
      }}
      backLabel={stepIndex === 0 ? "Not Now" : "Back"}
      continueLabel={stepIndex === setupSteps.length - 1 ? "Finish" : "Continue"}
      onClose={onClose}
    >
      <SetupHeading symbol={step.symbol} title={step.name} />
      <div className="showcase-setup-copy"><p>{step.id === "welcome" ? "A guided path through the standard setup surface." : step.id === "account" ? "Connect an example account when you are ready." : "Review local privacy controls before finishing."}</p><MacButton ref={sheetFallbackRef} onPress={() => setSheetOpen(true)}>Show Details…</MacButton></div>
      <MacSheet
        actions={detailActions}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${step.name} Details`}
        fallbackFocusRef={sheetFallbackRef}
      >
        <p className="showcase-sheet-copy">This attached sheet demonstrates modal focus, Escape dismissal, and focus restoration.</p>
      </MacSheet>
    </SetupAssistant>
  );
}

function ChatRecipe({ sidebarVisible, onClose, onSidebarVisibleChange }: {
  readonly sidebarVisible: boolean;
  readonly onClose: () => void;
  readonly onSidebarVisibleChange: (visible: boolean) => void;
}) {
  const [activeConversationId, setActiveConversationId] = useState("project");
  const [composerValue, setComposerValue] = useState("");
  const [query, setQuery] = useState("");
  const [sentMessages, setSentMessages] = useState<Readonly<Record<string, readonly ChatMessage[]>>>({});
  const owner = useMemo(() => ({ name: "You", role: "owner" as const }), []);
  const agent = useMemo(() => ({ name: "Assistant", role: "agent" as const, icon: <SystemSymbol name="sparkles" /> }), []);
  const conversations = [
    { id: "project", title: "Project Notes", icon: <SystemSymbol name="doc.text.fill" />, messages: [
      { id: "one", author: owner, at: "9:41 AM", body: "Can you summarize the open decisions?" },
      { id: "two", author: agent, at: "9:42 AM", body: "There are three decisions ready for review." },
      { id: "system", author: { name: "System", role: "system" as const }, at: "9:43 AM", body: "Draft saved locally." },
      ...(sentMessages.project ?? []),
    ] },
    { id: "research", title: "Research", icon: <SystemSymbol name="magnifyingglass" />, messages: [
      { id: "research-one", author: agent, at: "Yesterday", body: "The reference set is ready." },
      ...(sentMessages.research ?? []),
    ] },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleConversations = normalizedQuery.length === 0 ? conversations : conversations.flatMap((conversation) => {
    const titleMatches = conversation.title.toLowerCase().includes(normalizedQuery);
    const matchingMessages = titleMatches ? conversation.messages : conversation.messages.filter((message) => typeof message.body === "string" && message.body.toLowerCase().includes(normalizedQuery));
    return matchingMessages.length === 0 ? [] : [{ ...conversation, messages: matchingMessages }];
  });
  const visibleActiveConversationId = visibleConversations.some((conversation) => conversation.id === activeConversationId)
    ? activeConversationId
    : visibleConversations[0]?.id ?? null;
  const hasVisibleConversation = visibleActiveConversationId !== null;
  const chatComposer: ChatComposer = {
    value: hasVisibleConversation ? composerValue : "",
    onChange: hasVisibleConversation ? setComposerValue : () => undefined,
    placeholder: hasVisibleConversation ? "Message" : "No conversation selected",
    accessory: hasVisibleConversation ? (
      <ToolbarButton label="Add attachment" onClick={() => setComposerValue((current) => `${current}${current ? " " : ""}[Attachment]`)}>
        <SystemSymbol name="folder.badge.plus" />
      </ToolbarButton>
    ) : undefined,
    onSend: () => {
      const body = composerValue.trim();
      if (!body || visibleActiveConversationId === null) return;
      setSentMessages((current) => {
        const conversationMessages = current[visibleActiveConversationId] ?? [];
        return {
          ...current,
          [visibleActiveConversationId]: [
            ...conversationMessages,
            { id: `sent-${visibleActiveConversationId}-${conversationMessages.length}`, author: owner, at: "Now", body, status: "Sent" },
          ],
        };
      });
      setComposerValue("");
    },
  };
  return (
    <ChatWindow
      label="Chat showcase"
      frame={{ top: 65, left: "max(12px, calc(50% - 390px))", width: "min(780px, calc(100% - 24px))", height: "min(550px, calc(100% - 155px))" }}
      conversations={visibleConversations}
      activeConversationId={visibleActiveConversationId ?? ""}
      onSelectConversation={setActiveConversationId}
      search={{ value: query, onChange: setQuery }}
      sidebarVisible={sidebarVisible}
      onSidebarVisibleChange={onSidebarVisibleChange}
      toolbarExtras={<MacDetailsMenu className="showcase-toolbar-details" label="Conversation details" summary={<SystemSymbol name="person.2.fill" />}><div className="showcase-conversation-details"><strong>Participants</strong><span>You · Owner</span><span>Assistant · Agent</span></div></MacDetailsMenu>}
      emptyTranscript={<MacContentUnavailable title="No matching conversations" description="Try a different search." />}
      composer={chatComposer}
      onClose={onClose}
    />
  );
}

function SystemAppRecipe({ label, symbol }: { readonly label: string; readonly symbol: SystemSymbolName }) {
  return (
    <WindowChrome
      className="showcase-system-window"
      label={`${label} showcase`}
      frame={{ top: 82, left: "max(12px, calc(50% - 330px))", width: "min(660px, calc(100% - 24px))", height: "min(430px, calc(100% - 172px))" }}
    >
      <div className="showcase-system-window-shell">
        <MacToolbar leading={<TrafficLights />} title={label} />
        <MacContentUnavailable icon={<SystemSymbol name={symbol} />} title={label} description="This placeholder is a managed application window: Dock launch, focus, dragging, traffic lights, minimize, close, and zoom all use the shared app framework." />
      </div>
    </WindowChrome>
  );
}

function defaultDockItem(id: string) {
  const item = defaultDockItems.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`Missing default Dock item: ${id}`);
  return item;
}

const showcaseApps = {
  activity: {
    id: "showcase-activity",
    name: "Showcase Activity",
    presentation: "menuBar",
    icon: { kind: "symbol", symbol: <SystemSymbol name="sparkles" /> },
  },
  catalog: {
    id: "catalog",
    name: "Mac Chrome",
    icon: { kind: "symbol", symbol: <SystemSymbol name="laptopcomputer" />, background: "var(--accent)", foreground: "var(--on-accent)" },
  },
  finder: { id: "finder", name: "Finder", defaultRunning: false, icon: defaultDockItem("finder").icon },
  chooser: {
    id: "chooser",
    name: "Workspace Chooser",
    defaultRunning: false,
    icon: { kind: "symbol", symbol: <SystemSymbol name="square.grid.2x2" />, background: "var(--selection-strong)", foreground: "var(--on-accent)" },
  },
  setup: {
    id: "setup",
    name: "Setup Assistant",
    defaultRunning: false,
    icon: { kind: "symbol", symbol: <SystemSymbol name="sparkles" />, background: "var(--brand-strong)", foreground: "var(--on-accent)" },
  },
  chat: {
    id: "chat",
    name: "Chat",
    defaultRunning: false,
    icon: { kind: "symbol", symbol: <SystemSymbol name="person.2.fill" />, background: "var(--chrome-ink)", foreground: "var(--on-accent)" },
  },
  appStore: { id: "app-store", name: "App Store", defaultRunning: false, icon: defaultDockItem("app-store").icon },
  chrome: { id: "chrome", name: "Google Chrome", defaultRunning: false, icon: defaultDockItem("chrome").icon },
  downloads: { id: "downloads", name: "Downloads", dockGroup: "places", defaultRunning: false, icon: defaultDockItem("downloads").icon },
  trash: { id: "trash", name: "Trash", dockGroup: "places", defaultRunning: false, icon: defaultDockItem("trash").icon },
} as const satisfies Record<string, MacAppDefinition>;

const showcaseAppManifest: readonly MacAppDefinition[] = Object.values(showcaseApps);

export function ShowcaseDesktop() {
  return (
    <MacWindowManager initialApps={showcaseAppManifest}>
      <ManagedShowcaseDesktop />
    </MacWindowManager>
  );
}

function ManagedShowcaseDesktop() {
  const windowManager = useMacWindowManager();
  const [storyHistory, setStoryHistory] = useState<readonly StoryId[]>(["anatomy"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [catalogSidebarVisible, setCatalogSidebarVisible] = useState(true);
  const [catalogInspectorVisible, setCatalogInspectorVisible] = useState(true);
  const [finderMode, setFinderMode] = useState<FinderViewMode>("icons");
  const [finderSidebarVisible, setFinderSidebarVisible] = useState(true);
  const [finderPreviewVisible, setFinderPreviewVisible] = useState(true);
  const [chatSidebarVisible, setChatSidebarVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [extraCount, setExtraCount] = useState(2);
  const [activityExtraOpen, setActivityExtraOpen] = useState(false);
  const [activityAlertOpen, setActivityAlertOpen] = useState(false);
  const [status, setStatus] = useState("Mac Chrome standard library is ready.");
  const activityTriggerRef = useRef<HTMLButtonElement>(null);
  const activeStoryId = storyHistory[historyIndex] ?? "anatomy";
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? stories[0];
  const viewTarget: RecipeId | "catalog" | "system" = windowManager.keyAppId === "finder"
    || windowManager.keyAppId === "chooser"
    || windowManager.keyAppId === "setup"
    || windowManager.keyAppId === "chat"
    ? windowManager.keyAppId
    : windowManager.keyAppId === null || windowManager.keyAppId === "catalog" ? "catalog" : "system";
  const keyAppName = windowManager.apps.find((app) => app.id === windowManager.keyAppId)?.name ?? "Mac Chrome";

  function selectStory(id: StoryId) {
    if (id === activeStoryId) return;
    setStoryHistory((current) => [...current.slice(0, historyIndex + 1), id]);
    setHistoryIndex((current) => current + 1);
    setStatus(`Showing ${stories.find((story) => story.id === id)?.label ?? id}.`);
  }

  function updateCatalogSidebarVisibility(visible: boolean) {
    setCatalogSidebarVisible(visible);
    setStatus(visible ? "Sidebar shown." : "Sidebar hidden.");
  }

  function updateCatalogInspectorVisibility(visible: boolean) {
    setCatalogInspectorVisible(visible);
    setStatus(visible ? "Inspector shown." : "Inspector hidden.");
  }

  function updateFinderMode(mode: FinderViewMode) {
    setFinderMode(mode);
    setStatus(mode === "icons" ? "Finder switched to Icon View." : "Finder switched to List View.");
  }

  function updateFinderSidebarVisibility(visible: boolean) {
    setFinderSidebarVisible(visible);
    setStatus(visible ? "Finder sidebar shown." : "Finder sidebar hidden.");
  }

  function updateFinderPreviewVisibility(visible: boolean) {
    setFinderPreviewVisible(visible);
    setStatus(visible ? "Finder preview shown." : "Finder preview hidden.");
  }

  function updateChatSidebarVisibility(visible: boolean) {
    setChatSidebarVisible(visible);
    setStatus(visible ? "Chat sidebar shown." : "Chat sidebar hidden.");
  }

  function activateRecipe(recipe: RecipeId) {
    const app = windowManager.apps.find((candidate) => candidate.id === recipe);
    windowManager.activateApp(recipe);
    setStatus(`${app?.name ?? recipe} ${app?.running ? "activated" : "launched"}.`);
  }

  function closeSetup(statusMessage: string) {
    const setupWindow = windowManager.windows.find((window) =>
      window.appId === showcaseApps.setup.id && window.state === "open",
    );
    if (setupWindow !== undefined) windowManager.closeWindow(setupWindow.id);
    setStatus(statusMessage);
  }

  const showcaseMenu: MenuBarMenu = {
    title: "Showcase",
    items: storyGroups.flatMap((group, groupIndex) => [
      ...(groupIndex === 0 ? [] : [{ kind: "separator" as const, id: `separator-${group.id}` }]),
      { kind: "section" as const, id: `section-${group.id}`, label: group.title },
      ...group.stories.map((story) => ({ kind: "action" as const, id: story.id, label: story.label, checked: story.id === activeStoryId, onSelect: () => selectStory(story.id) })),
    ]),
  };
  let viewItems: MenuSpec;
  if (viewTarget === "catalog") {
    viewItems = [
      { kind: "action", id: "catalog-toggle-sidebar", label: catalogSidebarVisible ? "Hide Sidebar" : "Show Sidebar", shortcut: "⌃⌘S", onSelect: () => updateCatalogSidebarVisibility(!catalogSidebarVisible) },
      { kind: "action", id: "catalog-toggle-inspector", label: catalogInspectorVisible ? "Hide Inspector" : "Show Inspector", shortcut: "⌥⌘I", onSelect: () => updateCatalogInspectorVisibility(!catalogInspectorVisible) },
    ];
  } else if (viewTarget === "finder") {
    viewItems = [
      { kind: "action", id: "finder-icon-view", label: "Icon View", checked: finderMode === "icons", onSelect: () => updateFinderMode("icons") },
      { kind: "action", id: "finder-list-view", label: "List View", checked: finderMode === "list", onSelect: () => updateFinderMode("list") },
      { kind: "separator", id: "finder-view-separator" },
      { kind: "action", id: "finder-toggle-sidebar", label: finderSidebarVisible ? "Hide Sidebar" : "Show Sidebar", shortcut: "⌃⌘S", onSelect: () => updateFinderSidebarVisibility(!finderSidebarVisible) },
      { kind: "action", id: "finder-toggle-preview", label: finderPreviewVisible ? "Hide Preview" : "Show Preview", shortcut: "⌥⌘P", onSelect: () => updateFinderPreviewVisibility(!finderPreviewVisible) },
    ];
  } else if (viewTarget === "chat") {
    viewItems = [
      { kind: "action", id: "chat-toggle-sidebar", label: chatSidebarVisible ? "Hide Sidebar" : "Show Sidebar", shortcut: "⌃⌘S", onSelect: () => updateChatSidebarVisibility(!chatSidebarVisible) },
    ];
  } else {
    viewItems = [{ kind: "action", id: `${viewTarget}-no-view-options`, label: "No View Options", disabled: true }];
  }
  const viewMenu: MenuBarMenu = { title: "View", items: viewItems };
  const menuItems = viewTarget === "catalog"
    ? ["File", "Edit", viewMenu, showcaseMenu, "Window", "Help"] as const
    : ["File", "Edit", viewMenu, "Window", "Help"] as const;

  return (
    <DesktopShell
      appName={keyAppName}
      menuItems={menuItems}
      onMenuAction={(command) => setStatus(`${command.menu} › ${command.label}`)}
      menuBarExtras={(
        <MacApp {...showcaseApps.activity}>
          <MenuBarExtra
            badge={extraCount}
            icon={<SystemSymbol name="sparkles" />}
            isOpen={activityExtraOpen}
            label="Showcase activity"
            onOpenChange={setActivityExtraOpen}
            triggerRef={activityTriggerRef}
          >
            <div className="showcase-extra-popover">
              <strong>Showcase activity</strong>
              <p>{extraCount === 0 ? "You’re all caught up." : `${extraCount} component notes are ready.`}</p>
              <button
                type="button"
                disabled={extraCount === 0}
                onClick={() => {
                  if (extraCount === 0) return;
                  setExtraCount(0);
                  setStatus("Showcase activity marked as read.");
                }}
              >
                Mark as Read
              </button>
              <button
                type="button"
                disabled={extraCount === 0}
                onClick={() => {
                  setActivityExtraOpen(false);
                  setActivityAlertOpen(true);
                }}
              >
                Clear Activity…
              </button>
            </div>
          </MenuBarExtra>
          <MacAlert
            actions={[
              { id: "cancel", label: "Cancel", role: "cancel" },
              {
                id: "clear",
                label: "Clear",
                role: "destructive",
                isDefault: true,
                onPress: () => {
                  setExtraCount(0);
                  setStatus("Showcase activity cleared by the menu-bar app.");
                },
              },
            ]}
            applicationName="Showcase Activity"
            fallbackFocusRef={activityTriggerRef}
            icon={<SystemSymbol name="sparkles" />}
            message="All component notes will be removed from the current activity list."
            onClose={() => setActivityAlertOpen(false)}
            open={activityAlertOpen}
            presentationScope="desktop"
            title="Clear the activity notes?"
          />
        </MacApp>
      )}
    >
      <MacApp {...showcaseApps.catalog}>
        <CatalogWindow
          activeStory={activeStory}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < storyHistory.length - 1}
          inspectorVisible={catalogInspectorVisible}
          query={query}
          sidebarVisible={catalogSidebarVisible}
          status={status}
          onBack={() => setHistoryIndex((current) => Math.max(0, current - 1))}
          onForward={() => setHistoryIndex((current) => Math.min(storyHistory.length - 1, current + 1))}
          onInspectorVisibleChange={updateCatalogInspectorVisibility}
          onOpenRecipe={activateRecipe}
          onQueryChange={setQuery}
          onSelectStory={selectStory}
          onSidebarVisibleChange={updateCatalogSidebarVisibility}
        />
      </MacApp>
      <MacApp {...showcaseApps.finder}>
        <FinderRecipe
          mode={finderMode}
          previewVisible={finderPreviewVisible}
          sidebarVisible={finderSidebarVisible}
          onClose={() => setStatus("Finder window closed.")}
          onModeChange={updateFinderMode}
          onPreviewVisibleChange={updateFinderPreviewVisibility}
          onSidebarVisibleChange={updateFinderSidebarVisibility}
        />
      </MacApp>
      <MacApp {...showcaseApps.chooser}>
        <ChooserRecipe onClose={() => setStatus("Chooser window closed.")} />
      </MacApp>
      <MacApp {...showcaseApps.setup}>
        <SetupRecipe
          onCancel={() => closeSetup("Setup Assistant cancelled.")}
          onClose={() => setStatus("Setup Assistant window closed.")}
          onComplete={() => closeSetup("Setup Assistant completed.")}
        />
      </MacApp>
      <MacApp {...showcaseApps.chat}>
        <ChatRecipe sidebarVisible={chatSidebarVisible} onClose={() => setStatus("Chat window closed.")} onSidebarVisibleChange={updateChatSidebarVisibility} />
      </MacApp>
      <MacApp {...showcaseApps.appStore}><SystemAppRecipe label="App Store" symbol="app" /></MacApp>
      <MacApp {...showcaseApps.chrome}><SystemAppRecipe label="Google Chrome" symbol="network" /></MacApp>
      <MacApp {...showcaseApps.downloads}><SystemAppRecipe label="Downloads" symbol="arrow.down.doc" /></MacApp>
      <MacApp {...showcaseApps.trash}><SystemAppRecipe label="Trash" symbol="xmark" /></MacApp>
      <MacAppDock label="Showcase Dock" />
    </DesktopShell>
  );
}
