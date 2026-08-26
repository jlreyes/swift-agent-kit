// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { getSymbol } from "symbolist";

import { SystemSymbol, type SystemSymbolName } from "../system-symbol.tsx";
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
    expect(symbol?.childElementCount).toBe(0);
    expect(symbol?.style.fontSize).toBe("18px");
    expect(symbol?.getAttribute("aria-hidden")).toBe("true");
    expect(symbol?.querySelector("svg")).toBeNull();
  });

  it("ships final glyph metrics in the initial HTML without a hydration correction", () => {
    const html = renderToStaticMarkup(<SystemSymbol name="person.2.fill" size={20} />);

    expect(html).toContain('data-system-symbol="person.2.fill"');
    expect(html).toContain('style="font-size:20px"');
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
});
