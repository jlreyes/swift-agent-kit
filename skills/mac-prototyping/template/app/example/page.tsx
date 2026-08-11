import type { Metadata } from "next";
import { BrandIcon } from "../../components/BrandIcon.tsx";
import { SFSymbol } from "../../components/SFSymbol.tsx";
import { DesktopShell, MacDock, MacToolbar, TrafficLights, WindowChrome, type MenuBarMenu } from "../../lib/mac-chrome/index.ts";
import { FinderDemo } from "./finder-demo.tsx";

export const metadata: Metadata = { title: "Example · Mac Prototype" };

// A real dropdown in the menu bar (vendored package): click "File" to open,
// arrows navigate, Esc / click-away close. Entries are plain serializable
// objects, so a server page can pass them across the RSC boundary; wire
// onSelect handlers from a client component when actions are needed.
const fileMenu: MenuBarMenu = {
  title: "File",
  items: [
    { kind: "action", id: "new-window", label: "New Window" },
    { kind: "action", id: "new-folder", label: "New Folder" },
    { kind: "separator", id: "sep-1" },
    { kind: "action", id: "get-info", label: "Get Info" },
  ],
};

export default function ExamplePage() {
  return (
    <DesktopShell appName="Example" menuItems={[fileMenu, "Edit", "View", "Window", "Help"]}>
      {/* Windows are draggable by default (grab the toolbar) and the traffic
          lights work: hover the cluster for the glyphs, then close/minimize/
          zoom. The `frame` prop overrides the built-in centered geometry. */}
      <WindowChrome label="Example Window" frame={{ top: 84, left: 56, width: 500, height: 320 }}>
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
      {/* FinderWindow: default ~940x580 centered geometry, parity toolbar
          (left-aligned title + capsule controls) with zero consumer CSS. */}
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
