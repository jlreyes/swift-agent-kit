"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { getSymbol, type SymbolName } from "symbolist";

import "./styles/tokens.css";
import "./styles/base.css";

export type SystemSymbolName = SymbolName;

type SymbolBounds = Pick<DOMRectReadOnly, "height" | "left" | "top" | "width">;

export function calculateSystemSymbolFit(
  frame: SymbolBounds,
  glyph: SymbolBounds,
  content: SymbolBounds,
) {
  if (frame.width <= 0 || frame.height <= 0 || content.width <= 0 || content.height <= 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const scale = Math.min(1, frame.width / content.width, frame.height / content.height);
  const targetLeft = frame.left + (frame.width - content.width * scale) / 2;
  const targetTop = frame.top + (frame.height - content.height * scale) / 2;
  return {
    scale,
    translateX: targetLeft - glyph.left - (content.left - glyph.left) * scale,
    translateY: targetTop - glyph.top - (content.top - glyph.top) * scale,
  };
}

function fitGlyph(frame: HTMLElement, glyph: HTMLElement) {
  glyph.style.removeProperty("--mc-symbol-fit-scale");
  glyph.style.removeProperty("--mc-symbol-fit-x");
  glyph.style.removeProperty("--mc-symbol-fit-y");

  const frameBounds = frame.getBoundingClientRect();
  if (frameBounds.width <= 0 || frameBounds.height <= 0) return;

  const range = document.createRange();
  range.selectNodeContents(glyph);
  if (typeof range.getBoundingClientRect !== "function") return;
  const contentBounds = range.getBoundingClientRect();
  const glyphBounds = glyph.getBoundingClientRect();
  const fit = calculateSystemSymbolFit(frameBounds, glyphBounds, contentBounds);

  glyph.style.setProperty("--mc-symbol-fit-scale", `${fit.scale}`);
  glyph.style.setProperty("--mc-symbol-fit-x", `${fit.translateX}px`);
  glyph.style.setProperty("--mc-symbol-fit-y", `${fit.translateY}px`);
}

/**
 * Renders an SF Symbols codepoint without distributing Apple font or image
 * assets. On macOS the system font stack resolves the private-use glyph.
 */
export function SystemSymbol({ className = "", name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const style: CSSProperties | undefined = size === undefined
    ? undefined
    : { fontSize: `${size}px` };

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const glyph = glyphRef.current;
    if (frame === null || glyph === null) return;

    let disposed = false;
    const fit = () => {
      if (!disposed) fitGlyph(frame, glyph);
    };
    fit();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(frame);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [name, size]);

  return (
    <span
      aria-hidden="true"
      className={`mc-system-symbol ${className}`.trim()}
      data-system-symbol={name}
      ref={frameRef}
      style={style}
    >
      <span className="mc-system-symbol-glyph" ref={glyphRef}>{getSymbol(name) ?? ""}</span>
    </span>
  );
}
