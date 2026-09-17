import WindowShowcase from "./showcase-window.tsx";
import type { EmbeddedShowcaseProps } from "./showcase.tsx";

export default function WindowMenuShowcase({ displaySize, menuBar = true, windowManagement = false }: EmbeddedShowcaseProps) {
  return <WindowShowcase displaySize={displaySize} menuBar={menuBar} windowManagement={windowManagement} />;
}
