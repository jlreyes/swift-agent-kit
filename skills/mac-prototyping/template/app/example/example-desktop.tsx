"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  defaultDockItems,
  DesktopShell,
  MacApp,
  MacAppDock,
  MacWindowManager,
  type MacAppDefinition,
  type MenuBarMenu,
  type MenuCommand,
} from "../../lib/mac-chrome/index.ts";

const fileMenu: MenuBarMenu = {
  title: "File",
  items: [
    { kind: "action", id: "new-window", label: "New Window", shortcut: "⌘N" },
    { kind: "action", id: "new-folder", label: "New Folder", shortcut: "⇧⌘N" },
    { kind: "separator", id: "sep-1" },
    { kind: "action", id: "get-info", label: "Get Info", shortcut: "⌘I" },
  ],
};

const exampleApp = {
  id: "finder",
  name: "Finder",
  icon: {
    kind: "systemSymbol",
    name: "face.smiling",
    background: "var(--accent)",
    foreground: "var(--on-accent)",
  },
} as const satisfies MacAppDefinition;

const exampleAppManifest: readonly MacAppDefinition[] = [exampleApp];

export function ExampleDesktop({ children }: { readonly children: ReactNode }) {
  return (
    <MacWindowManager initialApps={exampleAppManifest}>
      <ManagedExampleDesktop>{children}</ManagedExampleDesktop>
    </MacWindowManager>
  );
}

function ManagedExampleDesktop({ children }: { readonly children: ReactNode }) {
  const [lastCommand, setLastCommand] = useState<MenuCommand | null>(null);
  useEffect(() => {
    if (lastCommand === null) return;
    const timer = window.setTimeout(() => setLastCommand(null), 1_600);
    return () => window.clearTimeout(timer);
  }, [lastCommand]);
  return (
    <DesktopShell
      appName="Finder"
      menuItems={[fileMenu, "Edit", "View", "Window", "Help"]}
      onMenuAction={setLastCommand}
    >
      <MacApp {...exampleApp}>
        {children}
      </MacApp>
      <MacAppDock label="Mac Dock" extraItems={defaultDockItems} />
      {lastCommand !== null ? (
        <output className="example-command-feedback" aria-live="polite">
          {lastCommand.menu}: {lastCommand.label}
        </output>
      ) : null}
    </DesktopShell>
  );
}
