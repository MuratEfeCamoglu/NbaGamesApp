import type { ReactNode } from "react";

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="tooltip" data-component="Tooltip">
      {children}
      <span className="tooltip__bubble" role="tooltip">
        {content}
      </span>
    </span>
  );
}
