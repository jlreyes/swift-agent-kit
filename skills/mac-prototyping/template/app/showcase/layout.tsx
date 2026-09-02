import type { ReactNode } from "react";
import type { Viewport } from "next";

import { fixedDesktopReviewViewport } from "../../lib/mac-chrome/viewport.ts";

export const viewport: Viewport = fixedDesktopReviewViewport;

export default function ShowcaseLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
