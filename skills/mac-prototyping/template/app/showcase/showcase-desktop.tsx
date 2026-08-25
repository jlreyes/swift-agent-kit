"use client";

import { useMemo, useRef, useState } from "react";

import {
  ChatWindow,
  ChooserWindow,
  createStoredIdList,
  defaultDockItems,
  DesktopShell,
  FinderWindow,
  MacDetailsMenu,
  MacDock,
  MacMenu,
  MacToolbar,
  MenuBarExtra,
  SetupAssistant,
  SetupHeading,
  Sheet,
  SystemSymbol,
  ToolbarButton,
  ToolbarCapsule,
  ToolbarGlyph,
  ToolbarSearchBubble,
  ToolbarToggle,
  TrafficLights,
  WindowChrome,
  type ChatMessage,
  type ChooserChoice,
  type DockItem,
  type FinderEntry,
  type FinderViewMode,
  type MenuBarMenu,
  type MenuSpec,
  type SidebarSection,
  type SetupStep,
  type SystemSymbolName,
} from "../../lib/mac-chrome/index.ts";

type StoryId = "toolbar" | "finder" | "chooser" | "setup" | "chat";
type ToolbarViewMode = "grid" | "list";

const stories: ReadonlyArray<{ readonly id: StoryId; readonly label: string }> = [
  { id: "toolbar", label: "Window + Toolbar" },
  { id: "finder", label: "Finder" },
  { id: "chooser", label: "Chooser" },
  { id: "setup", label: "Setup Assistant" },
  { id: "chat", label: "Chat" },
];

/**
 * Runtime-export coverage map for the embedded showcase. Hooks and pure
 * helpers are represented by the surface whose behavior exercises them.
 */
export const coveredExports = [
  "ChatWindow",
  "ChooserWindow",
  "createStoredIdList",
  "defaultDockItems",
  "DesktopShell",
  "finderKeyTarget",
  "FinderWindow",
  "MacDetailsMenu",
  "MacDock",
  "MacMenu",
  "MacToolbar",
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
  "useWindowDrag",
  "WindowChrome",
] as const;

const finderEntries: readonly FinderEntry[] = [
  {
    id: "brief",
    name: "Project Brief.md",
    kind: "document",
    icon: <SystemSymbol name="doc.text.fill" />,
    modified: "Today, 10:24 AM",
    size: "18 KB",
  },
  {
    id: "references",
    name: "References",
    kind: "folder",
    icon: <SystemSymbol name="folder" />,
    modified: "Yesterday",
    size: "—",
  },
  {
    id: "research",
    name: "Research Notes.md",
    kind: "document",
    icon: <SystemSymbol name="doc.text.fill" />,
    modified: "Monday",
    size: "42 KB",
  },
  {
    id: "archive",
    name: "Archive",
    kind: "folder",
    icon: <SystemSymbol name="folder" />,
    modified: "Aug 18",
    size: "—",
  },
];

const chooserChoices: readonly ChooserChoice[] = [
  {
    id: "personal",
    symbol: "person.crop.circle",
    title: "Personal",
    caption: "A private workspace for one person",
    preview: <StoryPreview symbol="person.crop.circle" title="Personal workspace" detail="A focused starting point with private defaults." />,
  },
  {
    id: "team",
    symbol: "person.2.fill",
    title: "Team",
    caption: "Shared work for a small group",
    preview: <StoryPreview symbol="person.2.fill" title="Team workspace" detail="A shared space with roles and collaborative activity." />,
  },
  {
    id: "organization",
    symbol: "building.2.fill",
    title: "Organization",
    caption: "Structured access across departments",
    preview: <StoryPreview symbol="building.2.fill" title="Organization workspace" detail="A structured home for multiple groups and policies." />,
  },
];

const setupSteps: readonly SetupStep[] = [
  { id: "welcome", name: "Welcome", symbol: "sparkles" },
  { id: "account", name: "Account", symbol: "person.crop.circle" },
  { id: "privacy", name: "Privacy", symbol: "shield.fill" },
];

// The helper is intentionally instantiated by a showcase fixture even though
// the chooser's primary interaction state is React-owned. This keeps its
// same-tab/cross-tab persistence contract exercised in a realistic client.
const recentChoiceIds = createStoredIdList("mac-chrome-showcase-recent-choices", (id) =>
  chooserChoices.some((choice) => choice.id === id),
);

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

