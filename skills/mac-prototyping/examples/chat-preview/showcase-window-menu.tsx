import WindowShowcase from "./showcase-window.tsx";
import type { EmbeddedShowcaseProps } from "./showcase.tsx";

export default function WindowMenuShowcase({ menuBar = true, windowManagement = false }: EmbeddedShowcaseProps) {
  return <WindowShowcase menuBar={menuBar} windowManagement={windowManagement} />;
}
