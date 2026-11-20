"use client";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import type { HistoryItemDTO } from "@/lib/api-types";
import { fmtNumber, fmtRelativeDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { modeTitle } from "@/lib/modes";
import { EraBadge } from "./era-switch";

export function GameHistoryList({ items, now }: { items: HistoryItemDTO[]; now: Date }) {
  const { t, locale } = useI18n();
  return (
    <ol className="history" data-component="GameHistoryList">
      {items.map((it) => (
        <li key={it.sessionId} className="history__item">
          <div className="stack stack--sm">
            <span className="history__mode">{modeTitle(it.mode, t)}</span>
            <span className="history__meta">
              <DifficultyBadge difficulty={it.difficulty} />
              <EraBadge era={it.era} />
              <time dateTime={it.finishedAt}>{fmtRelativeDay(it.finishedAt, now, locale)}</time>
            </span>
          </div>
          <div>
            <div className="history__points">+{fmtNumber(it.score, locale)}</div>
            <div className="history__acc">{t.profile.correctOf(it.correct, it.total)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
