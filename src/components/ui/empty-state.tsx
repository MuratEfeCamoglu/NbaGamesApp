import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={["state-panel", compact ? "state-panel--compact" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-component="EmptyState"
    >
      <span className="state-panel__icon">
        <Icon name={icon} size="lg" />
      </span>
      <p className="state-panel__title">{title}</p>
      {description ? <p className="state-panel__desc">{description}</p> : null}
      {actions ? <div className="state-panel__actions">{actions}</div> : null}
    </div>
  );
}
