"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  MacNavigationSplitView,
  MacSourceList,
  type MacSourceListSection,
} from "./navigation";
import { SystemSymbol } from "./system-symbol";
import { MacToolbar, ToolbarButton, ToolbarSearchBubble } from "./toolbar";
import { TrafficLights, WindowChrome, type WindowFrame } from "./window";
import "./styles/tokens.css";
import "./styles/chat.css";

/* Default geometry (Messages-ish proportions on the 1200px canvas). */
const chatDefaultSize = { width: 760, height: 540 } as const;
const chatMinSize = { width: 520, height: 360 } as const;

export type ChatRole = "owner" | "agent" | "system";

export type ChatAuthor = {
  readonly name: string;
  readonly icon?: ReactNode;
  readonly role: ChatRole;
};

export type ChatMessage = {
  readonly id: string;
  readonly author: ChatAuthor;
  readonly at: string;
  readonly body: ReactNode;
  readonly status?: string;
};

export type Conversation = {
  readonly id: string;
  readonly title: string;
  readonly icon?: ReactNode;
  readonly messages: readonly ChatMessage[];
};

export type ChatComposer = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly placeholder?: string;
  // Leading control slot (e.g. an attach/add menu trigger).
  readonly accessory?: ReactNode;
};

export type ChatSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

function ChatMessageRow({ message }: { readonly message: ChatMessage }) {
  // Three-party grammar: owner right-aligned bubble, agent left-aligned with
  // its icon, system centered and tinted.
  if (message.author.role === "owner") {
    return (
      <div className="mc-chat-message mc-owner">
        <p className="mc-chat-bubble">
          {message.body}
          <small>{message.at}</small>
        </p>
        {message.status !== undefined ? <small className="mc-chat-status">{message.status}</small> : null}
      </div>
    );
  }
  if (message.author.role === "agent") {
    return (
      <div className="mc-chat-message mc-agent">
        {message.author.icon !== undefined ? (
          <span className="mc-chat-author-icon" aria-hidden="true">{message.author.icon}</span>
        ) : (
          <span className="mc-chat-author-icon mc-placeholder" aria-hidden="true" />
        )}
        <div>
          <span className="mc-chat-author-name">{message.author.name}</span>
          <p className="mc-chat-bubble">
            {message.body}
            <small>{message.at}</small>
          </p>
          {message.status !== undefined ? <small className="mc-chat-status">{message.status}</small> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="mc-chat-message mc-system">
      <p>{message.body}</p>
      <small>{message.at}</small>
    </div>
  );
}

export function ChatWindow({
  conversations,
  activeConversationId,
  onSelectConversation,
  composer,
  search,
  sidebarLabel = "Conversations",
  sidebarVisible,
  onSidebarVisibleChange,
  toolbarExtras,
  emptyTranscript,
  label,
  frame,
  onClose,
  onMinimize,
  onZoom,
}: {
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly composer: ChatComposer;
  readonly search?: ChatSearch;
  readonly sidebarLabel?: string;
  /** Controlled sidebar visibility. Omit to keep the default-visible internal state. */
  readonly sidebarVisible?: boolean;
  readonly onSidebarVisibleChange?: (visible: boolean) => void;
  readonly toolbarExtras?: ReactNode;
  readonly emptyTranscript?: ReactNode;
  readonly label?: string;
  /** Placement/size override; defaults to ~760x540, centered. */
  readonly frame?: WindowFrame;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
}) {
  const [uncontrolledSidebarVisible, setUncontrolledSidebarVisible] = useState(true);
  const isSidebarVisible = sidebarVisible ?? uncontrolledSidebarVisible;
  const [searchOpen, setSearchOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const messageCount = active?.messages.length ?? 0;
  const conversationSections: readonly MacSourceListSection[] = [
    {
      id: "conversations",
      items: conversations.map((conversation) => ({
        id: conversation.id,
        label: conversation.title,
        icon: conversation.icon,
        badge: conversation.messages.at(-1)?.at,
      })),
    },
  ];

  useEffect(() => {
    const scroller = transcriptRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messageCount, activeConversationId]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (composer.value.trim()) composer.onSend();
  }

  function setSidebarVisibility(visible: boolean) {
    if (sidebarVisible === undefined) setUncontrolledSidebarVisible(visible);
    onSidebarVisibleChange?.(visible);
  }

  function toggleSidebar() {
    setSidebarVisibility(!isSidebarVisible);
  }

  return (
    <WindowChrome
      className={`mc-chat-window${isSidebarVisible ? "" : " mc-sidebar-hidden"}`}
      label={label ?? active?.title ?? "Chat"}
      frame={frame}
      defaultSize={chatDefaultSize}
      minSize={chatMinSize}
      onClose={onClose}
      onMinimize={onMinimize}
      onZoom={onZoom}
    >
      <MacNavigationSplitView
        className="mc-chat-split-view"
        sidebarVisible={isSidebarVisible}
        sidebarLabel={sidebarLabel}
        sidebarSizing={{ minSize: 190, defaultSize: 246, maxSize: 320 }}
        detailLabel="Chat"
        sidebar={(
          <div className="mc-chat-sidebar">
            <div className="mc-chat-sidebar-top" data-window-drag-handle="">
              <TrafficLights />
            </div>
            <MacSourceList
              className="mc-chat-thread-list"
              label={sidebarLabel}
              sections={conversationSections}
              selectedId={activeConversationId}
              onSelectionChange={onSelectConversation}
            />
          </div>
        )}
        detail={(
          <section className="mc-chat-main">
            <MacToolbar className="mc-chat-toolbar">
              <div className="mc-chat-toolbar-lead">
                {!isSidebarVisible ? <TrafficLights /> : null}
                <ToolbarButton
                  label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  pressed={isSidebarVisible}
                  onClick={toggleSidebar}
                >
                  <SystemSymbol name="sidebar.left" />
                </ToolbarButton>
              </div>
              <div className="mc-chat-title">
                {active?.icon !== undefined ? <span className="mc-chat-title-icon" aria-hidden="true">{active.icon}</span> : null}
                <strong>{active?.title}</strong>
              </div>
              <div className="mc-chat-toolbar-actions">
                {search !== undefined ? (
                  <ToolbarSearchBubble
                    open={searchOpen}
                    value={search.value}
                    label="Search conversation"
                    placeholder="Search"
                    onOpenChange={(open) => {
                      setSearchOpen(open);
                      if (!open) search.onChange("");
                    }}
                    onChange={search.onChange}
                  />
                ) : null}
                {toolbarExtras}
              </div>
            </MacToolbar>
            <div className="mc-chat-transcript" ref={transcriptRef} role="log" aria-label="Conversation">
              {active !== null && active.messages.length > 0
                ? active.messages.map((message) => <ChatMessageRow key={message.id} message={message} />)
                : emptyTranscript}
            </div>
            <div className="mc-chat-composer-wrap">
              <form className="mc-chat-composer" onSubmit={send}>
                {composer.accessory !== undefined ? composer.accessory : <span className="mc-chat-composer-spacer" />}
                <textarea
                  value={composer.value}
                  rows={1}
                  onChange={(event) => composer.onChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={composer.placeholder}
                  aria-label={composer.placeholder ?? "Message"}
                />
                <button type="submit" className="mc-chat-send" disabled={!composer.value.trim()} aria-label="Send message">
                  <SystemSymbol name="arrow.up" />
                </button>
              </form>
            </div>
          </section>
        )}
      />
    </WindowChrome>
  );
}
