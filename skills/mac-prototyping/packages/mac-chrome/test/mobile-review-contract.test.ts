import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fixedDesktopReviewViewport } from "../viewport.ts";

const baseStyles = readFileSync("styles/base.css", "utf8");

describe("fixed-desktop mobile review", () => {
  it("exports framework-neutral user-scalable viewport metadata", () => {
    expect(fixedDesktopReviewViewport).toEqual({
      width: 1200,
      initialScale: 1,
      minimumScale: 0.25,
      maximumScale: 4,
      userScalable: true,
    });
  });

  it("scopes the fixed canvas and maximized window presentation to an opted-in shell", () => {
    expect(baseStyles).toMatch(
      /\.showcase-viewport\[data-mobile-review-mode="fixed-desktop"\]\s*\{[^}]*width:\s*1200px;[^}]*height:\s*750px;[^}]*overflow:\s*visible;/s,
    );
    expect(baseStyles).toMatch(
      /\.showcase-viewport\[data-mobile-review-mode="fixed-desktop"\]\s*>\s*\.desktop-canvas\s*\{[^}]*width:\s*1200px;[^}]*height:\s*750px;/s,
    );
    expect(baseStyles).toMatch(
      /\.showcase-viewport\[data-mobile-review-mode="fixed-desktop"\][\s\S]*\.mac-window\[data-mobile-presentation="maximized"\]\s*\{[^}]*width:\s*100%\s*!important;[^}]*height:\s*calc\(100% - 105px\)\s*!important;/,
    );
    expect(baseStyles).toMatch(
      /\.showcase-viewport\[data-mobile-review-mode="fixed-desktop"\]\s+\.mc-window-resize-handle\s*\{[^}]*display:\s*none;/s,
    );
  });
});
