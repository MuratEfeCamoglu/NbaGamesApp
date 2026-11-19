import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "section";
  variant?: "default" | "raised" | "interactive";
  /** data-component override for design components built on .card (DailyChallengeCard, GameCard…). */
  component?: string;
  children: ReactNode;
}

export function Card({
  as: Tag = "div",
  variant = "default",
  component = "Card",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      {...rest}
      className={["card", className ?? ""].filter(Boolean).join(" ")}
      data-component={component}
      data-variant={variant === "default" ? undefined : variant}
    >
      {children}
    </Tag>
  );
}
