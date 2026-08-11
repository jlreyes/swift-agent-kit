"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import "./styles/tokens.css";
import "./styles/base.css";

/** Window placement/size override. Numbers are px; strings pass through as CSS. */
export type WindowFrame = {
  readonly top?: number | string;
  readonly left?: number | string;
  readonly width?: number | string;
  readonly height?: number | string;
};

type WindowSize = { readonly width: number; readonly height: number };

const genericDefaultSize: WindowSize = { width: 720, height: 480 };

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

export function WindowChrome({
  children,
  className = "",
  defaultSize = genericDefaultSize,
  draggable = true,
  dragHandleSelector,
  frame,
  label,
  style,
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
  /** Fallback geometry when `frame` omits width/height (surfaces set their own). */
  readonly defaultSize?: WindowSize;
  readonly draggable?: boolean;
  readonly dragHandleSelector?: string;
  /** Placement/size override; unset sides default to the centered placement. */
  readonly frame?: WindowFrame;
  readonly label: string;
  /** Merged over the frame placement, under the drag transform. */
  readonly style?: CSSProperties;
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
  const [zoomed, setZoomed] = useState(false);
  const {
    windowRef,
    style: dragStyle,
    onPointerDown: onWindowPointerDown,
    onPointerMove: onWindowPointerMove,
    onPointerUp: onWindowPointerUp,
    onPointerCancel: onWindowPointerCancel,
  } = useWindowDrag<HTMLElement>(draggable && !minimizing, dragHandleSelector);

  const controls = useMemo<WindowControls>(() => ({
    close: () => {
      onClose?.();
      setHidden(true);
    },
    minimize: () => {
      onMinimize?.();
      setMinimizing(true);
    },
    zoom: () => {
      onZoom?.();
      setZoomed((current) => !current);
    },
  }), [onClose, onMinimize, onZoom]);

  useEffect(() => {
    if (!minimizing) return;
    const timer = window.setTimeout(() => setHidden(true), minimizeDurationMs);
    return () => window.clearTimeout(timer);
  }, [minimizing]);

  if (hidden) return null;

  const composedStyle: CSSProperties = {
    ...(zoomed ? zoomedPlacement : framePlacement(frame, defaultSize)),
    ...style,
    ...(draggable ? dragStyle : undefined),
  };
  if (minimizing) {
    composedStyle.transform = `${draggable ? `${dragStyle.transform ?? ""} ` : ""}translateY(42px) scale(0.5)`;
    composedStyle.opacity = 0;
  }

  return (
    <WindowControlsContext.Provider value={controls}>
      <section
        ref={windowRef}
        style={composedStyle}
        className={`mac-window ${className}${zoomed ? " mc-zoomed" : ""}${minimizing ? " mc-minimizing" : ""}`}
        aria-label={label}
        onPointerDown={onWindowPointerDown}
        onPointerMove={onWindowPointerMove}
        onPointerUp={onWindowPointerUp}
        onPointerCancel={onWindowPointerCancel}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {children}
      </section>
    </WindowControlsContext.Provider>
  );
}
