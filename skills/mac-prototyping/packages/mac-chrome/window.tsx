"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useManagedWindowRegistration } from "./app.tsx";
import "./styles/tokens.css";
import "./styles/base.css";

/** Window placement/size override. Numbers are px; strings pass through as CSS. */
export type WindowFrame = {
  readonly top?: number | string;
  readonly left?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
};

export type WindowSize = { readonly width: number; readonly height: number };

const genericDefaultSize: WindowSize = { width: 720, height: 480 };
const genericMinimumSize: WindowSize = { width: 420, height: 280 };

/* Zoom target: nearly the whole desktop canvas, clear of the menu bar (24px)
   and the Dock reserve (~81px). */
const zoomedPlacement: CSSProperties = {
  top: "28px",
  left: "24px",
  width: "calc(100% - 48px)",
  height: "calc(100% - 116px)",
};

const minimizeDurationMs = 220;

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

/* Centered-ish default placement: horizontally centered, biased slightly above
   vertical center (menu bar + Dock make the visual center sit high). */
function framePlacement(frame: WindowFrame | undefined, defaultSize: WindowSize): CSSProperties {
  const width = cssLength(frame?.width ?? defaultSize.width);
  const height = cssLength(frame?.height ?? defaultSize.height);
  return {
    width,
    height,
    top: frame?.top !== undefined ? cssLength(frame.top) : `max(28px, calc(50% - (${height}) / 2 - 28px))`,
    left: frame?.left !== undefined ? cssLength(frame.left) : `calc(50% - (${width}) / 2)`,
  };
}

type WindowControls = {
  readonly close: () => void;
  readonly minimize: () => void;
  readonly zoom: () => void;
};

/* Set by WindowChrome so TrafficLights rendered anywhere inside the window
   picks up the working close/minimize/zoom defaults without prop plumbing. */
const WindowControlsContext = createContext<WindowControls | null>(null);

