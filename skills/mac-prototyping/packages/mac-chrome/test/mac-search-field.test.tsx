// @vitest-environment jsdom
import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MacSearchField } from "../controls.tsx";

afterEach(cleanup);

describe("MacSearchField", () => {
  it("exposes its input ref, accepts controlled changes, and clears back into the input", () => {
    const ref = createRef<HTMLInputElement>();
    function Field() {
      const [value, setValue] = useState("");
      return <MacSearchField ref={ref} ariaLabel="Search templates" value={value} onChange={setValue} />;
    }
    render(<Field />);
    const input = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search templates" });
    expect(ref.current).toBe(input);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    fireEvent.change(input, { target: { value: "letter" } });
    expect(input.value).toBe("letter");
    const clear = screen.getByRole<HTMLButtonElement>("button", { name: "Clear search" });
    expect(input.tabIndex).toBe(0);
    expect(clear.tabIndex).toBe(-1);
    act(() => clear.focus());
    fireEvent.click(clear);
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("submits the current query and consumes Escape only while it clears", () => {
    const parentKeyDown = vi.fn();
    const onSubmit = vi.fn();
    function Field() {
      const [value, setValue] = useState("brief");
      return <div onKeyDown={parentKeyDown}><MacSearchField label="Find templates" ariaLabel="Unused label" value={value} onChange={setValue} onSubmit={onSubmit} /></div>;
    }
    render(<Field />);
    const input = screen.getByRole<HTMLInputElement>("searchbox", { name: "Find templates" });
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("brief");
    parentKeyDown.mockClear();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
    expect(parentKeyDown).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(parentKeyDown).toHaveBeenCalledOnce();
  });

  it("keeps read-only and disabled queries immutable", () => {
    const onChange = vi.fn();
    const { rerender } = render(<MacSearchField ariaLabel="Search templates" value="brief" readOnly onChange={onChange} />);
    const input = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search templates" });
    expect(input.readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    rerender(<MacSearchField ariaLabel="Search templates" value="brief" disabled onChange={onChange} />);
    expect(input.disabled).toBe(true);
    const clear = screen.getByRole<HTMLButtonElement>("button", { name: "Clear search" });
    expect(clear.disabled).toBe(true);
    fireEvent.click(clear);
    expect(onChange).not.toHaveBeenCalled();
  });
});
