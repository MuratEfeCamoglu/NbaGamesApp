"use client";

import type { ReactNode } from "react";
import type { CorrectAnswerView, QuestionContent } from "@/games/core/types";
import { Badge } from "@/components/ui/badge";
import { fmtDecimal, fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { BoxScoreHeader, BoxScoreTable } from "./box-score-table";
import { CareerTimeline } from "./career-timeline";
import { PlayerCard, MysteryPlayerCard } from "./player-card";
import { StatCard, StatGrid } from "./stat-grid";
import { TeamBadge } from "./team-badge";
import { Top10Table, type Top10Picks } from "./top10-table";
import type { PickedPlayer } from "./player-search";

interface QuestionCardProps {
  content: QuestionContent;
  /** Revealed answer after the user answered (null before). */
  reveal: { correct: boolean; answer: CorrectAnswerView } | null;
  /** Top 10 only. */
  top10?: {
    picks: Top10Picks;
    onPick: (rank: number, p: PickedPlayer | null) => void;
    disabled?: boolean;
  };
  anim?: "in" | "out";
  /** ScoreToast slot (positioned over the card). */
  children?: ReactNode;
}

/**
 * Renders the mode-specific content. Every field the server sends as `null` (Expert hint reduction)
 * is simply not rendered — the UI never decides what to hide.
 */
export function QuestionCard({ content, reveal, top10, anim, children }: QuestionCardProps) {
  const { t, locale } = useI18n();
  const prompts = t.question.prompts;
  const revealedName = reveal?.answer.kind === "player" ? reveal.answer.player.name : null;
  const playerResult = reveal ? (reveal.correct ? "correct" : "wrong") : null;

  return (
    <article
      className="card question-card"
      data-component="QuestionCard"
      data-mode={content.mode}
      data-anim={anim}
      aria-live="polite"
    >
      <div className="mode-content" data-mode={content.mode}>
        {renderContent()}
      </div>
      {children}
    </article>
  );

  function renderContent() {
    switch (content.mode) {
      case "starting-five":
        return (
          <>
            <div className="question-card__context">
              <TeamBadge teamId={content.teamId} />
              <span className="t-sm">
                {content.teamName}
                {content.season ? ` · ${content.season}` : null}
              </span>
            </div>
            <h2 className="question-card__prompt">{prompts["starting-five"]}</h2>
            <div className="lineup">
              {content.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  headshotId={p.headshotId}
                  teamId={p.teamId ?? content.teamId}
                  meta={p.position}
                />
              ))}
              <MysteryPlayerCard
                revealedName={revealedName}
                result={playerResult}
                meta={content.missingPosition}
              />
            </div>
          </>
        );
      case "team-journey":
        return (
          <>
            {content.seasons !== null || content.allStarCount !== null ? (
              <div className="question-card__context">
                {content.seasons !== null ? (
                  <Badge variant="outline">{t.question.seasons(content.seasons)}</Badge>
                ) : null}
                {content.allStarCount !== null ? (
                  <Badge variant="outline">
                    {content.allStarCount > 0
                      ? t.question.allStar(content.allStarCount)
                      : t.question.noAllStar}
                  </Badge>
                ) : null}
              </div>
            ) : null}
            <h2 className="question-card__prompt">{prompts["team-journey"]}</h2>
            <CareerTimeline stints={content.stints} />
          </>
        );
      case "teammate-challenge":
        return (
          <>
            <h2 className="question-card__prompt">{prompts["teammate-challenge"]}</h2>
            <div className="teammates">
              {content.teammates.map((t) => (
                <PlayerCard
                  key={`${t.player.id}-${t.teamId}`}
                  name={t.player.name}
                  headshotId={t.player.headshotId}
                  teamId={t.teamId}
                  meta={
                    <>
                      <TeamBadge teamId={t.teamId} />
                      {t.season ? <span>{t.season}</span> : null}
                    </>
                  }
                />
              ))}
            </div>
          </>
        );
      case "career-stats": {
        const s = content.stats;
        return (
          <>
            <h2 className="question-card__prompt">{prompts["career-stats"]}</h2>
            <StatGrid>
              <StatCard label="PPG" value={fmtDecimal(s.ppg, locale)} highlight />
              <StatCard label="RPG" value={fmtDecimal(s.rpg, locale)} highlight />
              <StatCard label="APG" value={fmtDecimal(s.apg, locale)} />
              <StatCard label="SPG" value={fmtDecimal(s.spg, locale)} />
              <StatCard label="BPG" value={fmtDecimal(s.bpg, locale)} />
              <StatCard label="FG%" value={fmtDecimal(s.fgPct, locale)} />
              <StatCard label={t.question.games} value={fmtNumber(s.games, locale)} />
              {s.seasons !== null ? (
                <StatCard label={t.question.seasonsLabel} value={s.seasons} />
              ) : null}
              {s.position !== null ? (
                <StatCard label={t.question.position} value={s.position} text />
              ) : null}
            </StatGrid>
          </>
        );
      }
      case "box-score":
        return (
          <>
            <h2 className="question-card__prompt">{prompts["box-score"]}</h2>
            {content.game ? <BoxScoreHeader game={content.game} /> : null}
            <BoxScoreTable
              line={content.line}
              teamId={content.game?.teamId ?? null}
              playerLabel={revealedName ?? "???"}
            />
          </>
        );
      case "top-10":
        return (
          <>
            <div className="question-card__context">
              <Badge variant="accent">
                {t.question.list(content.listIndex, content.listTotal)}
              </Badge>
              <span className="t-xs t-muted">{content.statLabel}</span>
            </div>
            <h2 className="question-card__prompt">{t.question.listTitle(content.title)}</h2>
            <Top10Table
              rows={content.rows}
              picks={top10?.picks ?? {}}
              onPick={top10?.onPick ?? (() => undefined)}
              disabled={top10?.disabled}
              reveal={reveal?.answer.kind === "slots" ? reveal.answer : null}
            />
          </>
        );
    }
  }
}
