import type { CSSProperties } from "react";
import { getSymbol, type SymbolName } from "symbolist";

import "./styles/tokens.css";
import "./styles/base.css";

export type SystemSymbolName = SymbolName;

/**
 * Renders an SF Symbols codepoint without distributing Apple font or image
 * assets. The glyph keeps its intrinsic font metrics; its parent component
 * owns the stable slot and optical font size.
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
