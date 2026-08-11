import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { SystemSymbol } from "./system-symbol";
import { MacToolbar, ToolbarButton, ToolbarSearchBubble } from "./toolbar";
import { TrafficLights, WindowChrome } from "./window";
import "./styles/tokens.css";
import "./styles/chat.css";

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
  toolbarExtras,
  emptyTranscript,
  label,
}: {
  readonly conversations: readonly Conversation[];
  readonly activeConversationId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly composer: ChatComposer;
  readonly search?: ChatSearch;
  readonly sidebarLabel?: string;
  readonly toolbarExtras?: ReactNode;
  readonly emptyTranscript?: ReactNode;
  readonly label?: string;
}) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const messageCount = active?.messages.length ?? 0;

  useEffect(() => {
    const scroller = transcriptRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messageCount, activeConversationId]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (composer.value.trim()) composer.onSend();
  }

  return (
    <WindowChrome
      className={`mc-chat-window${sidebarHidden ? " mc-sidebar-hidden" : ""}`}
      label={label ?? active?.title ?? "Chat"}
    >
      <aside className="mc-chat-sidebar" aria-label={sidebarLabel} aria-hidden={sidebarHidden || undefined}>
        <div className="mc-chat-sidebar-top">
          <TrafficLights />
        </div>
        <nav>
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            const lastAt = conversation.messages.at(-1)?.at;
            return (
              <button
                type="button"
                key={conversation.id}
                className={`mc-chat-thread${isActive ? " mc-selected" : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectConversation(conversation.id)}
              >
                {conversation.icon !== undefined ? (
                  <span className="mc-chat-thread-icon" aria-hidden="true">{conversation.icon}</span>
                ) : null}
                <span>
                  <strong>{conversation.title}</strong>
                  {lastAt !== undefined ? <small>{lastAt}</small> : null}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <section className="mc-chat-main">
        <MacToolbar className="mc-chat-toolbar">
          <div className="mc-chat-toolbar-lead">
            {sidebarHidden ? <TrafficLights /> : null}
            <ToolbarButton
              label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
              pressed={!sidebarHidden}
              onClick={() => setSidebarHidden((current) => !current)}
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
    </WindowChrome>
  );
}
