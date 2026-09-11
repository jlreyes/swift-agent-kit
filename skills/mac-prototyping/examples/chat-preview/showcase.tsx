import { useState, type MouseEvent } from "react";
import { MacEmbeddedPresentation } from "../../packages/mac-chrome/index.ts";
import "../../packages/mac-chrome/styles/index.css";
import { ShowcaseDesktop } from "../../template/app/showcase/showcase-desktop.tsx";
import "../../template/app/showcase/showcase.css";
import { SheetMotion } from "../../template/app/showcase/sheet-motion/sheet-motion.tsx";

export default function EmbeddedShowcase({ menuBar = true }: { readonly menuBar?: boolean }) {
  const [page, setPage] = useState("showcase");
  const [initialWidth] = useState(() => typeof window === "undefined" ? 1024 : window.innerWidth);

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
      <MacEmbeddedPresentation menuBar={menuBar} height={640}>
        {page === "showcase"
          ? <ShowcaseDesktop sheetMotionHref="#/showcase/sheet-motion" initialSidebarVisible={initialWidth >= 500} initialInspectorVisible={initialWidth >= 1000} />
          : <SheetMotion showcaseHref="#/showcase" />}
      </MacEmbeddedPresentation>
    </div>
  );
}
