"use client";

/* react-resizable-panels reconciles group layout synchronously from its
   ResizeObserver callback. When an outer mac window is resized in the same
   frame, Chromium can exhaust the current delivery cycle and report
   "undelivered notifications" even though it retries successfully. Deferring
   only panel-group deliveries to the following task prevents the feedback
   loop at its source; all other ResizeObserver consumers stay synchronous. */

type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;

const compatibilityMarker = Symbol.for("mac-chrome.panel-safe-resize-observer");

type CompatibleWindow = Window & {
  [compatibilityMarker]?: boolean;
};

function isPanelGroupEntry(entry: ResizeObserverEntry): boolean {
  return entry.target instanceof Element && entry.target.matches("[data-group]");
}

export function createPanelSafeResizeObserver(NativeResizeObserver: ResizeObserverConstructor): ResizeObserverConstructor {
  return class PanelSafeResizeObserver implements ResizeObserver {
    readonly #callback: ResizeObserverCallback;
    readonly #observer: ResizeObserver;
    readonly #pendingEntries = new Map<Element, ResizeObserverEntry>();
    #deliveryTask: number | null = null;

    constructor(callback: ResizeObserverCallback) {
      this.#callback = callback;
      this.#observer = new NativeResizeObserver((entries) => {
        const immediateEntries = entries.filter((entry) => !isPanelGroupEntry(entry));
        const deferredEntries = entries.filter(isPanelGroupEntry);
        if (immediateEntries.length > 0) callback(immediateEntries, this);
        if (deferredEntries.length === 0) return;

        for (const entry of deferredEntries) this.#pendingEntries.set(entry.target, entry);
        if (this.#deliveryTask !== null) return;
        this.#deliveryTask = window.setTimeout(() => {
          this.#deliveryTask = null;
          const pending = [...this.#pendingEntries.values()];
          this.#pendingEntries.clear();
          if (pending.length > 0) this.#callback(pending, this);
        }, 0);
      });
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      this.#observer.observe(target, options);
    }

    unobserve(target: Element): void {
      this.#pendingEntries.delete(target);
      this.#observer.unobserve(target);
    }

    disconnect(): void {
      this.#observer.disconnect();
      this.#pendingEntries.clear();
      if (this.#deliveryTask !== null) {
        window.clearTimeout(this.#deliveryTask);
        this.#deliveryTask = null;
      }
    }
  };
}

export function installPanelResizeObserverCompatibility(): void {
  if (typeof window === "undefined" || typeof window.ResizeObserver === "undefined") return;
  const compatibleWindow = window as CompatibleWindow;
  if (compatibleWindow[compatibilityMarker]) return;

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: createPanelSafeResizeObserver(window.ResizeObserver),
    writable: true,
  });
  compatibleWindow[compatibilityMarker] = true;
}

installPanelResizeObserverCompatibility();
