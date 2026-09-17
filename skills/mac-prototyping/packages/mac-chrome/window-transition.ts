"use client";

import { flushSync } from "react-dom";

export interface MacWindowThumbnail {
  /** Rasterized window content. Omitted when capture is unavailable. */
  readonly src?: string;
  /** Window layout dimensions in logical desktop points. */
  readonly width: number;
  readonly height: number;
  readonly rasterWidth?: number;
  readonly rasterHeight?: number;
}

/** Fixed-width UTF-16 encoding keeps every JavaScript window id distinct. */
export function macWindowViewTransitionName(windowId: string): string {
  let encodedId = "";
  for (let index = 0; index < windowId.length; index += 1) {
    encodedId += windowId.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return `mc-window-${windowId.length.toString(16)}-${encodedId}`;
}

export async function captureMacWindowThumbnail(element: HTMLElement | null): Promise<MacWindowThumbnail | undefined> {
  if (element === null) return undefined;
  const computed = getComputedStyle(element);
  const width = Math.max(1, Math.round(element.offsetWidth || Number.parseFloat(computed.width) || 720));
  const height = Math.max(1, Math.round(element.offsetHeight || Number.parseFloat(computed.height) || 480));
  const rasterScale = Math.min(1, 360 / width);
  const rasterWidth = Math.max(1, Math.round(width * rasterScale));
  const rasterHeight = Math.max(1, Math.round(height * rasterScale));

  try {
    const { toPng } = await import("html-to-image");
    const src = await toPng(element, {
      cacheBust: false,
      width,
      height,
      canvasWidth: rasterWidth,
      canvasHeight: rasterHeight,
      pixelRatio: 1,
      skipFonts: true,
      // Capture the window's local surface, excluding its desktop placement.
      style: {
        position: "relative", left: "0", top: "0", right: "auto", bottom: "auto",
        transform: "none", translate: "none", rotate: "none", scale: "none",
        margin: "0", boxSizing: "border-box", maxWidth: "none", maxHeight: "none",
      },
    });
    return { src, width, height, rasterWidth, rasterHeight };
  } catch {
    /* Cross-origin images or browser resource policies can reject a raster
       capture. The Dock still receives a correctly sized window tile, using
       the app icon as its explicit fallback rather than dropping the item. */
    return { width, height };
  }
}

type DocumentWithViewTransitions = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export function commitMacWindowViewTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update();
    return;
  }
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = (document as DocumentWithViewTransitions).startViewTransition;
  if (reduceMotion || startViewTransition === undefined) {
    update();
    return;
  }
  startViewTransition.call(document, () => flushSync(update));
}
