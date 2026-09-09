"use client";

import { useState } from "react";
import { MacInspector, MacNavigationSplitView, MacSourceList, MacTextField } from "../../../lib/mac-chrome/index.ts";

export function NavigationLayout() {
  const [compound, setCompound] = useState(true);
  const [threeColumns, setThreeColumns] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(220);
  const [longLabels, setLongLabels] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("item-0");
  const items = Array.from({ length: 60 }, (_, index) => ({
    id: `item-${index}`,
    label: longLabels ? `Document ${index + 1} — ${"Research".repeat(20)}` : `Item ${index + 1}`,
  })).filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  const list = <MacSourceList label="Documents" sections={[{ id: "documents", title: "Documents", items }]} selectedId={selected} onSelectionChange={setSelected} />;
  const minimumWindowWidth = 180 + 280 + 1 + (threeColumns ? 181 : 0) + (inspector ? inspectorWidth + 1 : 0) + 2;

  return (
    <main className="navigation-layout-fixture">
      <h1>Navigation layout</h1>
      <div className="navigation-layout-options">
        <label><input type="checkbox" checked={compound} onChange={(event) => setCompound(event.target.checked)} />Compound sidebar</label>
        <label><input type="checkbox" checked={threeColumns} onChange={(event) => setThreeColumns(event.target.checked)} />Three columns</label>
        <label><input type="checkbox" checked={inspector} onChange={(event) => setInspector(event.target.checked)} />Inspector</label>
        <label><input type="checkbox" checked={longLabels} onChange={(event) => setLongLabels(event.target.checked)} />Long labels</label>
      </div>
      <div className="navigation-layout-stage" data-testid="navigation-stage">
      <div className="navigation-layout-window" style={{ minWidth: minimumWindowWidth }}>
        <MacNavigationSplitView
          id="layout-fixture"
          sidebarLabel="Library"
          sidebarSizing={{ minSize: 180, defaultSize: 300, maxSize: 380 }}
          contentSizing={{ minSize: 180, defaultSize: 220, maxSize: 320 }}
          detailSizing={{ minSize: 280, defaultSize: 500 }}
          sidebar={compound ? (
            <div className="navigation-layout-compound" data-testid="compound-sidebar">
              <header data-testid="sidebar-header">Library</header>
              <div className="navigation-layout-search">
                <MacTextField className="navigation-layout-search-field" ariaLabel="Search documents" type="search" placeholder="Search" value={query} onChange={setQuery} />
              </div>
              {list}
              <footer data-testid="sidebar-footer">{items.length} documents</footer>
            </div>
          ) : list}
          content={threeColumns ? <div className="navigation-layout-content">Documents</div> : undefined}
          detail={<div className="navigation-layout-detail"><h2>Document</h2><output aria-label="Selected document">{selected}</output><div className="navigation-layout-detail-scroll">{Array.from({ length: 60 }, (_, index) => <p key={index}>Document detail line {index + 1}</p>)}</div></div>}
        />
        <MacInspector visible={inspector} label="Document inspector" width={inspectorWidth} onWidthChange={setInspectorWidth}>
          <div className="navigation-layout-content">Document information</div>
        </MacInspector>
      </div>
      </div>
    </main>
  );
}
