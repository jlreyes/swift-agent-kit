import type { CSSProperties } from "react";
import { getSymbol, type SymbolName } from "symbolist";

import "./styles/tokens.css";
import "./styles/base.css";

export type SystemSymbolName = SymbolName;

/**
 * Renders an SF Symbols codepoint without distributing Apple font or image
 * assets. On macOS the system font stack resolves the private-use glyph.
 */
export function SystemSymbol({ className = "", name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  const style: CSSProperties | undefined = size === undefined
    ? undefined
    : { fontSize: `${size}px` };

  return (
    <span
      aria-hidden="true"
      className={`mc-system-symbol ${className}`.trim()}
      data-system-symbol={name}
      style={style}
    >
      {getSymbol(name) ?? ""}
    </span>
  );
}
