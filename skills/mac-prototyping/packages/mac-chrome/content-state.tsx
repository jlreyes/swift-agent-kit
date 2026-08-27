"use client";

import { useId, type ReactNode } from "react";

import "./styles/tokens.css";
import "./styles/content-state.css";

export function MacContentUnavailable({
  actions,
  className = "",
  description,
  icon,
  title,
}: {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly title: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className={`mc-content-unavailable ${className}`.trim()} aria-labelledby={headingId}>
      {icon !== undefined ? <span className="mc-content-unavailable-icon" aria-hidden="true">{icon}</span> : null}
      <h2 id={headingId}>{title}</h2>
      {description !== undefined ? <p>{description}</p> : null}
      {actions !== undefined ? <div className="mc-content-unavailable-actions">{actions}</div> : null}
    </section>
  );
}
