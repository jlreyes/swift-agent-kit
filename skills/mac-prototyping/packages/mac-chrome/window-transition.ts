"use client";

import { flushSync } from "react-dom";

export interface MacWindowThumbnail {
  /** Rasterized window content. Omitted when capture is unavailable. */
  readonly src?: string;
  readonly width: number;
  readonly height: number;
}

export function macWindowViewTransitionName(windowId: string): string {
  const safeId = windowId.replace(/[^a-zA-Z0-9_-]/g, (character) => `-${character.codePointAt(0)?.toString(16) ?? "0"}-`);
  return `mc-window-${safeId}`;
}

export async function captureMacWindowThumbnail(element: HTMLElement | null): Promise<MacWindowThumbnail | undefined> {
  if (element === null) return undefined;
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || Number.parseFloat(element.style.width) || 720));
  const height = Math.max(1, Math.round(rect.height || Number.parseFloat(element.style.height) || 480));

  try {
    const { toPng } = await import("html-to-image");
    const src = await toPng(element, {
      cacheBust: false,
      pixelRatio: Math.min(1, 360 / width),
      skipFonts: true,
    });
    return { src, width, height };
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
