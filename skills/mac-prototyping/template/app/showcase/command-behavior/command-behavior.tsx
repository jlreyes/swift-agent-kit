"use client";

import { useEffect, useRef, useState } from "react";
import { DesktopShell, MacAlert, MacSheet, WindowChrome } from "../../../lib/mac-chrome/index.ts";

export function CommandBehavior() {
  const [newCount, setNewCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [resolverEnabled, setResolverEnabled] = useState(true);
  const sheetTrigger = useRef<HTMLButtonElement>(null);
  const alertTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function dispatch(event: KeyboardEvent) {
      if (event.metaKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewCount((count) => count + 1);
      }
    }
    window.addEventListener("keydown", dispatch);
    return () => window.removeEventListener("keydown", dispatch);
  }, []);
  return (
    <DesktopShell appName="Commands"
      onMenuAction={({ menu, id }) => {
        if (menu === "File" && id === "new-window") setNewCount((count) => count + 1);
      }}
      canPerformMenuAction={resolverEnabled ? ({ menu, id }) => menu === "File" && id === "new-window" : undefined}>
      <WindowChrome label="Command behavior" frame={{ width: 700, height: 480 }}>
        <div>
          <h1>Command behavior</h1>
          <output aria-label="New commands">{newCount}</output>
          <output aria-label="Applied actions">{appliedCount}</output>
          <label><input type="checkbox" checked={resolverEnabled} onChange={(event) => setResolverEnabled(event.target.checked)} />Declare supported commands</label>
          <button ref={sheetTrigger} onClick={() => setSheetOpen(true)}>Open sheet</button>
          <button ref={alertTrigger} onClick={() => setAlertOpen(true)}>Open alert</button>
        </div>
        <MacSheet initialFocusSelector="input" title="Edit command" open={sheetOpen} onClose={() => setSheetOpen(false)} fallbackFocusRef={sheetTrigger}
          actions={[
            { id: "cancel", label: "Cancel", role: "cancel" },
            { id: "apply", label: "Apply", isDefault: true, onPress: () => setAppliedCount((count) => count + 1) },
          ]}>
          <label>Name<input defaultValue="Draft" /></label>
          <label>Notes<textarea defaultValue="First" /></label>
          <label>Child-owned Return<input onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
        </MacSheet>
        <MacAlert title="Apply command?" message="Apply the current command." open={alertOpen} onClose={() => setAlertOpen(false)} fallbackFocusRef={alertTrigger}
          actions={[
            { id: "cancel", label: "Cancel", role: "cancel" },
            { id: "apply", label: "Apply", isDefault: true, onPress: () => setAppliedCount((count) => count + 1) },
          ]} />
      </WindowChrome>
    </DesktopShell>
  );
}
