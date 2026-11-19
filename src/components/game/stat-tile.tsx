import type { CSSProperties, ReactNode } from "react";

/**
 * Props for the CSS count-up effect (globals.css `.count-up`). The real, formatted value stays in
 * the DOM text the whole time; a decorative ::after counter rolls 0 → n on top, then hides.
 */
export function countUpProps(n: number | undefined): {
  className?: string;
  style?: CSSProperties;
} {
  if (n === undefined || !Number.isInteger(n) || n <= 0) return {};
  return { className: "count-up", style: { "--count-to": n } as CSSProperties };
}

export function StatTile({
  label,
  value,
  tone,
  className,
  countTo,
}: {
  label: string;
  value: ReactNode;
  tone?: "accent" | "muted";
  className?: string;
  /** Integer behind `value`: enables the count-up animation. */
  countTo?: number;
}) {
  const count = countUpProps(countTo);
  const valueCls = [
    "stat-tile__value",
    tone === "accent" ? "t-accent" : tone === "muted" ? "t-muted" : "",
    count.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={["stat-tile", className ?? ""].filter(Boolean).join(" ")}
      data-component="StatTile"
    >
      <span className="t-label">{label}</span>
      <span className={valueCls} style={count.style}>
        {value}
      </span>
    </div>
  );
}
