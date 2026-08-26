// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPanelSafeResizeObserver } from "../resize-observer-compat.ts";

afterEach(() => {
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

describe("panel ResizeObserver compatibility", () => {
  it("defers and coalesces resizable-panel group delivery into the next task", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const group = document.createElement("div");
    group.dataset.group = "";

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

  it("delivers ordinary targets immediately when a batch also contains a panel group", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, nativeCallback } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const canvas = document.createElement("main");
    const group = document.createElement("div");
    group.dataset.group = "";

    nativeCallback([entry(canvas), entry(group)]);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenLastCalledWith([entry(canvas)], observer);

    vi.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith([entry(group)], observer);
  });

  it("cancels pending delivery when a target is removed or the observer disconnects", () => {
    vi.useFakeTimers();
    const { CompatibleResizeObserver, disconnect, nativeCallback, unobserve } = harness();
    const callback = vi.fn();
    const observer = new CompatibleResizeObserver(callback);
    const first = document.createElement("div");
    const second = document.createElement("div");
    first.dataset.group = "";
    second.dataset.group = "";

    nativeCallback([entry(first), entry(second)]);
    observer.unobserve(first);
    expect(unobserve).toHaveBeenCalledWith(first);
    observer.disconnect();
    vi.runOnlyPendingTimers();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
