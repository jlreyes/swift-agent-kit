import { SystemSymbol } from "./system-symbol.tsx";

/**
 * Shared disclosure affordance for Mac-style rows. The expanded state chooses
 * the matching SF Symbol instead of transforming a hand-drawn chevron, which
 * keeps the glyph metrics consistent everywhere it is composed.
 */
export function DisclosureIndicator({
  className = "",
  expanded,
}: {
  readonly className?: string;
  readonly expanded: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`mc-disclosure-indicator ${className}`.trim()}
      data-expanded={expanded || undefined}
    >
      <SystemSymbol name={expanded ? "chevron.down" : "chevron.right"} />
    </span>
  );
}
