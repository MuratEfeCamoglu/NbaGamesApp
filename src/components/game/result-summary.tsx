"use client";

import type { ReactNode } from "react";
import type { AchievementView, SessionSummary } from "@/games/core/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { accuracyPct, fmtNumber } from "@/lib/format";
import { AchievementBadge } from "./achievement-badge";
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
  const scoreCount = countUpProps(summary.score);
  return (
    <Card component="ResultSummary" className="result-summary">
      <span className="result-summary__rays" aria-hidden="true" />
      <Badge variant="success" icon="check">
        Session complete
      </Badge>
      <div className="stack stack--sm">
        <span className="t-label">Total points</span>
        <span
          className={["result-summary__score", scoreCount.className ?? ""].join(" ").trim()}
          style={scoreCount.style}
          data-testid="result-score"
        >
          {fmtNumber(summary.score)}
        </span>
      </div>
      <div className="result-summary__stats">
        <StatTile
          label="Correct"
          value={
            <>
              {summary.correct}
              <span className="t-muted t-xl">/{summary.total}</span>
            </>
          }
        />
        <StatTile
          label="Best streak"
          value={summary.bestStreak}
          countTo={summary.bestStreak}
          tone="accent"
        />
        <StatTile label="Accuracy" value={`${accuracyPct(summary.correct, summary.total)}%`} />
      </div>
      {newAchievements.length > 0 ? (
        <div className="stack stack--sm">
          <span className="t-label">New badges</span>
          <div className="result-summary__badges">
            {newAchievements.map((a) => (
              <AchievementBadge key={a.id} id={a.id} name={a.name} state="unlocking" />
            ))}
          </div>
        </div>
      ) : null}
      {showNicknameNudge ? (
        <div className="nudge" data-component="Card">
          <Icon name="trophy" size="lg" />
          <span className="t-sm grow">Set a nickname to appear on the leaderboard.</span>
          <button
            className="btn"
            data-component="Button"
            data-variant="primary"
            data-size="sm"
            type="button"
            onClick={onSetNickname}
          >
            Set nickname
          </button>
        </div>
      ) : null}
      <div className="result-summary__actions">{actions}</div>
    </Card>
  );
}
