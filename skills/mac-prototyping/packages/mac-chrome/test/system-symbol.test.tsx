// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { getSymbol } from "symbolist";

import { SystemSymbol, type SystemSymbolName } from "../system-symbol.tsx";
import { ToolbarButton, ToolbarGlyph, type ToolbarGlyphName } from "../toolbar.tsx";

afterEach(cleanup);

describe("SystemSymbol", () => {
  it("renders the typed symbolist glyph without embedding an SVG asset", () => {
    const { container } = render(<SystemSymbol className="sample" name="folder" size={18} />);
    const symbol = container.querySelector<HTMLElement>("[data-system-symbol='folder']");

    expect(symbol?.tagName).toBe("SPAN");
    expect(symbol?.classList.contains("mc-system-symbol")).toBe(true);
    expect(symbol?.classList.contains("sample")).toBe(true);
    expect(symbol?.textContent).toBe(getSymbol("folder"));
    expect(symbol?.childElementCount).toBe(0);
    expect(symbol?.style.fontSize).toBe("");
    expect(symbol?.style.getPropertyValue("--mc-system-symbol-size")).toBe("18px");
    expect(symbol?.getAttribute("aria-hidden")).toBe("true");
    expect(symbol?.querySelector("svg")).toBeNull();
  });

  it("ships final glyph metrics in the initial HTML without a hydration correction", () => {
    const html = renderToStaticMarkup(<SystemSymbol name="person.2.fill" size={20} />);

    expect(html).toContain('data-system-symbol="person.2.fill"');
    expect(html).toContain('style="--mc-system-symbol-size:20px"');
    expect(html).not.toContain("mc-system-symbol-glyph");
    expect(html).not.toContain("--mc-symbol-fit");
  });

  it("maps every toolbar role to the corresponding native symbol name", () => {
    const mappings = [
      ["back", "chevron.left"],
      ["forward", "chevron.right"],
      ["grid", "square.grid.2x2"],
      ["inspector", "sidebar.trailing"],
      ["list", "list.bullet"],
      ["more", "ellipsis"],
      ["search", "magnifyingglass"],
    ] as const satisfies readonly (readonly [ToolbarGlyphName, SystemSymbolName])[];

    for (const [name, symbolName] of mappings) {
      const rendered = render(<ToolbarGlyph name={name} />);
      expect(rendered.container.querySelector(`[data-system-symbol='${symbolName}']`)).toBeTruthy();
      rendered.unmount();
    }
  });

  it("lets the toolbar own its optical size even when a consumer requests another size", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = readFileSync("styles/toolbar.css", "utf8");
    document.head.append(stylesheet);
    const { container } = render(
      <ToolbarButton label="Oversized symbol">
        <SystemSymbol name="folder" size={40} />
      </ToolbarButton>,
    );
    const symbol = container.querySelector<HTMLElement>("[data-system-symbol='folder']");

    expect(symbol?.style.getPropertyValue("--mc-system-symbol-size")).toBe("40px");
    if (symbol === null) throw new Error("Expected the toolbar symbol to render");
    expect(getComputedStyle(symbol).fontSize).toBe("14px");
    stylesheet.remove();
  });
});
