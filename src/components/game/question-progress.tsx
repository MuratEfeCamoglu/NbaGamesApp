"use client";

import { useT } from "@/lib/i18n/provider";

export type SegmentState = "correct" | "wrong" | "current" | "todo";

export function QuestionProgress({
  index,
  total,
  results,
}: {
  index: number;
  total: number;
  results: ("correct" | "wrong")[];
}) {
  const t = useT();
  const segments: SegmentState[] = Array.from(
    { length: total },
    (_, i) => results[i] ?? (i === index ? "current" : "todo"),
  );
  return (
    <div className="question-progress" data-component="QuestionProgress" aria-live="polite">
      <span
        className="question-progress__count"
        aria-label={t.hud.questionOf(Math.min(index + 1, total), total)}
      >
        <b>{Math.min(index + 1, total)}</b>
        <span>
          /<b>{total}</b>
        </span>
      </span>
      <span className="question-progress__segments" aria-hidden="true">
        {segments.map((s, i) => (
          <span key={i} className="question-progress__seg" data-state={s} />
        ))}
      </span>
    </div>
  );
}
