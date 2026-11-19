import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  highlight,
  text,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  text?: boolean;
}) {
  return (
    <div
      className="stat-card"
      data-component="StatCard"
      data-variant={highlight ? "highlight" : undefined}
    >
      <span className="t-label">{label}</span>
      <span className={text ? "stat-card__value stat-card__value--text" : "stat-card__value"}>
        {value}
      </span>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="stat-grid" data-component="StatGrid">
      {children}
    </div>
  );
}
