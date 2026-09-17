import EmbeddedShowcase, { type EmbeddedShowcaseProps } from "./showcase.tsx";

export default function WindowShowcase({ displaySize, menuBar = false, windowManagement = false }: EmbeddedShowcaseProps) {
  return <EmbeddedShowcase displaySize={displaySize} menuBar={menuBar} windowManagement={windowManagement} />;
}
