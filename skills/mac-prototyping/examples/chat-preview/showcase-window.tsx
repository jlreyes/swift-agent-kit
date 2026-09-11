import EmbeddedShowcase, { type EmbeddedShowcaseProps } from "./showcase.tsx";

export default function WindowShowcase({ menuBar = false, windowManagement = false }: EmbeddedShowcaseProps) {
  return <EmbeddedShowcase menuBar={menuBar} windowManagement={windowManagement} />;
}
