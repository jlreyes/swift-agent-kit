import { getSymbol, type SymbolName } from "symbolist";

export type { SymbolName };

/**
 * Renders an SF Symbol glyph as text. On a Mac the system font resolves the
 * private-use codepoint to the real symbol; no Apple assets are shipped —
 * `symbolist` only maps names to codepoints.
 */
export function SFSymbol({ name }: { readonly name: SymbolName }) {
  return (
    <span className="sf-symbol" aria-hidden="true" data-symbol={name}>
      {getSymbol(name) ?? ""}
    </span>
  );
}
