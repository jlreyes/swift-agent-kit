"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";

export type MacDisplaySize = { readonly width: number; readonly height: number };
export type DesktopPoint = { readonly x: number; readonly y: number };

/** Effective desktop points, independent of the panel's 2560×1600 pixels. */
export const macBookAirM1DisplaySize: MacDisplaySize = { width: 1440, height: 900 };

export type DesktopSpace = {
  readonly canvas: HTMLDivElement | null;
  readonly displaySize: MacDisplaySize | null;
  readonly scale: number;
  readonly revision: number;
};

const DesktopSpaceContext = createContext<DesktopSpace | null>(null);

export function useDesktopSpace() {
  return useContext(DesktopSpaceContext);
}

/** Measured presentation scale; devicePixelRatio is not a coordinate conversion. */
export function getElementScale(element: HTMLElement): DesktopPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: element.offsetWidth > 0 && rect.width > 0 ? rect.width / element.offsetWidth : 1,
    y: element.offsetHeight > 0 && rect.height > 0 ? rect.height / element.offsetHeight : 1,
  };
}

export function viewportDeltaToLocal(element: HTMLElement, delta: DesktopPoint): DesktopPoint {
  const scale = getElementScale(element);
  return { x: delta.x / scale.x, y: delta.y / scale.y };
}

export function viewportPointToLocal(element: HTMLElement, point: DesktopPoint): DesktopPoint {
  const rect = element.getBoundingClientRect();
  return viewportDeltaToLocal(element, { x: point.x - rect.left, y: point.y - rect.top });
}

export type DesktopBounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export function getVisibleDesktopBounds(canvas: HTMLElement): DesktopBounds {
  const rect = canvas.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const left = Math.min(rect.right, Math.max(rect.left, viewportLeft));
  const top = Math.min(rect.bottom, Math.max(rect.top, viewportTop));
  const right = Math.max(left, Math.min(rect.right, viewportRight));
  const bottom = Math.max(top, Math.min(rect.bottom, viewportBottom));
  const start = viewportPointToLocal(canvas, { x: left, y: top });
  const end = viewportPointToLocal(canvas, { x: right, y: bottom });
  return { left: start.x, top: start.y, right: end.x, bottom: end.y };
}

type DesktopFrameStyle = CSSProperties & {
  readonly "--mc-display-width"?: string;
  readonly "--mc-display-height"?: string;
  readonly "--mc-display-ratio"?: number;
  readonly "--mc-display-fit-width"?: string;
};

export function DesktopSpaceFrame({ children, displaySize, canvasStyle, mobileReviewMode, constrainedHeight }: {
  readonly children: ReactNode;
  readonly displaySize: MacDisplaySize | null;
  readonly canvasStyle?: CSSProperties;
  readonly mobileReviewMode?: "fixed-desktop";
  readonly constrainedHeight?: number;
}) {
  const frameRef = useRef<HTMLElement>(null);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const [measurement, setMeasurement] = useState({ scale: 1, revision: 0 });
  const width = displaySize?.width;
  const height = displaySize?.height;
  if (displaySize !== null && (!Number.isFinite(displaySize.width) || !Number.isFinite(displaySize.height) || displaySize.width <= 0 || displaySize.height <= 0)) {
    throw new Error("DesktopShell displaySize must have positive finite width and height.");
  }
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    function measure() {
      if (frame === null || canvas === null || canvas.offsetWidth <= 0) return;
      const scale = getElementScale(canvas).x;
      setMeasurement((current) => current.scale === scale ? current : { scale, revision: current.revision + 1 });
    }
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(frame);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [canvas, width, height]);
  const space = useMemo<DesktopSpace>(() => ({ canvas, displaySize, ...measurement }), [canvas, displaySize, measurement]);
  const frameStyle: DesktopFrameStyle | undefined = displaySize === null ? undefined : {
    "--mc-display-width": `${displaySize.width}px`,
    "--mc-display-height": `${displaySize.height}px`,
    "--mc-display-ratio": displaySize.width / displaySize.height,
    // Full-page shells retain their viewport-height constraint. Embedded
    // shells use the host's declared height; neither changes logical layout.
    "--mc-display-fit-width": constrainedHeight === undefined
      ? `min(${displaySize.width}px, calc(100dvh * ${displaySize.width / displaySize.height}))`
      : `${Math.min(displaySize.width, constrainedHeight * displaySize.width / displaySize.height)}px`,
  };
  return (
    <DesktopSpaceContext.Provider value={space}>
      <main ref={frameRef} className="showcase-viewport" data-display-space={displaySize === null ? "viewport" : "logical"} data-mobile-review-mode={mobileReviewMode} style={frameStyle}>
        <div ref={setCanvas} className="desktop-canvas" style={canvasStyle}>
          {children}
        </div>
      </main>
    </DesktopSpaceContext.Provider>
  );
}
