import type { Metadata } from "next";
import { BrandIcon } from "../../components/BrandIcon.tsx";
import { SFSymbol } from "../../components/SFSymbol.tsx";
import { DesktopShell, MacDock, MacToolbar, TrafficLights, WindowChrome } from "../../lib/mac-chrome/index.ts";
import { FinderDemo } from "./finder-demo.tsx";

export const metadata: Metadata = { title: "Example · Mac Prototype" };

export default function ExamplePage() {
  return (
    <DesktopShell appName="Example">
      <WindowChrome label="Example Window">
        <MacToolbar
          leading={<TrafficLights />}
          title="Example Window"
          trailing={
            <>
              <SFSymbol name="sparkles" /> <span>Toolbar</span>
            </>
          }
        />
        <section className="window-placeholder">
          <p>Replace this window with your first surface.</p>
          <p>
            Connects to <BrandIcon slug="googledrive" title="Google Drive" /> <BrandIcon slug="notion" title="Notion" />
          </p>
        </section>
      </WindowChrome>
      <FinderDemo />
      <MacDock
        label="Mac Dock"
        items={[
          { id: "files", label: "Files", icon: "/dock/files.svg", running: true },
          { id: "notes", label: "Notes", icon: "/dock/notes.svg" },
          { id: "terminal", label: "Terminal", icon: "/dock/terminal.svg" },
          { id: "browser", label: "Browser", icon: "/dock/globe.svg" },
        ]}
      />
    </DesktopShell>
  );
}
