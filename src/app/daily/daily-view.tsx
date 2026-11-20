"use client";

import { useState } from "react";
import { CountdownChip } from "@/components/game/daily-challenge-card";
import { EraBadge } from "@/components/game/era-switch";
import { LazyGamePlay, usePrefetchGamePlay } from "@/components/game/lazy-game-play";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { DAILY_LENGTH } from "@/games/core/difficulty";
import type { GameMode } from "@/games/core/types";
import { api } from "@/lib/api-client";
import type { DailyStatusDTO, StartSessionResponse } from "@/lib/api-types";
import { fmtDailyDate, fmtNumber, guestName } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n/provider";
import { meData, useMe } from "@/lib/me-context";
import { MODES } from "@/lib/modes";
import { useApi } from "@/lib/use-api";

/** Daily uses every mode except Top 10 (registry DAILY_MODES); listed in the design's order. */
const DAILY_MIX: GameMode[] = [
  "starting-five",
  "team-journey",
  "teammate-challenge",
  "career-stats",
  "box-score",
];
/** Design shows the first 8 rows of today's ranking. */
const DAILY_BOARD_ROWS = 8;

function DailyEmpty() {
  const t = useT();
  return (
    <EmptyState
      className="block"
      icon="calendar"
      title={t.daily.emptyTitle}
      description={t.daily.emptyDesc}
      actions={<Button href="/games">{t.common.playAGame}</Button>}
    />
  );
}

function DailyLoading() {
  const t = useT();
  return (
    <div className="block" aria-busy="true" aria-label={t.daily.loading}>
      <div className="split">
        <Skeleton shape="block" />
        <div className="stack">
          <Skeleton shape="row" />
          <Skeleton shape="row" />
          <Skeleton shape="row" />
          <Skeleton shape="row" />
        </div>
      </div>
    </div>
  );
}

function OpenView({ status, onStart }: { status: DailyStatusDTO; onStart: () => void }) {
  const t = useT();
  return (
    <div className="split">
      <Card className="stack">
        <div className="row">
          <Badge variant="accent" icon="calendar">
            {t.daily.todaysMix}
          </Badge>
          <DifficultyBadge difficulty="medium" />
          <EraBadge era="all" />
        </div>
        <ol className="stack stack--sm">
          {DAILY_MIX.slice(0, DAILY_LENGTH).map((m, i) => (
            <li key={m} className="row row--nowrap">
              <span className="top10__rank">{i + 1}</span>
              <Icon name={MODES[m].icon} className="t-accent" />
              <span>{MODES[m].title}</span>
            </li>
          ))}
        </ol>
        <Button block size="lg" icon="play" onClick={onStart}>
          {t.daily.start}
        </Button>
      </Card>
      <Card className="stack">
        <span className="t-label">{t.daily.oneAttempt}</span>
        <p className="t-sm t-muted">{t.daily.sameQuestions(DAILY_LENGTH)}</p>
        <p className="t-sm t-muted">{t.daily.eraMix}</p>
        <CountdownChip targetIso={status.nextResetAt} prefix={t.daily.resetsIn} />
      </Card>
    </div>
  );
}

