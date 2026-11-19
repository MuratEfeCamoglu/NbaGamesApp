import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import type { HistoryItemDTO } from "@/lib/api-types";
import { fmtNumber, fmtRelativeDay } from "@/lib/format";
import { modeTitle } from "@/lib/modes";

export function GameHistoryList({ items, now }: { items: HistoryItemDTO[]; now: Date }) {
  return (
    <ol className="history" data-component="GameHistoryList">
      {items.map((it) => (
        <li key={it.sessionId} className="history__item">
          <div className="stack stack--sm">
            <span className="history__mode">{modeTitle(it.mode)}</span>
            <span className="history__meta">
              <DifficultyBadge difficulty={it.difficulty} />
              <time dateTime={it.finishedAt}>{fmtRelativeDay(it.finishedAt, now)}</time>
            </span>
          </div>
          <div>
            <div className="history__points">+{fmtNumber(it.score)}</div>
            <div className="history__acc">
              {it.correct}/{it.total} correct
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
