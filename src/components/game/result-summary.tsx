"use client";

import type { ReactNode } from "react";
import type { AchievementView, SessionSummary } from "@/games/core/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { accuracyPct, fmtNumber, fmtPercent } from "@/lib/format";
import { achievementCopy } from "@/lib/i18n/helpers";
import { useI18n } from "@/lib/i18n/provider";
import { AchievementBadge } from "./achievement-badge";
import { EraBadge } from "./era-switch";
import { countUpProps, StatTile } from "./stat-tile";

interface ResultSummaryProps {
  summary: SessionSummary;
  newAchievements: AchievementView[];
  /** Show "Set a nickname" nudge (guest without nickname). */
  showNicknameNudge: boolean;
  onSetNickname: () => void;
  /** Primary + secondary buttons (Play again / Choose another game). */
  actions: ReactNode;
}

export function ResultSummary({
  summary,
  newAchievements,
  showNicknameNudge,
  onSetNickname,
  actions,
}: ResultSummaryProps) {
  const { t, locale } = useI18n();
  const scoreCount = countUpProps(summary.score);
  return (
    <Card component="ResultSummary" className="result-summary">
      <span className="result-summary__rays" aria-hidden="true" />
      <div className="row result-summary__tags">
        <Badge variant="success" icon="check">
          {t.result.complete}
        </Badge>
        <EraBadge era={summary.era} />
      </div>
      <div className="stack stack--sm">
        <span className="t-label">{t.common.totalPoints}</span>
        <span
          className={["result-summary__score", scoreCount.className ?? ""].join(" ").trim()}
          style={scoreCount.style}
          data-testid="result-score"
        >
          {fmtNumber(summary.score, locale)}
        </span>
      </div>
      <div className="result-summary__stats">
        <StatTile
          label={t.common.correct}
          value={
            <>
              {summary.correct}
              <span className="t-muted t-xl">/{summary.total}</span>
            </>
          }
        />
        <StatTile
          label={t.common.bestStreak}
          value={summary.bestStreak}
          countTo={summary.bestStreak}
          tone="accent"
        />
        <StatTile
          label={t.common.accuracy}
          value={fmtPercent(accuracyPct(summary.correct, summary.total), locale)}
        />
      </div>
      {newAchievements.length > 0 ? (
        <div className="stack stack--sm">
          <span className="t-label">{t.result.newBadges}</span>
          <div className="result-summary__badges">
            {newAchievements.map((a) => (
              <AchievementBadge
                key={a.id}
                id={a.id}
                name={achievementCopy(t, a).name}
                state="unlocking"
              />
            ))}
          </div>
        </div>
      ) : null}
      {showNicknameNudge ? (
        <div className="nudge" data-component="Card">
          <Icon name="trophy" size="lg" />
          <span className="t-sm grow">{t.common.nicknameCta}</span>
          <button
            className="btn"
            data-component="Button"
            data-variant="primary"
            data-size="sm"
            type="button"
            onClick={onSetNickname}
          >
            {t.common.setNickname}
          </button>
        </div>
      ) : null}
      <div className="result-summary__actions">{actions}</div>
    </Card>
  );
}