function ToolbarStory({ inspectorOpen, view, onInspectorOpenChange, onViewChange }: {
  readonly inspectorOpen: boolean;
  readonly view: ToolbarViewMode;
  readonly onInspectorOpenChange: (open: boolean) => void;
  readonly onViewChange: (mode: ToolbarViewMode) => void;
}) {
  const [query, setQuery] = useState("");
  const [lastAction, setLastAction] = useState("Ready");

  const actionMenu: MenuSpec = [
    { kind: "section", id: "create", label: "Create" },
    { kind: "action", id: "new-folder", label: "New Folder", shortcut: "⇧⌘N", icon: <SystemSymbol name="folder.badge.plus" />, onSelect: () => setLastAction("Created a folder") },
    { kind: "action", id: "new-document", label: "New Document", shortcut: "⌘N", icon: <SystemSymbol name="doc.text.fill" />, onSelect: () => setLastAction("Created a document") },
    { kind: "separator", id: "create-separator" },
    { kind: "action", id: "refresh", label: "Refresh", icon: <SystemSymbol name="arrow.triangle.2.circlepath" />, onSelect: () => setLastAction("Refreshed") },
  ];

  return (
    <WindowChrome
      label="Window and toolbar showcase"
      frame={{
        top: 64,
        left: "max(12px, calc(50% - 450px))",
        width: "min(900px, calc(100vw - 24px))",
        height: "min(560px, calc(100vh - 154px))",
      }}
    >
      <MacToolbar
        leading={
          <div className="showcase-toolbar-leading">
            <TrafficLights />
            <ToolbarCapsule divided role="group" label="History">
              <ToolbarButton label="Back" onClick={() => setLastAction("Back")}><ToolbarGlyph name="back" /></ToolbarButton>
              <ToolbarButton label="Forward" disabled onClick={() => setLastAction("Forward")}><ToolbarGlyph name="forward" /></ToolbarButton>
            </ToolbarCapsule>
          </div>
        }
        title="Library"
        trailing={
          <>
            <ToolbarCapsule divided role="group" label="View">
              <ToolbarButton label="Icon view" pressed={view === "grid"} selected={view === "grid"} onClick={() => onViewChange("grid")}>
                <ToolbarGlyph name="grid" />
              </ToolbarButton>
              <ToolbarButton label="List view" pressed={view === "list"} selected={view === "list"} onClick={() => onViewChange("list")}>
                <ToolbarGlyph name="list" />
              </ToolbarButton>
            </ToolbarCapsule>
            <ToolbarToggle label="Toggle inspector" pressed={inspectorOpen} onPressedChange={onInspectorOpenChange}>
              <ToolbarGlyph name="inspector" />
            </ToolbarToggle>
            <MacMenu
              triggerClassName="mc-toolbar-button"
              trigger={<ToolbarGlyph name="more" />}
              triggerLabel="More actions"
              label="More actions"
              items={actionMenu}
            />
            <MacDetailsMenu
              className="showcase-toolbar-details"
              label="Account menu"
              summary={<SystemSymbol name="person.crop.circle" />}
            >
              <div className="showcase-account-menu">
                <strong>Example Account</strong>
                <small>Local showcase profile</small>
                <button type="button" onClick={() => setLastAction("Opened account settings")}>Account Settings…</button>
              </div>
            </MacDetailsMenu>
            <ToolbarSearchBubble value={query} onChange={setQuery} placeholder="Search Library" />
          </>
        }
      />
      <div className={`showcase-library-layout${inspectorOpen ? " has-inspector" : ""}`}>
        <section className="showcase-library-content" aria-label="Library content">
          <div className={`showcase-library-items is-${view}`}>
            {["Briefs", "References", "Research", "Archive"].filter((label) => label.toLowerCase().includes(query.toLowerCase())).map((label) => (
              <button type="button" key={label} onClick={() => setLastAction(`Selected ${label}`)}>
                <SystemSymbol name={label === "Briefs" || label === "Research" ? "doc.text.fill" : "folder"} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
        {inspectorOpen ? (
          <aside className="showcase-inspector" aria-label="Inspector">
            <SystemSymbol name="sidebar.trailing" />
            <strong>Inspector</strong>
            <p>Selection details appear here.</p>
          </aside>
        ) : null}
      </div>
      <output className="showcase-window-status" aria-live="polite">{lastAction}</output>
    </WindowChrome>
  );
}

function FinderStory({ mode, previewVisible, onModeChange, onPreviewVisibleChange }: {
  readonly mode: FinderViewMode;
  readonly previewVisible: boolean;
  readonly onModeChange: (mode: FinderViewMode) => void;
  readonly onPreviewVisibleChange: (visible: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>("brief");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Documents");
  const [lastAction, setLastAction] = useState("Select an item, then press Space for Quick Look.");

  const sidebar: readonly SidebarSection[] = [
    {
      id: "favorites",
      title: "Favorites",
      collapsible: true,
      items: [
        { id: "recents", label: "Recents", icon: <SystemSymbol name="arrow.triangle.2.circlepath" />, selected: location === "Recents", onSelect: () => setLocation("Recents") },
        { id: "documents", label: "Documents", icon: <SystemSymbol name="doc.text.fill" />, badge: 4, selected: location === "Documents", onSelect: () => setLocation("Documents") },
      ],
    },
    {
      id: "locations",
      title: "Locations",
      items: [
        { id: "cloud", label: "Shared Server", icon: <SystemSymbol name="network" />, selected: location === "Shared Server", onSelect: () => setLocation("Shared Server") },
      ],
    },
  ];
  const shownEntries = finderEntries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <FinderWindow
      title={location}
      label="Finder showcase"
      frame={{
        top: 54,
        left: "max(12px, calc(50% - 480px))",
        width: "min(960px, calc(100vw - 24px))",
        height: "min(590px, calc(100vh - 144px))",
      }}
      sidebar={sidebar}
      entries={shownEntries}
      mode={mode}
      onModeChange={onModeChange}
      previewVisible={previewVisible}
      onPreviewVisibleChange={onPreviewVisibleChange}
      search={{ value: query, onChange: setQuery }}
      selection={{ selectedId, onSelect: setSelectedId }}
      onOpen={(entry) => setLastAction(`Opened ${entry.name}`)}
      preview={(entry) => entry === null ? (
        <p className="showcase-empty-preview">Select an item to preview it.</p>
      ) : (
        <StoryPreview
          symbol={entry.kind === "folder" ? "folder" : "doc.text.fill"}
          title={entry.name}
          detail={[entry.modified, entry.size].filter(Boolean).join(" · ")}
        />
      )}
      statusBar={<span>{shownEntries.length} items · {lastAction}</span>}
      toolbarExtras={
        <ToolbarButton label="Create folder" onClick={() => setLastAction("Created a folder")}>
          <SystemSymbol name="folder.badge.plus" />
        </ToolbarButton>
      }
      iconColumns={4}
    />
  );
}

function ChooserStory() {
  const recentIds = recentChoiceIds.useStoredIds();
  const [selectedId, setSelectedId] = useState<string | null>("personal");
  const [lastAction, setLastAction] = useState("Choose a workspace type.");

  function select(id: string) {
    setSelectedId(id);
    recentChoiceIds.add(id);
  }

  return (
    <ChooserWindow
      title="Choose a workspace"
      subtitle="Start with a shape that matches how you work."
      finePrint={recentIds.length > 0 ? `Recently viewed: ${recentIds.length}` : "You can change this later."}
      windowTitle="New Workspace"
      label="Chooser showcase"
      frame={{
        top: 72,
        left: "max(12px, calc(50% - 420px))",
        width: "min(840px, calc(100vw - 24px))",
        height: "min(530px, calc(100vh - 162px))",
      }}
      choices={chooserChoices}
      selected={selectedId}
      onSelect={select}
      onActivate={(id) => setLastAction(`Opened ${chooserChoices.find((choice) => choice.id === id)?.title ?? id}`)}
      secondaryGroup={{
        label: "More Options",
        caption: "Import or connect instead",
        activeCaption: "An alternate path is active",
        sections: [
          {
            id: "other",
            commands: [
              { id: "import", title: "Import a workspace…", symbol: "doc.badge.arrow.down", onSelect: () => setLastAction("Import selected") },
              { id: "connect", title: "Connect to a server…", symbol: "network", onSelect: () => setLastAction("Connect selected") },
            ],
          },
        ],
      }}
      footer={
        <>
          <span className="showcase-footer-status" aria-live="polite">{lastAction}</span>
          <button type="button" className="mc-button mc-primary" disabled={selectedId === null} onClick={() => setLastAction("Workspace created")}>Create</button>
        </>
      }
    />
  );
}

function SetupStory() {
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetFallbackRef = useRef<HTMLButtonElement>(null);
  const step = setupSteps[stepIndex] ?? setupSteps[0];

  function selectStep(id: string) {
    const index = setupSteps.findIndex((candidate) => candidate.id === id);
    if (index >= 0 && index <= furthestIndex) setStepIndex(index);
  }

  return (
    <SetupAssistant
      label="Setup Assistant showcase"
      frame={{
        top: 58,
        left: "max(12px, calc(50% - 370px))",
        width: "min(740px, calc(100vw - 24px))",
        height: "min(580px, calc(100vh - 148px))",
      }}
      steps={setupSteps}
      currentStep={step.id}
      furthestIndex={furthestIndex}
      onSelectStep={selectStep}
      onBack={() => setStepIndex((current) => Math.max(0, current - 1))}
      onContinue={() => {
        const next = Math.min(setupSteps.length - 1, stepIndex + 1);
        setFurthestIndex((current) => Math.max(current, next));
        setStepIndex(next);
      }}
      backLabel={stepIndex === 0 ? "Not Now" : "Back"}
      continueLabel={stepIndex === setupSteps.length - 1 ? "Finish" : "Continue"}
      modalOpen={sheetOpen}
    >
      <SetupHeading symbol={step.symbol} title={step.name} />
      <div className="showcase-setup-copy">
        <p>{step.id === "welcome" ? "A guided path through the standard setup surface." : step.id === "account" ? "Connect an example account when you are ready." : "Review local privacy controls before finishing."}</p>
        <button ref={sheetFallbackRef} type="button" className="mc-button" onClick={() => setSheetOpen(true)}>Show Details…</button>
      </div>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label={`${step.name} details`}
        fallbackFocusRef={sheetFallbackRef}
        initialFocusSelector="[data-sheet-close]"
      >
        <SetupHeading symbol={step.symbol} title={`${step.name} Details`} />
        <p>This attached sheet demonstrates modal focus, Escape dismissal, and focus restoration.</p>
        <footer>
          <button data-sheet-close="" type="button" className="mc-button mc-primary" onClick={() => setSheetOpen(false)}>Done</button>
        </footer>
      </Sheet>
    </SetupAssistant>
  );
}

function ChatStory() {
  const [activeConversationId, setActiveConversationId] = useState("project");
  const [composerValue, setComposerValue] = useState("");
  const [query, setQuery] = useState("");
  const [sentMessages, setSentMessages] = useState<readonly ChatMessage[]>([]);
  const owner = useMemo(() => ({ name: "You", role: "owner" as const }), []);
  const agent = useMemo(() => ({ name: "Assistant", role: "agent" as const, icon: <SystemSymbol name="sparkles" /> }), []);
  const conversations = [
    {
      id: "project",
      title: "Project Notes",
      icon: <SystemSymbol name="doc.text.fill" />,
      messages: [
        { id: "one", author: owner, at: "9:41 AM", body: "Can you summarize the open decisions?" },
        { id: "two", author: agent, at: "9:42 AM", body: "There are three decisions ready for review." },
        { id: "system", author: { name: "System", role: "system" as const }, at: "9:43 AM", body: "Draft saved locally." },
        ...sentMessages,
      ],
    },
    {
      id: "research",
      title: "Research",
      icon: <SystemSymbol name="magnifyingglass" />,
      messages: [{ id: "research-one", author: agent, at: "Yesterday", body: "The reference set is ready." }],
    },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleConversations = normalizedQuery.length === 0
    ? conversations
    : conversations.flatMap((conversation) => {
        const titleMatches = conversation.title.toLocaleLowerCase().includes(normalizedQuery);
        const matchingMessages = titleMatches
          ? conversation.messages
          : conversation.messages.filter((message) =>
              typeof message.body === "string" && message.body.toLocaleLowerCase().includes(normalizedQuery));
        return matchingMessages.length === 0 ? [] : [{ ...conversation, messages: matchingMessages }];
      });
  const visibleActiveConversationId = visibleConversations.some((conversation) => conversation.id === activeConversationId)
    ? activeConversationId
    : visibleConversations[0]?.id ?? activeConversationId;

  return (
    <ChatWindow
      label="Chat showcase"
      frame={{
        top: 65,
        left: "max(12px, calc(50% - 390px))",
        width: "min(780px, calc(100vw - 24px))",
        height: "min(550px, calc(100vh - 155px))",
      }}
      conversations={visibleConversations}
      activeConversationId={visibleActiveConversationId}
      onSelectConversation={setActiveConversationId}
      search={{ value: query, onChange: setQuery }}
      toolbarExtras={
        <MacDetailsMenu
          className="showcase-toolbar-details"
          label="Conversation details"
          summary={<SystemSymbol name="person.2.fill" />}
        >
          <div className="showcase-conversation-details">
            <strong>Participants</strong>
            <span>You · Owner</span>
            <span>Assistant · Agent</span>
          </div>
        </MacDetailsMenu>
      }
      emptyTranscript={<p className="showcase-chat-empty">No matching conversations or messages.</p>}
      composer={{
        value: composerValue,
        onChange: setComposerValue,
        placeholder: "Message",
        accessory: (
          <ToolbarButton label="Add attachment" onClick={() => setComposerValue((current) => `${current}${current ? " " : ""}[Attachment]`)}>
            <SystemSymbol name="folder.badge.plus" />
          </ToolbarButton>
        ),
        onSend: () => {
          const body = composerValue.trim();
          if (!body) return;
          setSentMessages((current) => [...current, { id: `sent-${current.length}`, author: owner, at: "Now", body, status: "Sent" }]);
          setComposerValue("");
        },
      }}
    />
  );
}

function ActiveStory({
  story,
  toolbarInspectorOpen,
  toolbarView,
  finderMode,
  finderPreviewVisible,
  onToolbarInspectorOpenChange,
  onToolbarViewChange,
  onFinderModeChange,
  onFinderPreviewVisibleChange,
}: {
  readonly story: StoryId;
  readonly toolbarInspectorOpen: boolean;
  readonly toolbarView: ToolbarViewMode;
  readonly finderMode: FinderViewMode;
  readonly finderPreviewVisible: boolean;
  readonly onToolbarInspectorOpenChange: (open: boolean) => void;
  readonly onToolbarViewChange: (mode: ToolbarViewMode) => void;
  readonly onFinderModeChange: (mode: FinderViewMode) => void;
  readonly onFinderPreviewVisibleChange: (visible: boolean) => void;
}) {
  if (story === "finder") {
    return (
      <FinderStory
        mode={finderMode}
        previewVisible={finderPreviewVisible}
        onModeChange={onFinderModeChange}
        onPreviewVisibleChange={onFinderPreviewVisibleChange}
      />
    );
  }
  if (story === "chooser") return <ChooserStory />;
  if (story === "setup") return <SetupStory />;
  if (story === "chat") return <ChatStory />;
  return (
    <ToolbarStory
      inspectorOpen={toolbarInspectorOpen}
      view={toolbarView}
      onInspectorOpenChange={onToolbarInspectorOpenChange}
      onViewChange={onToolbarViewChange}
    />
  );
}

export function ShowcaseDesktop() {
  const [activeStory, setActiveStory] = useState<StoryId>("toolbar");
  const [extraCount, setExtraCount] = useState(2);
  const [toolbarInspectorOpen, setToolbarInspectorOpen] = useState(true);
  const [toolbarView, setToolbarView] = useState<ToolbarViewMode>("grid");
  const [finderMode, setFinderMode] = useState<FinderViewMode>("icons");
  const [finderPreviewVisible, setFinderPreviewVisible] = useState(true);
  const [shellStatus, setShellStatus] = useState("Mac Chrome Showcase is ready.");
  const activeLabel = stories.find((story) => story.id === activeStory)?.label ?? "Window + Toolbar";
  const showcaseMenu: MenuBarMenu = {
    title: "Showcase",
    items: stories.map((story) => ({
      kind: "action",
      id: story.id,
      label: story.label,
      checked: story.id === activeStory,
      onSelect: () => setActiveStory(story.id),
    })),
  };
  const viewMenu: MenuBarMenu | "View" = activeStory === "toolbar"
    ? {
        title: "View",
        items: [
          {
            kind: "action",
            id: "icon-view",
            label: "as Icons",
            shortcut: "⌘1",
            checked: toolbarView === "grid",
            onSelect: () => {
              setToolbarView("grid");
              setShellStatus("View › as Icons");
            },
          },
          {
            kind: "action",
            id: "list-view",
            label: "as List",
            shortcut: "⌘2",
            checked: toolbarView === "list",
            onSelect: () => {
              setToolbarView("list");
              setShellStatus("View › as List");
            },
          },
          { kind: "separator", id: "view-separator" },
          {
            kind: "action",
            id: "toggle-inspector",
            label: toolbarInspectorOpen ? "Hide Inspector" : "Show Inspector",
            shortcut: "⌥⌘I",
            onSelect: () => {
              setToolbarInspectorOpen((open) => !open);
              setShellStatus(`View › ${toolbarInspectorOpen ? "Hide" : "Show"} Inspector`);
            },
          },
        ],
      }
    : activeStory === "finder"
      ? {
          title: "View",
          items: [
            {
              kind: "action",
              id: "icon-view",
              label: "as Icons",
              shortcut: "⌘1",
              checked: finderMode === "icons",
              onSelect: () => {
                setFinderMode("icons");
                setShellStatus("View › as Icons");
              },
            },
            {
              kind: "action",
              id: "list-view",
              label: "as List",
              shortcut: "⌘2",
              checked: finderMode === "list",
              onSelect: () => {
                setFinderMode("list");
                setShellStatus("View › as List");
              },
            },
            { kind: "separator", id: "view-separator" },
            {
              kind: "action",
              id: "toggle-preview",
              label: finderPreviewVisible ? "Hide Preview" : "Show Preview",
              shortcut: "⇧⌘P",
              onSelect: () => {
                setFinderPreviewVisible((visible) => !visible);
                setShellStatus(`View › ${finderPreviewVisible ? "Hide" : "Show"} Preview`);
              },
            },
          ],
        }
      : "View";
  const showcaseDockItems: readonly DockItem[] = [
    ...defaultDockItems.filter((item) => item.group === "apps"),
    {
      id: "mac-chrome-showcase",
      label: "Mac Chrome Showcase",
      icon: <span className="showcase-app-icon"><SystemSymbol name="laptopcomputer" /></span>,
      running: true,
      group: "apps",
      onActivate: () => setShellStatus("Mac Chrome Showcase is already open."),
    },
    ...defaultDockItems.filter((item) => item.group !== "apps"),
  ];

  return (
    <DesktopShell
      appName="Mac Chrome"
      menuItems={[showcaseMenu, viewMenu, "Window", "Help"]}
      onMenuAction={(command) => setShellStatus(`${command.menu} › ${command.label}`)}
      menuBarExtras={
        <MenuBarExtra badge={extraCount} icon={<SystemSymbol name="sparkles" />} label="Showcase activity">
          <div className="showcase-extra-popover">
            <strong>Showcase activity</strong>
            <p>{extraCount === 0 ? "You’re all caught up." : `${extraCount} component notes are ready.`}</p>
            <button type="button" onClick={() => setExtraCount(0)}>Mark as Read</button>
          </div>
        </MenuBarExtra>
      }
    >
      <div className="showcase-story-layer" data-showcase-story={activeStory} aria-label={`${activeLabel} story`}>
        <ActiveStory
          story={activeStory}
          toolbarInspectorOpen={toolbarInspectorOpen}
          toolbarView={toolbarView}
          finderMode={finderMode}
          finderPreviewVisible={finderPreviewVisible}
          onToolbarInspectorOpenChange={setToolbarInspectorOpen}
          onToolbarViewChange={setToolbarView}
          onFinderModeChange={setFinderMode}
          onFinderPreviewVisibleChange={setFinderPreviewVisible}
        />
      </div>
      <output className="showcase-desktop-status" aria-live="polite">{shellStatus}</output>
      <MacDock label="Showcase Dock" items={showcaseDockItems} />
    </DesktopShell>
  );
}
