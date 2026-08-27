"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useManagedWindowRegistration } from "./app.tsx";
import { macWindowViewTransitionName } from "./window-transition.ts";
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
  /* Match the horizontal containment contract before JavaScript captures the
     frame. When CSS caps an oversized window, its authored center falls below
     this responsive inset and max() selects the inset; otherwise the authored
     width remains genuinely centered. The 25% fallback mirrors proportional
     inset contraction on tiny canvases. */
  return {
    width,
    height,
    top: frame?.top !== undefined ? cssLength(frame.top) : `max(28px, calc(50% - (${height}) / 2 - 28px))`,
    left: frame?.left !== undefined
      ? cssLength(frame.left)
      : `max(min(24px, 25%), calc(50% - (${width}) / 2))`,
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

type ContainmentRect = {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
};

function elementContainmentRect(element: HTMLElement): ContainmentRect {
  const canvas = element.closest<HTMLElement>(".desktop-canvas");
  if (canvas !== null) return canvas.getBoundingClientRect();
  return {
    bottom: window.innerHeight,
    height: window.innerHeight,
    left: 0,
    right: window.innerWidth,
    top: 0,
    width: window.innerWidth,
  };
}

function proportionallyContractedInsets(
  length: number,
  leading: number,
  trailing: number,
): readonly [number, number] {
  const total = leading + trailing;
  if (length <= 0 || total <= 0) return [0, 0];
  /* Leave at least half of a tiny canvas usable rather than letting the
     reserves consume the entire axis. At ordinary sizes the declared insets
     remain unchanged. */
  const scale = Math.min(1, length / (total * 2));
  return [leading * scale, trailing * scale];
}

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
    readonly lastX: number;
    readonly lastY: number;
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

  /* Keep at least 120px of the window reachable horizontally, the title bar
     below the menu bar (24px), and above the Dock reserve (52px). The nearest
     desktop canvas is the coordinate space; viewport bounds are only the
     standalone fallback. */
  function clampedOffset(origin: WindowOffset, rect: DOMRect, x: number, y: number): WindowOffset {
    const element = windowRef.current;
    if (element === null) return origin;
    const bounds = elementContainmentRect(element);
    const horizontalReach = Math.min(120, bounds.width / 2);
    const [topInset, bottomInset] = proportionallyContractedInsets(bounds.height, 24, 52);
    const minimumX = origin.x + bounds.left + horizontalReach - rect.right;
    const maximumX = origin.x + bounds.right - horizontalReach - rect.left;
    const minimumY = origin.y + bounds.top + topInset - rect.top;
    const maximumY = origin.y + bounds.bottom - bottomInset - rect.top;
    return {
      x: Math.min(Math.max(x, minimumX), maximumX),
      y: Math.min(Math.max(y, minimumY), maximumY),
    };
  }

  useEffect(() => {
    if (!enabled) return;
    const element = windowRef.current;
    if (element === null) return;
    const contain = () => {
      const element = windowRef.current;
      if (!element) return;
      const current = offsetRef.current;
      const rect = element.getBoundingClientRect();
      const next = clampedOffset(current, rect, current.x, current.y);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pendingOffsetRef.current = null;
      commitOffset(next);
      const drag = dragRef.current;
      if (drag !== null) {
        dragRef.current = {
          ...drag,
          startX: drag.lastX,
          startY: drag.lastY,
          origin: next,
          rect: new DOMRect(
            rect.left + next.x - current.x,
            rect.top + next.y - current.y,
            rect.width,
            rect.height,
          ),
        };
      }
    };
    const canvas = element.closest<HTMLElement>(".desktop-canvas");
    const observer = canvas === null || typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(contain);
    if (canvas !== null) observer?.observe(canvas);
    window.addEventListener("resize", contain);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", contain);
    };
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
      lastX: event.clientX,
      lastY: event.clientY,
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
    dragRef.current = { ...drag, lastX: event.clientX, lastY: event.clientY };
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

  /* Individual translate composes with a consumer's transform instead of
     replacing it or requiring string concatenation in either spread order. */
  const style: CSSProperties = { translate: `${offset.x}px ${offset.y}px` };
  return { windowRef, style, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };
}

type WindowGeometry = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type WindowGeometryState = {
  readonly inputSignature: string;
  readonly normalization: WindowGeometryNormalization;
  readonly value: WindowGeometry;
};

type WindowGeometryNormalization = {
  readonly heightAdjustment: number;
  readonly marginLeft: number;
  readonly marginTop: number;
  readonly widthAdjustment: number;
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
  const [leftInset, rightInset] = proportionallyContractedInsets(
    width,
    windowSafeInsets.left,
    windowSafeInsets.right,
  );
  const [topInset, bottomInset] = proportionallyContractedInsets(
    height,
    windowSafeInsets.top,
    windowSafeInsets.bottom,
  );
  const left = leftInset;
  const right = width - rightInset;
  const top = topInset;
  const bottom = height - bottomInset;
  const availableWidth = right - left;
  const availableHeight = bottom - top;

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
  /* ResizeObserver containment is deliberately deferred out of its delivery
     cycle. A pointer move can therefore see new bounds first. Normalize the
     fixed edges synchronously so subtraction below cannot produce negative or
     sub-minimum dimensions from an origin that no longer fits the canvas. */
  const containedOrigin = clampedGeometry(origin, bounds);
  let left = containedOrigin.left;
  let right = containedOrigin.left + containedOrigin.width;
  let top = containedOrigin.top;
  let bottom = containedOrigin.top + containedOrigin.height;

  if (edge.includes("w")) {
    left = Math.min(Math.max(containedOrigin.left + deltaX, bounds.left), right - bounds.minWidth);
  } else if (edge.includes("e")) {
    right = Math.min(Math.max(right + deltaX, left + bounds.minWidth), bounds.right);
  }

  if (edge.includes("n")) {
    top = Math.min(Math.max(containedOrigin.top + deltaY, bounds.top), bottom - bounds.minHeight);
  } else if (edge.includes("s")) {
    bottom = Math.min(Math.max(bottom + deltaY, top + bounds.minHeight), bounds.bottom);
  }

  return clampedGeometry({ left, top, width: right - left, height: bottom - top }, bounds);
}

function numericInlineLength(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function untransformedClientRect(element: HTMLElement): DOMRect {
  const properties = ["transform", "translate", "rotate", "scale"] as const;
  const previous = properties.map((property) => ({
    priority: element.style.getPropertyPriority(property),
    property,
    value: element.style.getPropertyValue(property),
  }));

  try {
    for (const { property } of previous) element.style.setProperty(property, "none", "important");
    return element.getBoundingClientRect();
  } finally {
    for (const { priority, property, value } of previous) {
      if (value === "") element.style.removeProperty(property);
      else element.style.setProperty(property, value, priority);
    }
  }
}

type WindowInteraction = {
  readonly kind: "drag" | "resize";
  readonly edge?: WindowResizeEdge;
  readonly geometryOwned: boolean;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly lastX: number;
  readonly lastY: number;
  readonly origin: WindowGeometry;
};

const interactiveFrameStyleProperties = [
  "inset",
  "insetBlock",
  "insetBlockEnd",
  "insetBlockStart",
  "insetInline",
  "insetInlineEnd",
  "insetInlineStart",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "inlineSize",
  "blockSize",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "minInlineSize",
  "maxInlineSize",
  "minBlockSize",
  "maxBlockSize",
  "aspectRatio",
] as const satisfies readonly (keyof CSSProperties)[];

function withoutInteractiveFrameConstraints(style: CSSProperties): CSSProperties {
  const unconstrained = { ...style };
  for (const property of interactiveFrameStyleProperties) delete unconstrained[property];
  return unconstrained;
}

function hasResponsiveFrameGeometry(style: CSSProperties): boolean {
  return interactiveFrameStyleProperties.some((property) => {
    const value = style[property];
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized !== "0" && !/^-?(?:\d+(?:\.\d+)?|\.\d+)px$/.test(normalized);
  });
}

const windowGeometryStyleProperties = [
  "position",
  "inset",
  "insetBlock",
  "insetBlockEnd",
  "insetBlockStart",
  "insetInline",
  "insetInlineEnd",
  "insetInlineStart",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "inlineSize",
  "blockSize",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "minInlineSize",
  "maxInlineSize",
  "minBlockSize",
  "maxBlockSize",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "marginBlock",
  "marginBlockEnd",
  "marginBlockStart",
  "marginInline",
  "marginInlineEnd",
  "marginInlineStart",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "paddingBlock",
  "paddingBlockEnd",
  "paddingBlockStart",
  "paddingInline",
  "paddingInlineEnd",
  "paddingInlineStart",
  "border",
  "borderWidth",
  "borderStyle",
  "borderTop",
  "borderTopWidth",
  "borderTopStyle",
  "borderRight",
  "borderRightWidth",
  "borderRightStyle",
  "borderBottom",
  "borderBottomWidth",
  "borderBottomStyle",
  "borderLeft",
  "borderLeftWidth",
  "borderLeftStyle",
  "borderBlock",
  "borderBlockWidth",
  "borderBlockStyle",
  "borderBlockStart",
  "borderBlockStartWidth",
  "borderBlockStartStyle",
  "borderBlockEnd",
  "borderBlockEndWidth",
  "borderBlockEndStyle",
  "borderInline",
  "borderInlineWidth",
  "borderInlineStyle",
  "borderInlineStart",
  "borderInlineStartWidth",
  "borderInlineStartStyle",
  "borderInlineEnd",
  "borderInlineEndWidth",
  "borderInlineEndStyle",
  "aspectRatio",
  "boxSizing",
] as const satisfies readonly (keyof CSSProperties)[];

function windowGeometryInputSignature(style: CSSProperties): string {
  return windowGeometryStyleProperties.map((property) => {
    const value = style[property];
    return `${property}:${typeof value}:${String(value)}`;
  }).join("|");
}

const identityGeometryNormalization: WindowGeometryNormalization = {
  heightAdjustment: 0,
  marginLeft: 0,
  marginTop: 0,
  widthAdjustment: 0,
};

function computedPixels(value: string): number {
  if (!value.trim().endsWith("px")) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function geometryNormalization(element: HTMLElement): WindowGeometryNormalization {
  const computed = window.getComputedStyle(element);
  const contentBox = computed.boxSizing === "content-box";
  return {
    marginLeft: computedPixels(computed.marginLeft),
    marginTop: computedPixels(computed.marginTop),
    widthAdjustment: contentBox
      ? computedPixels(computed.paddingLeft) + computedPixels(computed.paddingRight) +
        computedPixels(computed.borderLeftWidth) + computedPixels(computed.borderRightWidth)
      : 0,
    heightAdjustment: contentBox
      ? computedPixels(computed.paddingTop) + computedPixels(computed.paddingBottom) +
        computedPixels(computed.borderTopWidth) + computedPixels(computed.borderBottomWidth)
      : 0,
  };
}

function normalizationEquals(left: WindowGeometryNormalization, right: WindowGeometryNormalization): boolean {
  return left.heightAdjustment === right.heightAdjustment &&
    left.marginLeft === right.marginLeft &&
    left.marginTop === right.marginTop &&
    left.widthAdjustment === right.widthAdjustment;
}

function normalizedGeometryStyle(
  geometry: WindowGeometry,
  normalization: WindowGeometryNormalization,
): CSSProperties {
  return {
    left: geometry.left - normalization.marginLeft,
    top: geometry.top - normalization.marginTop,
    width: Math.max(0, geometry.width - normalization.widthAdjustment),
    height: Math.max(0, geometry.height - normalization.heightAdjustment),
  };
}

function useWindowGeometry({
  draggable,
  dragHandleSelector = "[data-window-drag-handle]",
  enabled,
  minSize,
  inputSignature,
  preserveResponsiveFrame,
  resizable,
  visible,
}: {
  readonly draggable: boolean;
  readonly dragHandleSelector?: string;
  readonly enabled: boolean;
  readonly minSize: WindowSize;
  readonly inputSignature: string;
  readonly resizable: boolean;
  readonly preserveResponsiveFrame: boolean;
  readonly visible: boolean;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const [geometryState, setGeometryState] = useState<WindowGeometryState | null>(null);
  const geometryRef = useRef<WindowGeometry | null>(null);
  const normalizationRef = useRef<WindowGeometryNormalization>(identityGeometryNormalization);
  const inputSignatureRef = useRef(inputSignature);
  const interactionRef = useRef<WindowInteraction | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containmentTaskRef = useRef<number | null>(null);
  const pendingGeometryRef = useRef<WindowGeometry | null>(null);

  function commitGeometry(nextGeometry: WindowGeometry) {
    geometryRef.current = nextGeometry;
    const currentInputSignature = inputSignatureRef.current;
    const currentNormalization = normalizationRef.current;
    setGeometryState((current) =>
      current?.inputSignature === currentInputSignature &&
        geometryEquals(current.value, nextGeometry) &&
        normalizationEquals(current.normalization, currentNormalization)
        ? current
        : {
            inputSignature: currentInputSignature,
            normalization: currentNormalization,
            value: nextGeometry,
          });
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

  function cancelInteraction() {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    pendingGeometryRef.current = null;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const element = windowRef.current;
    if (
      interaction !== null &&
      element !== null &&
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(interaction.pointerId)
    ) {
      element.releasePointerCapture(interaction.pointerId);
    }
  }

  function geometryContext(element: HTMLElement) {
    const canvas = element.closest<HTMLElement>(".desktop-canvas");
    if (canvas !== null) {
      const canvasRect = canvas.getBoundingClientRect();
      const bounds = safeBounds(canvasRect.width, canvasRect.height, minSize);
      return bounds === null ? null : { bounds, originLeft: canvasRect.left, originTop: canvasRect.top };
    }
    const bounds = safeBounds(window.innerWidth, window.innerHeight, minSize);
    return bounds === null ? null : { bounds, originLeft: 0, originTop: 0 };
  }

  function captureGeometry(element: HTMLElement): WindowGeometry | null {
    const context = geometryContext(element);
    if (context === null) return null;
    /* Interactive geometry is layout geometry. Measuring with caller-owned
       transforms disabled prevents translate/scale from being baked into
       left/top/size and then applied a second time by composedStyle. */
    const rect = untransformedClientRect(element);
    normalizationRef.current = geometryNormalization(element);
    const captured = {
      left: rect.left - context.originLeft,
      top: rect.top - context.originTop,
      width: rect.width || numericInlineLength(element.style.width, minSize.width),
      height: rect.height || numericInlineLength(element.style.height, minSize.height),
    };
    return clampedGeometry(captured, context.bounds);
  }

  useLayoutEffect(() => {
    const element = windowRef.current;
    if (inputSignatureRef.current !== inputSignature) {
      inputSignatureRef.current = inputSignature;
      geometryRef.current = null;
      normalizationRef.current = identityGeometryNormalization;
      cancelInteraction();
    }
    /* A zoom/minimize/retention transition is also an interaction boundary.
       End pointer capture and discard queued geometry before the transient
       frame is painted so captured moves cannot mutate the restore frame. */
    if (!visible || !enabled) {
      cancelInteraction();
      return;
    }
    if (element === null) return;
    const canvas = element.closest<HTMLElement>(".desktop-canvas");

    function containedGeometry() {
      const currentElement = windowRef.current;
      if (currentElement === null) return null;
      const context = geometryContext(currentElement);
      if (context === null) return null;
      const current = geometryRef.current;
      return current === null
        ? preserveResponsiveFrame ? null : captureGeometry(currentElement)
        : clampedGeometry(current, context.bounds);
    }

    function commitContainment(next: WindowGeometry) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pendingGeometryRef.current = null;
      commitGeometry(next);
      const interaction = interactionRef.current;
      if (interaction !== null) {
        /* Rebase an active gesture at its last pointer sample. A later move
           then continues from the contained frame rather than reviving an
           out-of-bounds opposite edge captured before the canvas changed. */
        interactionRef.current = {
          ...interaction,
          origin: next,
          startX: interaction.lastX,
          startY: interaction.lastY,
        };
      }
    }

    function scheduleContainment() {
      if (containmentTaskRef.current !== null) return;
      /* ResizeObserver delivery and animation frames can still share the
         browser's layout-update cycle. Re-read and commit in a deduplicated
         following task so rapid pane shrink/reset notifications settle first
         and cannot feed layout back into the observer loop. */
      containmentTaskRef.current = window.setTimeout(() => {
        containmentTaskRef.current = null;
        const next = containedGeometry();
        if (next !== null) commitContainment(next);
      }, 0);
    }

    /* Fixed canvas geometry is captured immediately so coordinates become
       canvas-relative before paint. Responsive authored CSS remains in charge
       until a real pointer move; resizing the canvas can then keep resolving
       percentages without an incidental click freezing them into pixels. */
    if (canvas !== null && !preserveResponsiveFrame) {
      const initialGeometry = containedGeometry();
      if (initialGeometry !== null) commitContainment(initialGeometry);
    }
    const observer = canvas === null || typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleContainment);
    if (canvas !== null) observer?.observe(canvas);
    window.addEventListener("resize", scheduleContainment);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleContainment);
      if (containmentTaskRef.current !== null) {
        window.clearTimeout(containmentTaskRef.current);
        containmentTaskRef.current = null;
      }
    };
  }, [enabled, inputSignature, minSize.height, minSize.width, preserveResponsiveFrame, visible]);

  useEffect(() => () => cancelInteraction(), []);

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !visible || !draggable || event.button !== 0 || !event.isPrimary) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(dragHandleSelector)) return;
    if (target.closest("button, input, textarea, select, a, [role='button'], .traffic-lights, [data-no-window-drag]")) return;
    const element = windowRef.current;
    const origin = geometryRef.current ?? (element === null ? null : captureGeometry(element));
    if (element === null || origin === null) return;
    interactionRef.current = {
      kind: "drag",
      geometryOwned: geometryRef.current !== null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      origin,
    };
    if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
  }

  function beginResize(edge: WindowResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !visible || !resizable || event.button !== 0 || !event.isPrimary) return;
    const element = windowRef.current;
    const origin = geometryRef.current ?? (element === null ? null : captureGeometry(element));
    if (element === null || origin === null) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      kind: "resize",
      edge,
      geometryOwned: geometryRef.current !== null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      origin,
    };
    if (typeof element.setPointerCapture === "function") element.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !visible) return;
    const interaction = interactionRef.current;
    const element = windowRef.current;
    if (interaction === null || element === null || interaction.pointerId !== event.pointerId) return;
    const context = geometryContext(element);
    if (context === null) return;
    const initialDeltaX = event.clientX - interaction.startX;
    const initialDeltaY = event.clientY - interaction.startY;
    if (
      !interaction.geometryOwned &&
      Math.max(Math.abs(initialDeltaX), Math.abs(initialDeltaY)) < 2
    ) {
      interactionRef.current = { ...interaction, lastX: event.clientX, lastY: event.clientY };
      return;
    }
    const ownedInteraction = interaction.geometryOwned
      ? interaction
      : {
          ...interaction,
          geometryOwned: true,
          origin: captureGeometry(element) ?? interaction.origin,
        };
    /* From the first intentional move onward, the physical geometry model is
       authoritative. Setting the ref now lets containment observe that
       ownership even before the scheduled React commit. */
    geometryRef.current = ownedInteraction.origin;
    const containedOrigin = clampedGeometry(ownedInteraction.origin, context.bounds);
    const activeInteraction = geometryEquals(ownedInteraction.origin, containedOrigin)
      ? ownedInteraction
      : {
          ...ownedInteraction,
          origin: containedOrigin,
          startX: event.clientX,
          startY: event.clientY,
        };
    interactionRef.current = { ...activeInteraction, lastX: event.clientX, lastY: event.clientY };
    const deltaX = event.clientX - activeInteraction.startX;
    const deltaY = event.clientY - activeInteraction.startY;
    const next = activeInteraction.kind === "drag"
      ? clampedGeometry({
          ...activeInteraction.origin,
          left: activeInteraction.origin.left + deltaX,
          top: activeInteraction.origin.top + deltaY,
        }, context.bounds)
      : resizedGeometry(
          activeInteraction.origin,
          activeInteraction.edge ?? "se",
          deltaX,
          deltaY,
          context.bounds,
        );
    scheduleGeometry(next);
  }

  function finishInteraction(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || !visible) {
      cancelInteraction();
      return;
    }
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

  const geometry = geometryState?.inputSignature === inputSignature
    ? geometryState.value
    : null;
  const geometryStyle = geometryState?.inputSignature === inputSignature
    ? normalizedGeometryStyle(geometryState.value, geometryState.normalization)
    : null;

  return {
    beginDrag,
    beginResize,
    geometry,
    geometryStyle,
    onPointerCancel: finishInteraction,
    onPointerMove,
    onPointerUp: finishInteraction,
    windowRef,
  };
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
  /** Called on minimize; managed windows move into the Dock either way. */
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
  const authoredFrameStyle: CSSProperties = {
    ...framePlacement(frame, defaultSize),
    ...style,
  };
  const preserveResponsiveFrame = hasResponsiveFrameGeometry(authoredFrameStyle);
  const activateManagedWindow = manager?.activateWindow;
  const closeManagedWindow = manager?.closeWindow;
  const consumeKeyboardWindowFocusIntent = manager?.consumeKeyboardWindowFocusIntent;
  const minimizeManagedWindow = manager?.minimizeWindow;
  const toggleManagedZoom = manager?.toggleZoom;
  const windowGeometry = useWindowGeometry({
    draggable,
    dragHandleSelector,
    enabled: !minimizing && !zoomed,
    inputSignature: windowGeometryInputSignature(authoredFrameStyle),
    minSize,
    preserveResponsiveFrame,
    resizable,
    visible,
  });
  const controls = useMemo<WindowControls>(() => ({
    close: () => {
      onClose?.();
      if (managed && resolvedWindowId !== null) closeManagedWindow?.(resolvedWindowId);
      else setHidden(true);
    },
    minimize: () => {
      onMinimize?.();
      if (managed && resolvedWindowId !== null) minimizeManagedWindow?.(resolvedWindowId);
      else setMinimizing(true);
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
      setHidden(true);
      setMinimizing(false);
    }, minimizeDurationMs);
    return () => window.clearTimeout(timer);
  }, [minimizing]);

  const retained = managed && !visible;
  if (!visible && !managed) return null;

  const interactiveGeometryStyle = zoomed ? null : windowGeometry.geometryStyle;
  const composedStyle: CSSProperties = {
    ...(zoomed
      ? { ...zoomedPlacement, ...style }
      : interactiveGeometryStyle === null
        ? authoredFrameStyle
        : withoutInteractiveFrameConstraints(authoredFrameStyle)),
    ...(interactiveGeometryStyle ?? undefined),
    ...(managedWindow === null ? undefined : { zIndex: managedWindow.zIndex }),
    ...(resolvedWindowId === null ? undefined : { viewTransitionName: macWindowViewTransitionName(resolvedWindowId) }),
  };
  if (minimizing) {
    const existingTransform = composedStyle.transform;
    composedStyle.transform = `${existingTransform === undefined || existingTransform === "none" ? "" : `${existingTransform} `}translateY(42px) scale(0.5)`;
    composedStyle.opacity = 0;
  }
  if (retained) composedStyle.display = "none";

  return (
    <WindowControlsContext.Provider value={controls}>
      <section
        ref={windowGeometry.windowRef}
        style={composedStyle}
        className={`mac-window ${className}${zoomed ? " mc-zoomed" : ""}${minimizing ? " mc-minimizing" : ""}${retained ? " mc-retained" : ""}`}
        aria-label={retained ? undefined : label}
        aria-hidden={retained ? true : undefined}
        hidden={retained}
        inert={retained ? true : undefined}
        data-app-id={app?.id}
        data-key-window={managedWindow === null ? undefined : managedWindow.isKeyWindow ? "true" : "false"}
        data-window-id={retained ? undefined : resolvedWindowId ?? undefined}
        data-window-resizable={resizable ? "true" : "false"}
        data-window-state={managedWindow?.state}
        onPointerDownCapture={retained ? undefined : () => {
          // Interactive descendants such as React Aria collections may stop
          // pointer events during their own press handling. Window activation
          // is a frame-level behavior, so observe it before descendants can
          // consume the event.
          if (resolvedWindowId !== null) activateManagedWindow?.(resolvedWindowId);
        }}
        onFocusCapture={retained ? undefined : () => {
          if (resolvedWindowId !== null && consumeKeyboardWindowFocusIntent?.()) {
            activateManagedWindow?.(resolvedWindowId);
          }
        }}
        onPointerDown={retained ? undefined : (event) => {
          windowGeometry.beginDrag(event);
        }}
        onPointerMove={retained ? undefined : windowGeometry.onPointerMove}
        onPointerUp={retained ? undefined : windowGeometry.onPointerUp}
        onPointerCancel={retained ? undefined : windowGeometry.onPointerCancel}
        onDragEnter={retained ? undefined : onDragEnter}
        onDragLeave={retained ? undefined : onDragLeave}
        onDragOver={retained ? undefined : onDragOver}
        onDrop={retained ? undefined : onDrop}
      >
        {children}
        {!retained && resizable && !zoomed && !minimizing ? resizeEdges.map((edge) => (
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