function PlayedView({ status }: { status: DailyStatusDTO }) {
  const { t, locale } = useI18n();
  const me = meData(useMe().state);
  const board = useApi("lb-day", (s) => api.getLeaderboard("day", s));
  const result = status.result;
  const rank = board.state.status === "success" ? board.state.data.me.rank : null;

  return (
    <div className="split">
      <div className="stack">
        <Card component="DailyChallengeCard" className="stack" data-state="played">
          <Badge variant="success" icon="calendar-check">
            {t.daily.alreadyPlayed}
          </Badge>
          <div className="summary-strip">
            <div>
              <span className="t-label">{t.common.score}</span>
              <div className="daily-card__score">{fmtNumber(result?.score ?? 0, locale)}</div>
            </div>
            <div>
              <span className="t-label">{t.common.correct}</span>
              <div className="daily-card__score">
                {result?.correct ?? 0}/{result?.total ?? DAILY_LENGTH}
              </div>
            </div>
            {rank ? (
              <div>
                <span className="t-label">{t.common.rank}</span>
                <div className="daily-card__score">#{fmtNumber(rank, locale)}</div>
              </div>
            ) : null}
          </div>
          <CountdownChip targetIso={status.nextResetAt} />
        </Card>
      </div>
      <div>
        <div className="block__head">
          <h2 className="block__title">{t.daily.todaysRanking}</h2>
        </div>
        {board.state.status === "loading" ? (
          <div className="stack stack--sm" aria-busy="true" aria-label={t.daily.loadingRanking}>
            <Skeleton shape="row" />
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </div>
        ) : board.state.status === "error" ? (
          <ErrorState compact title={t.daily.rankingUnavailable} onRetry={board.retry} />
        ) : board.state.data.rows.length === 0 ? (
          <EmptyState
            compact
            icon="trophy"
            title={t.common.noScoresYet}
            description={t.daily.rankingEmptyDesc}
          />
        ) : (
          <LeaderboardTable
            variant="daily"
            label={t.daily.todaysRanking}
            rows={board.state.data.rows.slice(0, DAILY_BOARD_ROWS)}
            me={{
              rank: board.state.data.me.rank,
              points: board.state.data.me.points,
              name:
                board.state.data.me.nickname ??
                me?.nickname ??
                (me ? guestName(me.id, locale) : t.common.you),
            }}
          />
        )}
      </div>
    </div>
  );
}

export function DailyView() {
  const { t, locale } = useI18n();
  usePrefetchGamePlay();
  const daily = useApi("daily", (s) => api.getDaily(s));
  const [run, setRun] = useState<{ key: number; request: Promise<StartSessionResponse> } | null>(
    null,
  );
  const [mode, setMode] = useState<GameMode | null>(null);

  function start() {
    setMode(null);
    // Request created here, not in the state updater: StrictMode runs updaters twice.
    const request = api.startDaily();
    setRun((prev) => ({ key: (prev?.key ?? 0) + 1, request }));
  }
  function backToStatus() {
    setRun(null);
    setMode(null);
    daily.retry();
  }

  const eyebrow =
    daily.state.status === "success"
      ? fmtDailyDate(daily.state.data.date, locale)
      : t.daily.eyebrow;
  // Mode names stay English: lang="en" keeps Turkish uppercasing from turning "i" into "İ".
  const title =
    run && mode ? (
      <>
        {t.daily.titleWithMode("")}
        <span lang="en">{MODES[mode].title}</span>
      </>
    ) : (
      t.dailyTitle
    );

  function body() {
    if (run) {
      return (
        <LazyGamePlay
          key={run.key}
          request={run.request}
          onRestart={start}
          onQuestion={setMode}
          onConflict={backToStatus}
          emptyState={<DailyEmpty />}
          resultActions={
            <>
              <Button href="/games" size="lg" icon="play">
                {t.common.playAGame}
              </Button>
              <Button variant="secondary" size="lg" onClick={backToStatus}>
                {t.daily.seeRanking}
              </Button>
            </>
          }
        />
      );
    }
    if (daily.state.status === "loading") return <DailyLoading />;
    if (daily.state.status === "error") {
      if (daily.state.error.code === "NOT_FOUND") return <DailyEmpty />;
      return (
        <ErrorState
          className="block"
          title={t.daily.errorTitle}
          description={t.daily.errorDesc}
          onRetry={daily.retry}
        />
      );
    }
    const status = daily.state.data;
    return (
      <div className="block">
        {status.played ? (
          <PlayedView status={status} />
        ) : (
          <OpenView status={status} onStart={start} />
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        titleId="daily-title"
        eyebrow={eyebrow}
        title={title}
        description={run ? undefined : t.meta.dailyDescription}
      />
      {body()}
    </>
  );
}
