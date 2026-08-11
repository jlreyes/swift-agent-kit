"use client";

import type { CSSProperties, ReactNode } from "react";

const defaultMenuItems = ["File", "Edit", "View", "Window", "Help"] as const;

/* Accepts a full CSS <image> value or a bare URL for the wallpaper prop. */
const cssImagePattern = /^(url\(|linear-gradient\(|radial-gradient\(|conic-gradient\(|image-set\(|var\()/;

type DesktopCanvasStyle = CSSProperties & { readonly "--mc-wallpaper"?: string };

export interface DesktopShellProps {
  readonly appName: string;
  readonly menuItems?: readonly string[];
  readonly date?: string;
  readonly clock?: string;
  /** CSS image value (url(...), gradient, var(...)) or a bare image URL. */
  readonly wallpaper?: string;
  readonly children: ReactNode;
}

export function DesktopShell({
  appName,
  menuItems = defaultMenuItems,
  date = "Wed Aug 6",
  clock = "9:47 AM",
  wallpaper,
  children,
}: DesktopShellProps) {
  const canvasStyle: DesktopCanvasStyle | undefined = wallpaper
    ? { "--mc-wallpaper": cssImagePattern.test(wallpaper) ? wallpaper : `url("${wallpaper}")` }
    : undefined;
  return (
    <main className="showcase-viewport">
      <div className="desktop-canvas" style={canvasStyle}>
        <header className="mac-menu-bar">
          <div className="menu-left">
            <span className="apple-mark" aria-hidden="true"></span>
            <strong>{appName}</strong>
            {menuItems.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="menu-right" aria-label="Mac status items">
            <span className="status-battery" aria-label="Battery"><i /></span>
            <span className="status-wifi" aria-label="Wi-Fi"><i /><i /><i /></span>
            <span>{date}</span>
            <span>{clock}</span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
