export type SkeletonShape = "text" | "title" | "block" | "circle" | "btn" | "row";

export function Skeleton({
  shape = "text",
  width,
}: {
  shape?: SkeletonShape;
  width?: 40 | 60 | 80;
}) {
  const cls = ["skeleton", `skeleton--${shape}`, width ? `skeleton--w${width}` : ""]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} data-component="Skeleton" aria-hidden="true" />;
}
