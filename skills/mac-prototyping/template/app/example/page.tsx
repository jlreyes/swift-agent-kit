import type { Metadata } from "next";
import { BrandIcon } from "../../components/BrandIcon.tsx";
import { SFSymbol } from "../../components/SFSymbol.tsx";
import { MacDock, MacToolbar, TrafficLights, WindowChrome } from "../../lib/mac-chrome/index.ts";
import { ExampleDesktop } from "./example-desktop.tsx";
import { FinderDemo } from "./finder-demo.tsx";

export const metadata: Metadata = { title: "Example · Mac Prototype" };

export default function ExamplePage() {
  return (
    <ExampleDesktop>
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
      <MacDock label="Mac Dock" />
    </ExampleDesktop>
  );
}
