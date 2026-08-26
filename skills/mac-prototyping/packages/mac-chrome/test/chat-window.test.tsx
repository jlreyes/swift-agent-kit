// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatWindow, type Conversation } from "../chat-window.tsx";

afterEach(cleanup);

const conversations: readonly Conversation[] = [
  {
    id: "design",
    title: "Design review",
    messages: [
      {
        id: "design-1",
        author: { name: "Alex", role: "agent" },
        at: "9:41 AM",
        body: "Ready for review.",
      },
    ],
  },
  {
    id: "release",
    title: "Release notes",
    messages: [
      {
        id: "release-1",
        author: { name: "You", role: "owner" },
        at: "10:02 AM",
        body: "Ship it.",
      },
    ],
  },
];

function ChatHarness() {
  const [activeConversationId, setActiveConversationId] = useState("design");
  const [message, setMessage] = useState("");
  return (
    <ChatWindow
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={setActiveConversationId}
      composer={{ value: message, onChange: setMessage, onSend: () => undefined }}
      sidebarLabel="Threads"
    />
  );
}

function ControlledSidebarHarness({ onChange }: { readonly onChange: (visible: boolean) => void }) {
  const [activeConversationId, setActiveConversationId] = useState("design");
  const [message, setMessage] = useState("");
  const [sidebarVisible, setSidebarVisible] = useState(false);

  function handleSidebarVisibleChange(visible: boolean) {
    onChange(visible);
    setSidebarVisible(visible);
  }

  return (
    <>
      <button type="button" onClick={() => setSidebarVisible((current) => !current)}>
        Toggle Sidebar from View menu
      </button>
      <ChatWindow
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        composer={{ value: message, onChange: setMessage, onSend: () => undefined }}
        sidebarLabel="Threads"
        sidebarVisible={sidebarVisible}
        onSidebarVisibleChange={handleSidebarVisibleChange}
      />
    </>
  );
}

describe("ChatWindow composition", () => {
  it("uses the shared split view and source list for controlled conversation selection", () => {
    const { container } = render(<ChatHarness />);

    expect(container.querySelector(".mc-navigation-split-view")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Threads" })).toBeTruthy();
    expect(screen.getAllByRole("separator")).toHaveLength(1);

    const design = screen.getByRole("row", { name: /Design review/ });
    expect(design.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("log", { name: "Conversation" }).textContent).toContain("Ready for review.");

    fireEvent.click(screen.getByRole("row", { name: /Release notes/ }));

    expect(screen.getByRole("row", { name: /Release notes/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("log", { name: "Conversation" }).textContent).toContain("Ship it.");
  });

  it("keeps the sidebar toolbar toggle and traffic-light placement working", () => {
    const { container } = render(<ChatHarness />);
    const window = container.querySelector<HTMLElement>(".mac-window.mc-chat-window");
    expect(window).toBeTruthy();
    expect(window?.querySelector(".mc-chat-sidebar-top[data-window-drag-handle]")).toBeTruthy();
    expect(window?.querySelectorAll(".traffic-lights button")).toHaveLength(3);
    expect(window?.querySelectorAll("[data-window-resize-handle]")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeTruthy();
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(screen.queryByRole("complementary", { name: "Threads" })).toBeNull();
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);
  });

  it("shares controlled sidebar visibility between external commands and the toolbar", () => {
    const onChange = vi.fn();
    render(<ControlledSidebarHarness onChange={onChange} />);
    expect(screen.queryByRole("complementary", { name: "Threads" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show sidebar" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar from View menu" }));
    expect(screen.getByRole("complementary", { name: "Threads" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide sidebar" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByLabelText("Window controls")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("complementary", { name: "Threads" })).toBeNull();
  });
});
