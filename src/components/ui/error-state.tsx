"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";

export type ErrorVariant = "network" | "session-expired" | "server" | "storage";

const VARIANT_ICON: Record<ErrorVariant, IconName> = {
  network: "wifi-off",
  "session-expired": "clock",
  server: "alert",
  storage: "alert",
};

interface ErrorStateProps {
  variant?: ErrorVariant;
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions after "Try again" (e.g. a Home link). */
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  variant = "network",
  title,
  description,
  onRetry,
  retryLabel,
  actions,
  compact,
  className,
}: ErrorStateProps) {
  const t = useT();
  return (
    <div
      className={["state-panel", compact ? "state-panel--compact" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-component="ErrorState"
      data-variant={variant}
      role="alert"
    >
      <span className="state-panel__icon">
        <Icon name={VARIANT_ICON[variant]} size="lg" />
      </span>
      <p className="state-panel__title">{title}</p>
      {description ? <p className="state-panel__desc">{description}</p> : null}
      {onRetry || actions ? (
        <div className="state-panel__actions">
          {onRetry ? (
            <Button
              variant={compact ? "secondary" : "primary"}
              size={compact ? "sm" : "md"}
              icon="rotate"
              onClick={onRetry}
            >
              {retryLabel ?? t.common.tryAgain}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
