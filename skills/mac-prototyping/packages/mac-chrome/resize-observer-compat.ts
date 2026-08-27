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

function isResizablePanel(element: Element): boolean {
  return element instanceof HTMLElement &&
    element.dataset.panel === "true" &&
    element.id !== "" &&
    element.dataset.testid === element.id;
}

function isPanelGroupEntry(entry: ResizeObserverEntry): boolean {
  const target = entry.target;
  if (!(target instanceof HTMLElement) ||
    target.dataset.group !== "true" ||
    target.id === "" ||
    target.dataset.testid !== target.id) {
    return false;
  }
  /* These attributes and the direct panel child are emitted together by
     react-resizable-panels Group/Panel. A generic application `data-group`
     marker must never change ResizeObserver scheduling process-wide. */
  return [...target.children].some(isResizablePanel);
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
        /* Queue panel entries before invoking immediate consumers. Their
           callback may synchronously unobserve a panel or disconnect the
           observer; those methods must see and cancel the queued work rather
           than allowing this delivery frame to enqueue it afterward. */
        if (deferredEntries.length > 0) {
          for (const entry of deferredEntries) this.#pendingEntries.set(entry.target, entry);
          if (this.#deliveryTask === null) {
            this.#deliveryTask = window.setTimeout(() => {
              this.#deliveryTask = null;
              const pending = [...this.#pendingEntries.values()];
              this.#pendingEntries.clear();
              if (pending.length > 0) this.#callback(pending, this);
            }, 0);
          }
        }
        if (immediateEntries.length > 0) callback(immediateEntries, this);
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
