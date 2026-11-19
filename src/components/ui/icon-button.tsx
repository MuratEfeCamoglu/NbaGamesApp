import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
> {
  icon: IconName;
  label: string;
  variant?: "default" | "ghost";
}

export function IconButton({ icon, label, variant = "default", type, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? "button"}
      className="icon-btn"
      data-component="IconButton"
      data-variant={variant === "ghost" ? "ghost" : undefined}
      aria-label={label}
    >
      <Icon name={icon} />
    </button>
  );
}
