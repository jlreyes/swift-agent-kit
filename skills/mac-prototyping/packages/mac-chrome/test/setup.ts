/* jsdom lacks two platform APIs the substrate libraries require:
   react-resizable-panels observes group geometry via ResizeObserver, and
   react-aria's selection code builds selectors with CSS.escape. Both shims are
   inert stand-ins — layout is zero-sized in jsdom anyway, and the escape only
   needs to make querySelector-safe strings for the ids used in tests. */

/* React Aria schedules selection and focus updates through React. Tell React
   that Vitest's jsdom environment supports act() so those library-owned
   updates are tracked by Testing Library instead of reported as false-positive
   environment warnings. */
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
