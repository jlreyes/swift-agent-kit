import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Group, Panel, Separator } from "react-resizable-panels";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function groupRect(element: HTMLElement): DOMRect {
  return new DOMRect(0, element.id === "keep" ? 300 : 0, 1000, 200);
}

function measuredRect(element: HTMLElement): DOMRect {
  if (!element.isConnected) return new DOMRect();
  if (element.dataset.group) return groupRect(element);
  const group = element.parentElement;
  if (!group?.dataset.group) return new DOMRect();
  const rect = groupRect(group);
  if (element.dataset.separator) return new DOMRect(499.5, rect.y, 1, rect.height);
  if (element.dataset.panel) {
    return new DOMRect(element.id.endsWith("-a") ? 0 : 500.5, rect.y, 499.5, rect.height);
  }
  return new DOMRect();
}

function Split({ id }: { readonly id: string }) {
  return (
    <Group id={id} orientation="horizontal">
      <Panel id={`${id}-a`} defaultSize="50%">A</Panel>
      <Separator aria-label={`Resize ${id}`} />
      <Panel id={`${id}-b`} defaultSize="50%">B</Panel>
    </Group>
  );
}

function Fixture({ showFirst }: { readonly showFirst: boolean }) {
  return <>{showFirst && <Split id="remove" />}<Split id="keep" /></>;
}

it.each(["pointermove", "pointerleave"])("retires a removed group's active hit region before %s and pointerup", (eventType) => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    return measuredRect(this);
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function offsetWidth(this: HTMLElement) {
    return Math.round(measuredRect(this).width);
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function offsetHeight(this: HTMLElement) {
    return Math.round(measuredRect(this).height);
  });
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.message);
    event.preventDefault();
  };
  window.addEventListener("error", onError);
  try {
    const { getByRole, rerender } = render(<Fixture showFirst />);
    fireEvent(getByRole("separator", { name: "Resize remove" }), new MouseEvent("pointerdown", {
      bubbles: true, button: 0, buttons: 1, clientX: 500, clientY: 100,
    }));
    rerender(<Fixture showFirst={false} />);
    fireEvent(document, new MouseEvent(eventType, { bubbles: true, buttons: 1, clientX: 510, clientY: 100 }));
    fireEvent(document, new MouseEvent("pointerup", { bubbles: true, button: 0, clientX: 510, clientY: 100 }));
    expect(errors).toEqual([]);
    expect(getByRole("separator", { name: "Resize keep" })).toBeTruthy();
  } finally {
    window.removeEventListener("error", onError);
  }
});