function TrafficGlyph({ kind }: { readonly kind: "close" | "minimize" | "zoom" }) {
  if (kind === "close") {
    return (
      <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <path d="M1.9 1.9 6.1 6.1M6.1 1.9 1.9 6.1" />
      </svg>
    );
  }
  if (kind === "minimize") {
    return (
      <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
        <path d="M1.5 4h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" focusable="false">
      <path className="mc-traffic-fill" d="M4.4 1.5H1.5v2.9Z" />
      <path className="mc-traffic-fill" d="M3.6 6.5h2.9V3.6Z" />
    </svg>
  );
}

/* macOS behavior: the glyphs stay hidden until the pointer is over the
   cluster, then all three reveal together (styles/base.css). Handlers resolve
   from props first, then the enclosing WindowChrome's internal defaults. */
export function TrafficLights({ disabled = false, onClose, onMinimize, onZoom }: {
  /** All three render as inert solid-gray dots (no glyphs, no actions). */
  readonly disabled?: boolean;
  readonly onClose?: () => void;
  readonly onMinimize?: () => void;
  readonly onZoom?: () => void;
} = {}) {
  const controls = useContext(WindowControlsContext);

  function control(kind: "close" | "minimize" | "zoom", label: string, action: (() => void) | undefined) {
    if (disabled || action === undefined) {
      return <span className={`traffic-${kind}`}>{disabled ? null : <TrafficGlyph kind={kind} />}</span>;
    }
    return (
      <button type="button" className={`traffic-${kind}`} aria-label={label} onClick={action}>
        <TrafficGlyph kind={kind} />
      </button>
    );
  }

  return (
    <div className={`traffic-lights${disabled ? " mc-disabled" : ""}`} aria-label="Window controls">
      {control("close", "Close window", onClose ?? controls?.close)}
      {control("minimize", "Minimize window", onMinimize ?? controls?.minimize)}
      {control("zoom", "Zoom window", onZoom ?? controls?.zoom)}
    </div>
  );
}

type WindowOffset = { readonly x: number; readonly y: number };

export function useWindowDrag<T extends HTMLElement>(
  enabled: boolean,
  handleSelector: string = "[data-window-drag-handle]",
) {
  const windowRef = useRef<T>(null);
  const [offset, setOffset] = useState<WindowOffset>({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly origin: WindowOffset;
    readonly rect: DOMRect;
  } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<WindowOffset | null>(null);

  function commitOffset(nextOffset: WindowOffset) {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }

  function scheduleOffset(nextOffset: WindowOffset) {
    pendingOffsetRef.current = nextOffset;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pendingOffset = pendingOffsetRef.current;
      pendingOffsetRef.current = null;
      if (pendingOffset) commitOffset(pendingOffset);
    });
  }

  /* Keep at least 120px of the window on-screen horizontally, the title bar
     below the menu bar (24px) and above the dock reserve (52px). */
  function clampedOffset(origin: WindowOffset, rect: DOMRect, x: number, y: number): WindowOffset {
    const minimumX = origin.x + 120 - rect.right;
    const maximumX = origin.x + window.innerWidth - 120 - rect.left;
    const minimumY = origin.y + 24 - rect.top;
    const maximumY = origin.y + window.innerHeight - 52 - rect.top;
    return {
      x: Math.min(Math.max(x, minimumX), maximumX),
      y: Math.min(Math.max(y, minimumY), maximumY),
    };
  }

  useEffect(() => {
    if (!enabled) return;
    const handleResize = () => {
      const element = windowRef.current;
      if (!element) return;
      const current = offsetRef.current;
      commitOffset(clampedOffset(current, element.getBoundingClientRect(), current.x, current.y));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [enabled]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  function onPointerDown(event: ReactPointerEvent<T>) {
    if (!enabled || event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(handleSelector)) return;
    if (target.closest("button, input, textarea, select, a, [role='button'], .traffic-lights, [data-no-window-drag]")) return;
    const element = windowRef.current;
    if (!element) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: offsetRef.current,
      rect: element.getBoundingClientRect(),
    };
    // Pointer capture is absent in non-visual test DOMs (jsdom); dragging
    // still works there, it just loses outside-the-element move tracking.
    if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<T>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleOffset(clampedOffset(
      drag.origin,
      drag.rect,
      drag.origin.x + event.clientX - drag.startX,
      drag.origin.y + event.clientY - drag.startY,
    ));
  }

  function finishDrag(event: ReactPointerEvent<T>) {
    const element = windowRef.current;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (
      element &&
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(event.pointerId)
    ) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  const style: CSSProperties = { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` };
  return { windowRef, style, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };
}

type WindowGeometry = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type WindowResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

type WindowBounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly minWidth: number;
  readonly minHeight: number;
};

const resizeEdges: readonly WindowResizeEdge[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const benignResizeObserverLoopMessages = new Set([
  "ResizeObserver loop completed with undelivered notifications.",
  "ResizeObserver loop limit exceeded",
]);

let resizeObserverLoopGuardCount = 0;

function handleBenignResizeObserverLoop(event: ErrorEvent) {
  const message = event.message || (event.error instanceof Error ? event.error.message : "");
  if (!benignResizeObserverLoopMessages.has(message)) return;
  /* react-resizable-panels synchronously reconciles its nested group during
     ResizeObserver delivery. Chromium reports any remaining notification as
     an error event, then retries it in the next delivery cycle; the outer and
     panel geometry are already correct. Suppress only those two platform
     messages so a development overlay does not misclassify the retry as an
     application failure. */
  event.preventDefault();
  event.stopImmediatePropagation();
}

function retainResizeObserverLoopGuard() {
  if (resizeObserverLoopGuardCount === 0) {
    window.addEventListener("error", handleBenignResizeObserverLoop, true);
  }
  resizeObserverLoopGuardCount += 1;
  let retained = true;
  return () => {
    if (!retained) return;
    retained = false;
    resizeObserverLoopGuardCount = Math.max(0, resizeObserverLoopGuardCount - 1);
    if (resizeObserverLoopGuardCount === 0) {
      window.removeEventListener("error", handleBenignResizeObserverLoop, true);
    }
  };
}

/* Keep ordinary windows clear of the menu bar and Dock. Horizontal margins
   keep the rounded chrome and resize hit targets reachable at either edge. */
const windowSafeInsets = { top: 28, right: 24, bottom: 88, left: 24 } as const;

function geometryEquals(left: WindowGeometry | null, right: WindowGeometry): boolean {
  return left !== null &&
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height;
}

function safeBounds(width: number, height: number, minSize: WindowSize): WindowBounds | null {
  if (width <= 0 || height <= 0) return null;

  /* On a very small embedded canvas, contract the reserves proportionally.
     That makes the declared minimum advisory rather than allowing chrome to
     become unreachable when less space is physically available. */
  const horizontalScale = Math.min(1, width / (windowSafeInsets.left + windowSafeInsets.right));
  const verticalScale = Math.min(1, height / (windowSafeInsets.top + windowSafeInsets.bottom));
  const left = windowSafeInsets.left * horizontalScale;
  const right = width - windowSafeInsets.right * horizontalScale;
  const top = windowSafeInsets.top * verticalScale;
  const bottom = height - windowSafeInsets.bottom * verticalScale;
  const availableWidth = Math.max(0, right - left);
  const availableHeight = Math.max(0, bottom - top);

  return {
    left,
    top,
    right,
    bottom,
    minWidth: Math.min(Math.max(0, minSize.width), availableWidth),
    minHeight: Math.min(Math.max(0, minSize.height), availableHeight),
  };
}

function clampedGeometry(geometry: WindowGeometry, bounds: WindowBounds): WindowGeometry {
  const maximumWidth = Math.max(0, bounds.right - bounds.left);
  const maximumHeight = Math.max(0, bounds.bottom - bounds.top);
  const width = Math.min(Math.max(geometry.width, bounds.minWidth), maximumWidth);
  const height = Math.min(Math.max(geometry.height, bounds.minHeight), maximumHeight);
  return {
    left: Math.min(Math.max(geometry.left, bounds.left), bounds.right - width),
    top: Math.min(Math.max(geometry.top, bounds.top), bounds.bottom - height),
    width,
    height,
  };
}

function resizedGeometry(
  origin: WindowGeometry,
  edge: WindowResizeEdge,
  deltaX: number,
  deltaY: number,
  bounds: WindowBounds,
): WindowGeometry {
  let left = origin.left;
  let right = origin.left + origin.width;
  let top = origin.top;
  let bottom = origin.top + origin.height;

  if (edge.includes("w")) {
    left = Math.min(Math.max(origin.left + deltaX, bounds.left), right - bounds.minWidth);
  } else if (edge.includes("e")) {
    right = Math.min(Math.max(right + deltaX, left + bounds.minWidth), bounds.right);
  }

  if (edge.includes("n")) {
    top = Math.min(Math.max(origin.top + deltaY, bounds.top), bottom - bounds.minHeight);
  } else if (edge.includes("s")) {
    bottom = Math.min(Math.max(bottom + deltaY, top + bounds.minHeight), bounds.bottom);
  }

  return { left, top, width: right - left, height: bottom - top };
}

function numericInlineLength(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function useWindowGeometry({
  draggable,
  dragHandleSelector = "[data-window-drag-handle]",
  enabled,
  minSize,
  resizable,
  visible,
}: {
  readonly draggable: boolean;
  readonly dragHandleSelector?: string;
  readonly enabled: boolean;
  readonly minSize: WindowSize;
  readonly resizable: boolean;
  readonly visible: boolean;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState<WindowGeometry | null>(null);
  const geometryRef = useRef<WindowGeometry | null>(null);
  const interactionRef = useRef<{
    readonly kind: "drag" | "resize";
    readonly edge?: WindowResizeEdge;
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly origin: WindowGeometry;
  } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containmentTaskRef = useRef<number | null>(null);
  const pendingGeometryRef = useRef<WindowGeometry | null>(null);

  function commitGeometry(nextGeometry: WindowGeometry) {
    geometryRef.current = nextGeometry;
    setGeometry((current) => geometryEquals(current, nextGeometry) ? current : nextGeometry);
  }

  function scheduleGeometry(nextGeometry: WindowGeometry) {
    pendingGeometryRef.current = nextGeometry;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pendingGeometry = pendingGeometryRef.current;
      pendingGeometryRef.current = null;
      if (pendingGeometry !== null) commitGeometry(pendingGeometry);
    });
  }

  function geometryContext(element: HTMLElement, requireCanvas: boolean) {
    const canvas = element.closest<HTMLElement>(".desktop-canvas");
    if (canvas !== null) {
      const canvasRect = canvas.getBoundingClientRect();
      const bounds = safeBounds(canvasRect.width, canvasRect.height, minSize);
      return bounds === null ? null : { bounds, originLeft: canvasRect.left, originTop: canvasRect.top };
    }
    if (requireCanvas) return null;
    const bounds = safeBounds(window.innerWidth, window.innerHeight, minSize);
    return bounds === null ? null : { bounds, originLeft: 0, originTop: 0 };
  }

  function captureGeometry(element: HTMLElement, requireCanvas: boolean): WindowGeometry | null {
    const context = geometryContext(element, requireCanvas);
    if (context === null) return null;
    const rect = element.getBoundingClientRect();
    const captured = {
      left: rect.left - context.originLeft,
      top: rect.top - context.originTop,
      width: rect.width || numericInlineLength(element.style.width, minSize.width),
      height: rect.height || numericInlineLength(element.style.height, minSize.height),
    };
    return clampedGeometry(captured, context.bounds);
  }

  function ensureGeometry(): WindowGeometry | null {
    if (geometryRef.current !== null) return geometryRef.current;
    const element = windowRef.current;
    if (element === null) return null;
    const captured = captureGeometry(element, false);
    if (captured !== null) commitGeometry(captured);
    return captured;
  }

  useLayoutEffect(() => {
    if (!visible) return;
    const element = windowRef.current;
    if (element === null) return;
    const canvas = element.closest<HTMLElement>(".desktop-canvas");
    if (canvas === null) return;

    function containedGeometry() {
      const currentElement = windowRef.current;
      if (currentElement === null) return null;
      const context = geometryContext(currentElement, true);
      if (context === null) return null;
      const current = geometryRef.current;
      return current === null
        ? captureGeometry(currentElement, true)
        : clampedGeometry(current, context.bounds);
    }

    const initialGeometry = containedGeometry();
    if (initialGeometry !== null) commitGeometry(initialGeometry);
    const observer = new ResizeObserver(() => {
      if (containmentTaskRef.current !== null) return;
      /* ResizeObserver delivery and animation frames can still share the
         browser's layout-update cycle. Re-read and commit in a deduplicated
         following task so rapid pane shrink/reset notifications settle first
         and cannot feed layout back into the observer loop. */
      containmentTaskRef.current = window.setTimeout(() => {
        containmentTaskRef.current = null;
        const next = containedGeometry();
        if (next !== null) commitGeometry(next);
      }, 0);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (containmentTaskRef.current !== null) {
        window.clearTimeout(containmentTaskRef.current);
        containmentTaskRef.current = null;
      }
    };
  }, [minSize.height, minSize.width, visible]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
  }, []);

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !draggable || event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(dragHandleSelector)) return;
    if (target.closest("button, input, textarea, select, a, [role='button'], .traffic-lights, [data-no-window-drag]")) return;
    const element = windowRef.current;
    const origin = ensureGeometry();
    if (element === null || origin === null) return;
    interactionRef.current = {
      kind: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    };
    if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
  }

  function beginResize(edge: WindowResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !resizable || event.button !== 0 || !event.isPrimary) return;
    const element = windowRef.current;
    const origin = ensureGeometry();
    if (element === null || origin === null) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      kind: "resize",
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    };
    if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    const element = windowRef.current;
    if (interaction === null || element === null || interaction.pointerId !== event.pointerId) return;
    const context = geometryContext(element, false);
    if (context === null) return;
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    const next = interaction.kind === "drag"
      ? clampedGeometry({
          ...interaction.origin,
          left: interaction.origin.left + deltaX,
          top: interaction.origin.top + deltaY,
        }, context.bounds)
      : resizedGeometry(interaction.origin, interaction.edge ?? "se", deltaX, deltaY, context.bounds);
    scheduleGeometry(next);
  }

  function finishInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    const element = windowRef.current;
    if (interaction === null || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    if (
      element !== null &&
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(event.pointerId)
    ) {
      element.releasePointerCapture(event.pointerId);
    }
  }

  return {
    beginDrag,
    beginResize,
    geometry,
    onPointerCancel: finishInteraction,
    onPointerMove,
    onPointerUp: finishInteraction,
    windowRef,
  };
}

function useNestedPanelResizeObserverLoopGuard({
  enabled,
  windowRef,
}: {
  readonly enabled: boolean;
  readonly windowRef: RefObject<HTMLElement | null>;
}) {
  useLayoutEffect(() => {
    const element = windowRef.current;
    if (!enabled || element === null) return;
    const mountedElement = element;

    let releaseGuard: (() => void) | null = null;
    function syncGuard() {
      const hasNestedResizableGroup = mountedElement.querySelector("[data-group] [data-panel]") !== null;
      if (hasNestedResizableGroup && releaseGuard === null) {
        releaseGuard = retainResizeObserverLoopGuard();
      } else if (!hasNestedResizableGroup && releaseGuard !== null) {
        releaseGuard();
        releaseGuard = null;
      }
    }

    syncGuard();
    const observer = new MutationObserver(syncGuard);
    observer.observe(mountedElement, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      releaseGuard?.();
    };
  }, [enabled, windowRef]);
}

export function WindowChrome({
  children,
  className = "",
  defaultOpen = true,
  defaultSize = genericDefaultSize,
  draggable = true,
  dragHandleSelector,
  frame,
  label,
  minSize = genericMinimumSize,
  resizable = true,
  style,
  windowId,
  onClose,
  onMinimize,
  onZoom,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Initial managed-window state. Ignored outside MacWindowManager + MacApp. */
  readonly defaultOpen?: boolean;
  /** Fallback geometry when `frame` omits width/height (surfaces set their own). */
  readonly defaultSize?: WindowSize;
  readonly draggable?: boolean;
  readonly dragHandleSelector?: string;
  /** Placement/size override; unset sides default to the centered placement. */
  readonly frame?: WindowFrame;
  readonly label: string;
  /** Minimum interactive size in px, constrained by the available canvas. */
  readonly minSize?: WindowSize;
  /** Whether the shared eight-edge resize affordance is available. */
  readonly resizable?: boolean;
  /** Merged over the frame placement and captured by interactive geometry. */
  readonly style?: CSSProperties;
  /** Stable identity inside MacApp. Defaults to `${appId}:main`. */
  readonly windowId?: string;
  /** Called on close; the window hides itself either way. */
  readonly onClose?: () => void;
  /** Called on minimize; the window animates out and hides either way. */
  readonly onMinimize?: () => void;
  /** Called on zoom; the window toggles frame size <-> canvas size either way. */
  readonly onZoom?: () => void;
  readonly onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [minimizing, setMinimizing] = useState(false);
  const [localZoomed, setLocalZoomed] = useState(false);
  const { app, appRunning, manager, managedWindow, resolvedWindowId } = useManagedWindowRegistration({
    defaultOpen,
    label,
    windowId,
  });
  const managed = manager !== null && resolvedWindowId !== null;
  const managedOpen = appRunning && (managedWindow?.state === "open" || (managedWindow === null && defaultOpen));
  const visible = managed ? managedOpen : !hidden;
  const zoomed = managedWindow?.zoomed ?? localZoomed;
  const activateManagedWindow = manager?.activateWindow;
  const closeManagedWindow = manager?.closeWindow;
  const consumeKeyboardWindowFocusIntent = manager?.consumeKeyboardWindowFocusIntent;
  const minimizeManagedWindow = manager?.minimizeWindow;
  const toggleManagedZoom = manager?.toggleZoom;
  const windowGeometry = useWindowGeometry({
    draggable,
    dragHandleSelector,
    enabled: !minimizing && !zoomed,
    minSize,
    resizable,
    visible,
  });
  useNestedPanelResizeObserverLoopGuard({
    enabled: visible && resizable,
    windowRef: windowGeometry.windowRef,
  });

  const controls = useMemo<WindowControls>(() => ({
    close: () => {
      onClose?.();
      if (managed && resolvedWindowId !== null) closeManagedWindow?.(resolvedWindowId);
      else setHidden(true);
    },
    minimize: () => {
      onMinimize?.();
      setMinimizing(true);
    },
    zoom: () => {
      onZoom?.();
      if (managed && resolvedWindowId !== null) toggleManagedZoom?.(resolvedWindowId);
      else setLocalZoomed((current) => !current);
    },
  }), [closeManagedWindow, managed, onClose, onMinimize, onZoom, resolvedWindowId, toggleManagedZoom]);

  useEffect(() => {
    if (!minimizing) return;
    const timer = window.setTimeout(() => {
      if (managed && resolvedWindowId !== null) minimizeManagedWindow?.(resolvedWindowId);
      else setHidden(true);
      setMinimizing(false);
    }, minimizeDurationMs);
    return () => window.clearTimeout(timer);
  }, [managed, minimizeManagedWindow, minimizing, resolvedWindowId]);

  if (!visible) return null;

  const composedStyle: CSSProperties = {
    ...(zoomed ? zoomedPlacement : framePlacement(frame, defaultSize)),
    ...style,
    ...(zoomed || windowGeometry.geometry === null ? undefined : {
      left: windowGeometry.geometry.left,
      top: windowGeometry.geometry.top,
      width: windowGeometry.geometry.width,
      height: windowGeometry.geometry.height,
    }),
    ...(managedWindow === null ? undefined : { zIndex: managedWindow.zIndex }),
  };
  if (minimizing) {
    const existingTransform = composedStyle.transform;
    composedStyle.transform = `${existingTransform === undefined || existingTransform === "none" ? "" : `${existingTransform} `}translateY(42px) scale(0.5)`;
    composedStyle.opacity = 0;
  }

  return (
    <WindowControlsContext.Provider value={controls}>
      <section
        ref={windowGeometry.windowRef}
        style={composedStyle}
        className={`mac-window ${className}${zoomed ? " mc-zoomed" : ""}${minimizing ? " mc-minimizing" : ""}`}
        aria-label={label}
        data-app-id={app?.id}
        data-key-window={managedWindow === null ? undefined : managedWindow.isKeyWindow ? "true" : "false"}
        data-window-id={resolvedWindowId ?? undefined}
        data-window-resizable={resizable ? "true" : "false"}
        data-window-state={managedWindow?.state}
        onPointerDownCapture={() => {
          // Interactive descendants such as React Aria collections may stop
          // pointer events during their own press handling. Window activation
          // is a frame-level behavior, so observe it before descendants can
          // consume the event.
          if (resolvedWindowId !== null) activateManagedWindow?.(resolvedWindowId);
        }}
        onFocusCapture={() => {
          if (resolvedWindowId !== null && consumeKeyboardWindowFocusIntent?.()) {
            activateManagedWindow?.(resolvedWindowId);
          }
        }}
        onPointerDown={(event) => {
          windowGeometry.beginDrag(event);
        }}
        onPointerMove={windowGeometry.onPointerMove}
        onPointerUp={windowGeometry.onPointerUp}
        onPointerCancel={windowGeometry.onPointerCancel}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {children}
        {resizable && !zoomed && !minimizing ? resizeEdges.map((edge) => (
          <span
            aria-hidden="true"
            className={`mc-window-resize-handle mc-window-resize-${edge}`}
            data-window-resize-handle={edge}
            key={edge}
            onPointerDown={(event) => windowGeometry.beginResize(edge, event)}
          />
        )) : null}
      </section>
    </WindowControlsContext.Provider>
  );
}
