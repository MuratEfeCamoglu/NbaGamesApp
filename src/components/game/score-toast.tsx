/** "+290" pop over the question card. Remount with a new `key` to replay the animation. */
export function ScoreToast({ points, isStatic }: { points: number | null; isStatic?: boolean }) {
  return (
    <div
      className={isStatic ? "score-toast score-toast--static" : "score-toast"}
      data-component="ScoreToast"
      data-state={points !== null && points > 0 ? "show" : undefined}
      aria-hidden="true"
    >
      +{points ?? 0}
    </div>
  );
}
