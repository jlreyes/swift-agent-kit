import type { CSSProperties } from "react";
import { getSymbol, type SymbolName } from "symbolist";

import "./styles/tokens.css";
import "./styles/base.css";

export type SystemSymbolName = SymbolName;

type SystemSymbolStyle = CSSProperties & {
  readonly "--mc-system-symbol-size"?: string;
};

/**
 * Renders an SF Symbols codepoint without distributing Apple font or image
 * assets. `size` is the standalone fallback; role-owned containers such as
 * toolbar buttons may impose their native optical size through CSS.
 */
export function SystemSymbol({ className = "", name, size }: {
  readonly className?: string;
  readonly name: SystemSymbolName;
  readonly size?: number;
}) {
  const style: SystemSymbolStyle | undefined = size === undefined
    ? undefined
    : { "--mc-system-symbol-size": `${size}px` };

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
