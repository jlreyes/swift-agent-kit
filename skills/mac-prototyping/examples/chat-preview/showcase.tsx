import { useState, type MouseEvent } from "react";
import { MacEmbeddedPresentation, macBookAirM1DisplaySize, type MacDisplaySize } from "../../packages/mac-chrome/index.ts";
import "../../packages/mac-chrome/styles/embedded.css";
import { ShowcaseDesktop } from "../../template/app/showcase/showcase-desktop.tsx";
import "../../template/app/showcase/showcase.css";
import { SheetMotion } from "../../template/app/showcase/sheet-motion/sheet-motion.tsx";

export type EmbeddedShowcaseProps = {
  readonly displaySize?: MacDisplaySize | "viewport";
  readonly menuBar?: boolean;
  readonly windowManagement?: boolean;
};

export default function EmbeddedShowcase({ displaySize = macBookAirM1DisplaySize, menuBar = true, windowManagement = true }: EmbeddedShowcaseProps) {
  const [page, setPage] = useState("showcase");
  const [viewportWidth] = useState(() => typeof window === "undefined" ? 1024 : window.innerWidth);
  const initialWidth = windowManagement && displaySize !== "viewport" ? displaySize.width : viewportWidth;

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    const href = link?.getAttribute("href");
    if (href !== "#/showcase" && href !== "#/showcase/sheet-motion") return;
    event.preventDefault();
    setPage(href === "#/showcase" ? "showcase" : "sheet-motion");
  }

  return (
    <div onClickCapture={navigate}>
      <MacEmbeddedPresentation menuBar={menuBar} windowManagement={windowManagement} height={640}>
        {page === "showcase"
          ? <ShowcaseDesktop displaySize={displaySize} singleWindow={!windowManagement} sheetMotionHref="#/showcase/sheet-motion" initialSidebarVisible={initialWidth >= 500} initialInspectorVisible={initialWidth >= 1000} />
          : <SheetMotion displaySize={displaySize} showcaseHref="#/showcase" />}
      </MacEmbeddedPresentation>
    </div>
  );
}
