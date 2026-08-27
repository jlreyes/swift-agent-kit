import type { Metadata } from "next";

import { ShowcaseDesktop } from "./showcase-desktop.tsx";
import "./showcase.css";

export const metadata: Metadata = { title: "Showcase · Mac Prototype" };

export default function ShowcasePage() {
  return <ShowcaseDesktop />;
}
