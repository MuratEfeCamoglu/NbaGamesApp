import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "outline";

export function Badge({
  variant = "neutral",
  icon,
  className,
  children,
}: {
  variant?: BadgeVariant;
  icon?: IconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={["badge", className ?? ""].filter(Boolean).join(" ")}
      data-component="Badge"
      data-variant={variant}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </span>
  );
}
