import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Trailing icon (design: "See all ›"). */
  iconEnd?: IconName;
  block?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
type ButtonAsButton = CommonProps & NativeButtonProps & { href?: undefined };
type ButtonAsLink = CommonProps & { href: string; onClick?: () => void; "aria-label"?: string };

function classes(block?: boolean, className?: string) {
  return ["btn", block ? "btn--block" : "", className ?? ""].filter(Boolean).join(" ");
}

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    size = "md",
    icon,
    iconEnd,
    block,
    loading,
    className,
    children,
  } = props;
  const content = (
    <>
      {icon ? <Icon name={icon} size={size === "lg" ? "md" : "sm"} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size="sm" /> : null}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        className={classes(block, className)}
        data-component="Button"
        data-variant={variant}
        data-size={size}
        onClick={props.onClick}
        aria-label={props["aria-label"]}
      >
        {content}
      </Link>
    );
  }

  const native: NativeButtonProps = { ...props };
  for (const key of [
    "variant",
    "size",
    "icon",
    "iconEnd",
    "block",
    "loading",
    "className",
    "children",
    "href",
  ]) {
    delete (native as Record<string, unknown>)[key];
  }
  return (
    <button
      {...native}
      type={native.type ?? "button"}
      className={classes(block, className)}
      data-component="Button"
      data-variant={variant}
      data-size={size}
      data-state={loading ? "loading" : undefined}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
