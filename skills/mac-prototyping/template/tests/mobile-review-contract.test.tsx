// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DesktopShell,
  fixedDesktopReviewViewport,
  WindowChrome,
} from "../lib/mac-chrome/index.ts";

const rootLayoutSource = readFileSync("app/layout.tsx", "utf8");
const showcaseLayoutSource = readFileSync("app/showcase/layout.tsx", "utf8");
const stubStyles = readFileSync("lib/mac-chrome/styles/index.css", "utf8");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("template fixed-desktop mobile review", () => {
  it("opts in only the showcase route", () => {
    expect(rootLayoutSource).not.toMatch(/export const viewport/);
    expect(showcaseLayoutSource).toContain("export const viewport: Viewport = fixedDesktopReviewViewport");
    expect(fixedDesktopReviewViewport).toEqual({
      width: 1200,
      initialScale: 1,
      minimumScale: 0.25,
      maximumScale: 4,
      userScalable: true,
    });
  });

  it("keeps responsive shells unmarked and fixed review explicit", () => {
    const responsive = render(<DesktopShell appName="Responsive">Responsive</DesktopShell>);
    expect(responsive.container.querySelector(".showcase-viewport")?.hasAttribute("data-mobile-review-mode")).toBe(false);
    responsive.unmount();

    const fixed = render(
      <DesktopShell appName="Fixed" mobileReviewMode="fixed-desktop">Fixed</DesktopShell>,
    );
    expect(fixed.container.querySelector<HTMLElement>(".showcase-viewport")?.dataset.mobileReviewMode).toBe("fixed-desktop");
  });

  it("preserves authored window presentation unless maximization is explicit", () => {
    render(
      <>
        <WindowChrome label="Authored">Authored</WindowChrome>
        <WindowChrome label="Maximized" mobilePresentation="maximized">Maximized</WindowChrome>
      </>,
    );
    expect(screen.getByRole("region", { name: "Authored" }).dataset.mobilePresentation).toBe("authored");
    expect(screen.getByRole("region", { name: "Maximized" }).dataset.mobilePresentation).toBe("maximized");
  });

  it("does not capture touch on stub resize handles", () => {
    render(<WindowChrome label="Touch window">Window</WindowChrome>);
    const windowElement = screen.getByRole("region", { name: "Touch window" });
    const resizeHandle = windowElement.querySelector<HTMLElement>('[data-window-resize-handle="se"]');
    if (resizeHandle === null) throw new Error("The southeast resize handle was absent");
    const setPointerCapture = vi.fn();
    Object.defineProperty(windowElement, "setPointerCapture", { configurable: true, value: setPointerCapture });

    fireEvent.pointerDown(resizeHandle, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("scopes fixed canvas and maximized presentation styles to opted-in shells", () => {
    expect(stubStyles).toMatch(/\.showcase-viewport\[data-mobile-review-mode="fixed-desktop"\]\s*\{[\s\S]*?width:\s*1200px;/);
    expect(stubStyles).toMatch(/\.mac-window\[data-mobile-presentation="maximized"\]\s*\{[\s\S]*?width:\s*100%\s*!important;/);
    expect(stubStyles).toMatch(/\.mc-window-resize-handle\s*\{[\s\S]*?display:\s*none;/);
  });
});
