import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Rendered above the title (design: ghost "All games" back button). */
  back?: ReactNode;
  titleId?: string;
}

export function PageHeader({ title, eyebrow, description, back, titleId }: PageHeaderProps) {
  return (
    <div className="page-header" data-component="PageHeader">
      {back}
      {eyebrow ? <span className="t-label page-header__eyebrow">{eyebrow}</span> : null}
      <h1 className="page-header__title" id={titleId}>
        {title}
      </h1>
      {description ? <p className="page-header__desc">{description}</p> : null}
    </div>
  );
}
