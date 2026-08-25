/* jsdom lacks two platform APIs mac-chrome's substrate libraries require:
   react-resizable-panels observes group geometry via ResizeObserver, and
   react-aria builds selectors with CSS.escape. Both shims are inert
   stand-ins — layout is zero-sized in jsdom anyway. Harmless in stub mode. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
}

if (typeof globalThis.CSS === "undefined") {
  const escape = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  Object.assign(globalThis, { CSS: { escape } });
}
