/**
 * Framework-neutral viewport metadata for reviewing a fixed 1200px Mac
 * desktop through a phone browser's native pan and zoom controls. Its shape is
 * compatible with Next's Viewport type without importing Next into mac-chrome.
 */
export const fixedDesktopReviewViewport = {
  width: 1200,
  initialScale: 1,
  minimumScale: 0.25,
  maximumScale: 4,
  userScalable: true,
} as const;

export type FixedDesktopReviewViewport = typeof fixedDesktopReviewViewport;
