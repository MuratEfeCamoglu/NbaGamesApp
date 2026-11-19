"use client";

import { useState } from "react";
import { CountdownChip } from "@/components/game/daily-challenge-card";
import { GamePlay } from "@/components/game/game-play";
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

const DAILY_EMPTY = (
  <EmptyState
    className="block"
    icon="calendar"
    title="Today's challenge is on its way"
    description="A new challenge drops at midnight UTC. Warm up with a regular game."
    actions={<Button href="/games">Play a game</Button>}
  />
);

function DailyLoading() {
  return (
    <div className="block" aria-busy="true" aria-label="Loading daily challenge">
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
  return (
    <div className="split">
      <Card className="stack">
        <div className="row">
          <Badge variant="accent" icon="calendar">
            Today&apos;s mix
          </Badge>
          <DifficultyBadge difficulty="medium" />
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
          Start daily challenge
        </Button>
      </Card>
      <Card className="stack">
        <span className="t-label">One attempt per day</span>
        <p className="t-sm t-muted">
          Everyone gets the same {DAILY_LENGTH} questions today. Your attempt starts when you press
          Start.
        </p>
        <CountdownChip targetIso={status.nextResetAt} prefix="Resets in" />
      </Card>
    </div>
  );
}

function PlayedView({ status }: { status: DailyStatusDTO }) {
  const me = meData(useMe().state);
  const board = useApi("lb-day", (s) => api.getLeaderboard("day", s));
  const result = status.result;
  const rank = board.state.status === "success" ? board.state.data.me.rank : null;

  return (
    <div className="split">
      <div className="stack">
        <Card component="DailyChallengeCard" className="stack" data-state="played">
          <Badge variant="success" icon="calendar-check">
            Already played today
          </Badge>
          <div className="summary-strip">
            <div>
              <span className="t-label">Score</span>
              <div className="daily-card__score">{fmtNumber(result?.score ?? 0)}</div>
            </div>
            <div>
              <span className="t-label">Correct</span>
              <div className="daily-card__score">
                {result?.correct ?? 0}/{result?.total ?? DAILY_LENGTH}
              </div>
            </div>
            {rank ? (
              <div>
                <span className="t-label">Rank</span>
                <div className="daily-card__score">#{fmtNumber(rank)}</div>
              </div>
            ) : null}
          </div>
          <CountdownChip targetIso={status.nextResetAt} />
        </Card>
      </div>
      <div>
        <div className="block__head">
          <h2 className="block__title">Today&apos;s ranking</h2>
        </div>
        {board.state.status === "loading" ? (
          <div className="stack stack--sm" aria-busy="true" aria-label="Loading today's ranking">
            <Skeleton shape="row" />
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </div>
        ) : board.state.status === "error" ? (
          <ErrorState compact title="Ranking unavailable" onRetry={board.retry} />
        ) : board.state.data.rows.length === 0 ? (
          <EmptyState
            compact
            icon="trophy"
            title="No scores yet"
            description="Rankings appear as players finish today's challenge."
          />
        ) : (
          <LeaderboardTable
            variant="daily"
            label="Today's ranking"
            rows={board.state.data.rows.slice(0, DAILY_BOARD_ROWS)}
            me={{
              rank: board.state.data.me.rank,
              points: board.state.data.me.points,
              name: board.state.data.me.nickname ?? me?.nickname ?? (me ? guestName(me.id) : "You"),
            }}
          />
        )}
      </div>
    </div>
  );
}

export function DailyView() {
  const daily = useApi("daily", (s) => api.getDaily(s));
  const [run, setRun] = useState<{ key: number; request: Promise<StartSessionResponse> } | null>(
    null,
  );
  const [mode, setMode] = useState<GameMode | null>(null);

  function start() {
    setMode(null);
    setRun((prev) => ({ key: (prev?.key ?? 0) + 1, request: api.startDaily() }));
  }
  function backToStatus() {
    setRun(null);
    setMode(null);
    daily.retry();
  }

  const eyebrow = daily.state.status === "success" ? fmtDailyDate(daily.state.data.date) : "Daily";
  const title = run && mode ? `Daily · ${MODES[mode].title}` : "Daily Challenge";

  function body() {
    if (run) {
      return (
        <GamePlay
          key={run.key}
          request={run.request}
          onRestart={start}
          onQuestion={setMode}
          onConflict={backToStatus}
          emptyState={DAILY_EMPTY}
          resultActions={
            <>
              <Button href="/games" size="lg" icon="play">
                Play a game
              </Button>
              <Button variant="secondary" size="lg" onClick={backToStatus}>
                See daily ranking
              </Button>
            </>
          }
        />
      );
    }
    if (daily.state.status === "loading") return <DailyLoading />;
    if (daily.state.status === "error") {
      if (daily.state.error.code === "NOT_FOUND") return DAILY_EMPTY;
      return (
        <ErrorState
          className="block"
          title="Couldn't load today's challenge"
          description="Check your connection. Your daily attempt is not used until you start."
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
        description={
          run ? undefined : "Five mixed questions, the same for everyone. One attempt per day."
        }
      />
      {body()}
    </>
  );
}
