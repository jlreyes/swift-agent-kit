// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, useState, type FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacButton, MacForm } from "../controls.tsx";
import { MacEmbeddedPresentation } from "../embedded-presentation.tsx";
import { ChatWindow } from "../chat-window.tsx";

afterEach(cleanup);

function recordSubmission(callback: (submitter: HTMLElement | null) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(event.nativeEvent instanceof SubmitEvent)) throw new Error("Expected a real SubmitEvent");
    callback(event.nativeEvent.submitter);
  };
}

describe("embedded local forms", () => {
  it("runs validation and preserves the exact pressed submitter", async () => {
    const submitted = vi.fn();
    render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><input aria-label="Name" required /><MacButton type="submit">Save</MacButton><button type="submit">Publish</button></MacForm></MacEmbeddedPresentation>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await Promise.resolve();
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Workspace" } });
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    await waitFor(() => expect(submitted).toHaveBeenLastCalledWith(save));
    const publish = screen.getByRole("button", { name: "Publish" });
    fireEvent.click(publish);
    await waitFor(() => expect(submitted).toHaveBeenLastCalledWith(publish));
    expect(submitted).toHaveBeenCalledTimes(2);
  });

  it("observes state committed by the submit button press", async () => {
    const submitted = vi.fn();
    function Form() {
      const [value, setValue] = useState("Before press");
      return <MacForm onSubmit={(event) => { event.preventDefault(); submitted(value); }}><input aria-label="Value" value={value} readOnly /><MacButton type="submit" onPress={() => setValue("After press")}>Save state</MacButton></MacForm>;
    }
    render(<MacEmbeddedPresentation><Form /></MacEmbeddedPresentation>);
    fireEvent.click(screen.getByRole("button", { name: "Save state" }));
    await waitFor(() => expect(submitted).toHaveBeenCalledExactlyOnceWith("After press"));
  });

  it("cancels only marked submit-button keyboard defaults while retaining one React Aria press", async () => {
    const submitted = vi.fn();
    render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><MacButton type="submit">Save</MacButton><button type="button">Other action</button></MacForm></MacEmbeddedPresentation>);
    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    expect(fireEvent.keyDown(button, { key: " ", code: "Space" })).toBe(false);
    expect(fireEvent.keyUp(button, { key: " ", code: "Space" })).toBe(false);
    await waitFor(() => expect(submitted).toHaveBeenCalledExactlyOnceWith(button));
    expect(fireEvent.keyDown(screen.getByRole("button", { name: "Other action" }), { key: " ", code: "Space" })).toBe(true);
  });

  it("honors native submitter formNoValidate", async () => {
    const submitted = vi.fn();
    render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><input aria-label="Required value" required /><button type="submit" formNoValidate>Save draft</button></MacForm></MacEmbeddedPresentation>);
    const button = screen.getByRole("button", { name: "Save draft" });
    fireEvent.click(button);
    await waitFor(() => expect(submitted).toHaveBeenCalledExactlyOnceWith(button));
  });

  it("uses the first submitter for implicit Enter and stops at a disabled default", async () => {
    const submitted = vi.fn();
    const { rerender } = render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><input aria-label="Name" /><MacButton type="submit">Save</MacButton><button type="submit">Publish</button></MacForm></MacEmbeddedPresentation>);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Enter" });
    await waitFor(() => expect(submitted).toHaveBeenCalledExactlyOnceWith(screen.getByRole("button", { name: "Save" })));
    rerender(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><input aria-label="Name" /><MacButton type="submit" disabled>Save</MacButton><button type="submit">Publish</button></MacForm></MacEmbeddedPresentation>);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Enter" });
    await Promise.resolve();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it("keeps textarea Enter and input composition under their native owners", async () => {
    const submitted = vi.fn();
    render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><input aria-label="Name" /><textarea aria-label="Notes" /><MacButton type="submit">Save</MacButton></MacForm></MacEmbeddedPresentation>);
    expect(fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Enter", isComposing: true })).toBe(true);
    await Promise.resolve();
    expect(submitted).not.toHaveBeenCalled();
  });

  it("honors child click cancellation on native submit controls", async () => {
    const submitted = vi.fn();
    render(<MacEmbeddedPresentation><MacForm onSubmit={recordSubmission(submitted)}><button type="submit" onClick={(event) => event.preventDefault()}>Cancelled</button></MacForm></MacEmbeddedPresentation>);
    fireEvent.click(screen.getByRole("button", { name: "Cancelled" }));
    await Promise.resolve();
    expect(submitted).not.toHaveBeenCalled();
  });

  it.each([false, true])("honors ancestor click capture cancellation with embedded=%s", async (embedded) => {
    const submitted = vi.fn();
    const cancelled = vi.fn();
    const form = <div onClickCapture={(event) => { event.preventDefault(); cancelled(); }}><MacForm onSubmit={recordSubmission(submitted)}><MacButton type="submit">Cancelled save</MacButton></MacForm></div>;
    render(embedded ? <MacEmbeddedPresentation>{form}</MacEmbeddedPresentation> : form);
    fireEvent.click(screen.getByRole("button", { name: "Cancelled save" }));
    await Promise.resolve();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled();
  });

  it.each([false, true])("honors later ancestor click cancellation for native submitters with embedded=%s", async (embedded) => {
    const submitted = vi.fn();
    const cancelled = vi.fn();
    const form = <div onClick={(event) => { event.preventDefault(); cancelled(); }}><MacForm onSubmit={recordSubmission(submitted)}><button type="submit">Cancelled save</button></MacForm></div>;
    render(embedded ? <MacEmbeddedPresentation>{form}</MacEmbeddedPresentation> : form);
    fireEvent.click(screen.getByRole("button", { name: "Cancelled save" }));
    await Promise.resolve();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled();
  });

  it("keeps ordinary forms on the native synchronous submit path", () => {
    const submitted = vi.fn();
    render(<MacForm onSubmit={recordSubmission(submitted)}><MacButton type="submit">Save</MacButton></MacForm>);
    const button = screen.getByRole("button", { name: "Save" });
    fireEvent.click(button);
    expect(submitted).toHaveBeenCalledExactlyOnceWith(button);
  });

  it("sends embedded chat by click and Enter while preserving Shift+Enter and composition", async () => {
    const sent = vi.fn();
    render(<MacEmbeddedPresentation><ChatWindow conversations={[]} activeConversationId="none" onSelectConversation={() => undefined} composer={{ value: "Message body", onChange: () => undefined, onSend: sent }} /></MacEmbeddedPresentation>);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    const composer = screen.getByRole("textbox", { name: "Message" });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(sent).toHaveBeenCalledTimes(2);
    expect(fireEvent.keyDown(composer, { key: "Enter", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(composer, { key: "Enter", isComposing: true })).toBe(true);
    expect(sent).toHaveBeenCalledTimes(2);
  });
});
