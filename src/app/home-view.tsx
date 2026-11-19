"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { fmtNumber } from "@/lib/format";
import { meData, useMe } from "@/lib/me-context";
import { FEATURED_MODES, MODES } from "@/lib/modes";
import { useApi } from "@/lib/use-api";
import { DailyChallengeCard } from "@/components/game/daily-challenge-card";
import { GameCard } from "@/components/game/game-card";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import { StatTile } from "@/components/game/stat-tile";

function HomeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading home">
      <div className="hero">
        <div className="stack">
          <Skeleton shape="text" width={40} />
          <Skeleton shape="block" />
          <Skeleton shape="text" width={80} />
          <Skeleton shape="btn" />
        </div>
        <Skeleton shape="block" />
      </div>
      <div className="summary-strip">
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
      </div>
      <div className="grid--3 block grid">
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
      </div>
    </div>
  );
}

function DailyBlock() {
  const daily = useApi("daily", (s) => api.getDaily(s));
  const played = daily.state.status === "success" && daily.state.data.played;
  // Rank only matters once today's challenge is played.
  const board = useApi(played ? "lb-day" : null, (s) => api.getLeaderboard("day", s));

  if (daily.state.status === "loading") return <Skeleton shape="block" />;
  if (daily.state.status === "error") {
    return <ErrorState compact title="Couldn't load the daily challenge" onRetry={daily.retry} />;
  }
  const rank = board.state.status === "success" ? board.state.data.me.rank : null;
  return <DailyChallengeCard status={daily.state.data} rank={rank} />;
}

function WeeklyBoard() {
  const { state, retry } = useApi("lb-week", (s) => api.getLeaderboard("week", s));
  if (state.status === "loading") {
    return (
      <div className="stack stack--sm" aria-busy="true" aria-label="Loading leaderboard">
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    );
  }
  if (state.status === "error")
    return <ErrorState compact title="Leaderboard unavailable" onRetry={retry} />;
  const rows = state.data.rows.slice(0, 5);
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon="trophy"
        title="No scores yet"
        description="Be the first name on this week's board."
      />
    );
  }
  return <LeaderboardTable variant="compact" rows={rows} label="Top players this week" />;
}

export function HomeView() {
  const { state, retry } = useMe();

  if (state.status === "loading") return <HomeLoading />;
  if (state.status === "error") {
    return (
      <ErrorState
        className="block"
        title="We couldn't load the court"
        description="Something went wrong reaching our servers. Your progress is safe."
        onRetry={retry}
      />
    );
  }
  const me = meData(state);
  if (!me) return null;

  if (me.gamesPlayed === 0) {
    return (
      <div className="hero">
        <div className="stack">
          <h1 className="hero__title" id="home-title">
            Welcome, <em>rookie.</em>
          </h1>
          <p className="hero__lead">
            No games played yet. Your first game takes about three minutes.
          </p>
          <div className="hero__cta">
            <Button href="/games/starting-five" size="lg" icon="play">
              Play your first game
            </Button>
          </div>
        </div>
        <EmptyState
          icon="trophy"
          title="The leaderboard is waiting"
          description="Finish a game to get your first points and a spot on the weekly board."
        />
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <div className="stack">
          <span className="t-label t-accent">6 games · 1 leaderboard</span>
          <h1 className="hero__title" id="home-title">
            Know the game?
            <br />
            <em>Prove it.</em>
          </h1>
          <p className="hero__lead">
            Quick-fire NBA trivia built on real rosters, box scores and career stats. Three minutes
            is all it takes.
          </p>
          <div className="hero__cta">
            <Button href="/games/starting-five" size="lg" icon="play">
              Play now
            </Button>
            <Button href="/games" variant="secondary" size="lg">
              All games
            </Button>
          </div>
        </div>
        <DailyBlock />
      </div>

      <div className="summary-strip">
        <StatTile label="Total points" value={fmtNumber(me.totalPoints)} countTo={me.totalPoints} />
        <StatTile label="Games played" value={fmtNumber(me.gamesPlayed)} countTo={me.gamesPlayed} />
        <StatTile label="Best streak" value={me.bestStreak} countTo={me.bestStreak} tone="accent" />
        <StatTile label="Accuracy" value={`${me.accuracy}%`} className="hide-mobile" />
      </div>

      <div className="block">
        <div className="block__head">
          <h2 className="block__title">Featured games</h2>
          <Button href="/games" variant="ghost" size="sm" iconEnd="chevron-right">
            See all
          </Button>
        </div>
        <div className="grid--3 grid">
          {FEATURED_MODES.map((m) => (
            <GameCard key={m} mode={MODES[m]} variant="featured" headingLevel="h3" />
          ))}
        </div>
      </div>

      <div className="split block">
        <div>
          <div className="block__head">
            <h2 className="block__title">Top players this week</h2>
            <Button href="/leaderboard" variant="ghost" size="sm" iconEnd="chevron-right">
              Full board
            </Button>
          </div>
          <WeeklyBoard />
        </div>
        <div>
          <div className="block__head">
            <h2 className="block__title">How scoring works</h2>
          </div>
          <Card className="stack">
            <div className="row row--nowrap">
              <Badge>100</Badge>
              <span className="t-sm">
                Base points for every correct answer, × difficulty (up to ×3 on Expert)
              </span>
            </div>
            <div className="row row--nowrap">
              <Badge variant="warning">+50</Badge>
              <span className="t-sm">
                Time bonus at most — the faster you answer, the more you keep
              </span>
            </div>
            <div className="row row--nowrap">
              <Badge variant="accent">+20</Badge>
              <span className="t-sm">Per streak step, up to +100. A miss resets it.</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
