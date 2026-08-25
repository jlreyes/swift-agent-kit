import type { Metadata } from "next";
import { MacDock } from "../../lib/mac-chrome/index.ts";
import { ExampleDesktop } from "./example-desktop.tsx";
import { FinderDemo } from "./finder-demo.tsx";

export const metadata: Metadata = { title: "Example · Mac Prototype" };

export default function ExamplePage() {
  return (
    <ExampleDesktop>
      {/* The default route is one believable app surface, not a component
          sampler. Open /showcase for the full interactive component catalog. */}
      <FinderDemo />
      <MacDock label="Mac Dock" />
    </ExampleDesktop>
  );
}
