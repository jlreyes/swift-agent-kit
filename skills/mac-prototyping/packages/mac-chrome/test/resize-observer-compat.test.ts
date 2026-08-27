// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { Group, Panel } from "react-resizable-panels";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPanelSafeResizeObserver } from "../resize-observer-compat.ts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function entry(target: Element): ResizeObserverEntry {
  return { target } as ResizeObserverEntry;
}

function harness() {
  let nativeCallback: ResizeObserverCallback = () => undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const unobserve = vi.fn();

  class NativeResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      nativeCallback = callback;
    }
    observe = observe;
    unobserve = unobserve;
    disconnect = disconnect;
  }

  const CompatibleResizeObserver = createPanelSafeResizeObserver(NativeResizeObserver);
  return { CompatibleResizeObserver, disconnect, nativeCallback: (entries: ResizeObserverEntry[]) => nativeCallback(entries, {} as ResizeObserver), observe, unobserve };
}

function panelGroup() {
  const group = document.createElement("div");
  group.dataset.group = "true";
  group.dataset.testid = "test-group";
  group.id = "test-group";
  const panel = document.createElement("div");
  panel.dataset.panel = "true";
  panel.dataset.testid = "test-panel";
  panel.id = "test-panel";
  group.append(panel);
  return group;
}

describe("panel ResizeObserver compatibility", () => {
  it("defers and coalesces resizable-panel group delivery into the next task", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const { container } = render(createElement(
      Group,
      { id: "actual-group", orientation: "horizontal" },
      createElement(Panel, { id: "actual-panel" }, "Panel"),
    ));
    const group = container.querySelector<HTMLElement>("[data-group]");
    expect(group).not.toBeNull();
    if (group === null) return;

    nativeCallback([entry(group)]);
    nativeCallback([entry(group)]);
    expect(callback).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]?.[0]).toEqual([entry(group)]);
    expect(callback.mock.calls[0]?.[1]).toBe(observer);
  });

  it("keeps ordinary observers synchronous", () => {
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const canvas = document.createElement("main");

    nativeCallback([entry(canvas)]);
    expect(callback).toHaveBeenCalledWith([entry(canvas)], observer);
  });

  it("keeps unrelated data-group observers synchronous", () => {
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const applicationGroup = document.createElement("section");
    applicationGroup.dataset.group = "true";
    applicationGroup.dataset.testid = "application-group";
    applicationGroup.id = "application-group";
    const applicationPanel = document.createElement("div");
    applicationPanel.dataset.panel = "true";
    applicationGroup.append(applicationPanel);

    nativeCallback([entry(applicationGroup)]);
    nativeCallback([entry(applicationGroup)]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith([entry(applicationGroup)], observer);
  });

  it("delivers ordinary targets immediately when a batch also contains a panel group", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const canvas = document.createElement("main");
    const group = panelGroup();

    nativeCallback([entry(canvas), entry(group)]);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenLastCalledWith([entry(canvas)], observer);

    vi.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith([entry(group)], observer);
  });

  it("lets an immediate mixed-batch callback disconnect before deferred delivery", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, disconnect, nativeCallback } = harness();
    const canvas = document.createElement("main");
    const group = panelGroup();
    let observer: ResizeObserver | null = null;
    const callback = vi.fn((entries: ResizeObserverEntry[]) => {
      if (entries[0]?.target === canvas) observer?.disconnect();
    });
    observer = new CompatibleResizeObserver(callback);

    nativeCallback([entry(canvas), entry(group)]);
    expect(callback).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    vi.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledOnce();
  });

  it("lets an immediate mixed-batch callback unobserve the deferred panel", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, nativeCallback, unobserve } = harness();
    const canvas = document.createElement("main");
    const group = panelGroup();
    let observer: ResizeObserver | null = null;
    const callback = vi.fn((entries: ResizeObserverEntry[]) => {
      if (entries[0]?.target === canvas) observer?.unobserve(group);
    });
    observer = new CompatibleResizeObserver(callback);

    nativeCallback([entry(canvas), entry(group)]);
    expect(callback).toHaveBeenCalledOnce();
    expect(unobserve).toHaveBeenCalledWith(group);
    vi.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledOnce();
  });

  it("cancels pending delivery when a target is removed or the observer disconnects", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, disconnect, nativeCallback, unobserve } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const first = panelGroup();
    first.id = "first-group";
    first.dataset.testid = first.id;
    const second = panelGroup();
    second.id = "second-group";
    second.dataset.testid = second.id;

    nativeCallback([entry(first), entry(second)]);
    observer.unobserve(first);
    expect(unobserve).toHaveBeenCalledWith(first);
    observer.disconnect();
    vi.runOnlyPendingTimers();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
