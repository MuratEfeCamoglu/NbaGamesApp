import type { CSSProperties } from "react";

export function ProgressBar({
  value,
  label,
  variant,
}: {
  value: number;
  label: string;
  variant?: "success";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      data-component="ProgressBar"
      data-variant={variant}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      style={{ "--value": String(clamped / 100) } as CSSProperties}
    >
      <div className="progress__fill" />
    </div>
  );
}
