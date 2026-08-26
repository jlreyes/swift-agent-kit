// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getSymbol } from "symbolist";

import { calculateSystemSymbolFit, SystemSymbol, type SystemSymbolName } from "../system-symbol.tsx";
import { ToolbarGlyph, type ToolbarGlyphName } from "../toolbar.tsx";

afterEach(cleanup);

describe("SystemSymbol", () => {
  it("renders the typed symbolist glyph without embedding an SVG asset", () => {
    const { container } = render(<SystemSymbol className="sample" name="folder" size={18} />);
    const symbol = container.querySelector<HTMLElement>("[data-system-symbol='folder']");

    expect(symbol?.tagName).toBe("SPAN");
    expect(symbol?.classList.contains("mc-system-symbol")).toBe(true);
    expect(symbol?.classList.contains("sample")).toBe(true);
    expect(symbol?.textContent).toBe(getSymbol("folder"));
    expect(symbol?.querySelector(".mc-system-symbol-glyph")?.textContent).toBe(getSymbol("folder"));
    expect(symbol?.style.fontSize).toBe("18px");
    expect(symbol?.getAttribute("aria-hidden")).toBe("true");
    expect(symbol?.querySelector("svg")).toBeNull();
  });

  it("scales and centers wide or off-baseline glyph ink inside its assigned frame", () => {
    const fit = calculateSystemSymbolFit(
      { left: 100, top: 50, width: 26, height: 26 },
      { left: 91.5, top: 50, width: 43, height: 26 },
      { left: 91.5, top: 47, width: 43, height: 31.5 },
    );

    expect(fit.scale).toBeCloseTo(26 / 43);
    const fittedLeft = 91.5 + (91.5 - 91.5) * fit.scale + fit.translateX;
    const fittedTop = 50 + (47 - 50) * fit.scale + fit.translateY;
    expect(fittedLeft).toBeCloseTo(100);
    expect(fittedTop).toBeCloseTo(50 + (26 - 31.5 * fit.scale) / 2);
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
});
