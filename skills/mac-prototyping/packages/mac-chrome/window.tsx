"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export function TrafficLights({ onClose }: { readonly onClose?: () => void } = {}) {
  return (
    <div className="traffic-lights" aria-label="Window controls">
      {onClose ? <button type="button" className="traffic-close" onClick={onClose} aria-label="Close window" /> : <span className="traffic-close" />}
      <span className="traffic-minimize" />
      <span className="traffic-zoom" />
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
    element.setPointerCapture(event.pointerId);
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
    if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  }

  const style: CSSProperties = { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` };
  return { windowRef, style, onPointerDown, onPointerMove, onPointerUp: finishDrag, onPointerCancel: finishDrag };
}

export function WindowChrome({
  children,
  className = "",
  draggable = false,
  dragHandleSelector,
  label,
  style,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly draggable?: boolean;
  readonly dragHandleSelector?: string;
  readonly label: string;
  /** Merged under the drag transform (e.g. injected grid column widths). */
  readonly style?: CSSProperties;
  readonly onDragEnter?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDragLeave?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const {
    windowRef,
    style: windowStyle,
    onPointerDown: onWindowPointerDown,
    onPointerMove: onWindowPointerMove,
    onPointerUp: onWindowPointerUp,
    onPointerCancel: onWindowPointerCancel,
  } = useWindowDrag<HTMLElement>(draggable, dragHandleSelector);
  return (
    <section
      ref={windowRef}
      style={draggable ? { ...style, ...windowStyle } : style}
      className={`mac-window ${className}`}
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
  );
}
