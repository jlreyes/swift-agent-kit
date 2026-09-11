"use client";

import { useRef, useState } from "react";
import { DesktopShell, MacApp, MacAppDock, MacButton, MacSheet, MacTextField, MacToolbar, MacWindowManager, TrafficLights, WindowChrome, type MacAppDefinition } from "../../../lib/mac-chrome/index.ts";
import "./sheet-motion.css";

const app: MacAppDefinition = { id: "sheet-motion", name: "Sheet Motion", icon: { kind: "systemSymbol", name: "doc.text", background: "var(--chrome-ink)", foreground: "var(--on-accent)" } };

export function SheetMotion({ showcaseHref = "/showcase" }: { readonly showcaseHref?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("project");
  const [result, setResult] = useState("No project created");
  const trigger = useRef<HTMLButtonElement>(null);
  const customize = step === "options";
  return <MacWindowManager initialApps={[app]}><DesktopShell appName="Sheet Motion">
    <MacApp {...app}><WindowChrome windowId="sheet-motion:main" label="Sheet Motion" frame={{ width: 740, height: 530 }} minSize={{ width: 480, height: 360 }}>
      <MacToolbar leading={<TrafficLights />} title="Sheet Motion" />
      <main className="sheet-motion-main">
        <h1>Attached sheet replacement</h1>
        <p>Open a project, edit its name, visit Options, then return. The name stays in place until the sheet closes.</p>
        <MacButton ref={trigger} onPress={() => { setStep("project"); setOpen(true); }}>New Project…</MacButton>
        <output aria-live="polite">{result}</output>
        <a href={showcaseHref}>All components</a>
      </main>
      <MacSheet open={open} presentationKey={step} title={customize ? "Project Options" : "New Project"} fallbackFocusRef={trigger}
        initialFocusSelector="input" onClose={() => {}} actions={customize ? [
          { id: "cancel", label: "Cancel", role: "cancel", onPress: () => setStep("project") },
          { id: "use", label: "Use Options", isDefault: true, onPress: () => setStep("project") },
        ] : [
          { id: "cancel", label: "Cancel", role: "cancel", onPress: () => setOpen(false) },
          { id: "create", label: "Create", isDefault: true, onPress: () => { setResult("Project created"); setOpen(false); } },
        ]}>
        {customize ? <DraftField label="Retention days" initial="30" />
          : <><DraftField label="Project name" initial="Untitled Project" /><MacButton onPress={() => setStep("options")}>Options…</MacButton></>}
      </MacSheet>
    </WindowChrome></MacApp>
    <MacAppDock />
  </DesktopShell></MacWindowManager>;
}

function DraftField({ label, initial }: { readonly label: string; readonly initial: string }) {
  const [value, setValue] = useState(initial);
  return <MacTextField className="sheet-motion-field" label={label} value={value} onChange={setValue} />;
}
