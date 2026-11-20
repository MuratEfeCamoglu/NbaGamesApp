"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { gameHref } from "@/lib/era";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { meData, useMe } from "@/lib/me-context";
import { FEATURED_MODES, MODES } from "@/lib/modes";
import { useApi } from "@/lib/use-api";
import { useEraPreference } from "@/lib/use-era-preference";
import { DailyChallengeCard } from "@/components/game/daily-challenge-card";
import { EraSwitch } from "@/components/game/era-switch";
import { GameCard } from "@/components/game/game-card";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import { StatTile } from "@/components/game/stat-tile";

function HomeLoading() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-label={t.home.loading}>
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
  const { t } = useI18n();
  const daily = useApi("daily", (s) => api.getDaily(s));
  const played = daily.state.status === "success" && daily.state.data.played;
  // Rank only matters once today's challenge is played.
  const board = useApi(played ? "lb-day" : null, (s) => api.getLeaderboard("day", s));

  if (daily.state.status === "loading") return <Skeleton shape="block" />;
  if (daily.state.status === "error") {
    return <ErrorState compact title={t.home.dailyError} onRetry={daily.retry} />;
  }
  const rank = board.state.status === "success" ? board.state.data.me.rank : null;
  return <DailyChallengeCard status={daily.state.data} rank={rank} />;
}

function WeeklyBoard() {
  const { t } = useI18n();
  const { state, retry } = useApi("lb-week", (s) => api.getLeaderboard("week", s));
  if (state.status === "loading") {
    return (
      <div className="stack stack--sm" aria-busy="true" aria-label={t.common.loadingLeaderboard}>
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    );
  }
  if (state.status === "error")
    return <ErrorState compact title={t.common.leaderboardUnavailable} onRetry={retry} />;
  const rows = state.data.rows.slice(0, 5);
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon="trophy"
        title={t.common.noScoresYet}
        description={t.home.weekEmptyDesc}
      />
    );
  }
  return <LeaderboardTable variant="compact" rows={rows} label={t.home.topThisWeek} />;
}

export function HomeView() {
  const { t, locale } = useI18n();
  const { state, retry } = useMe();
  const [era, setEra] = useEraPreference();

  if (state.status === "loading") return <HomeLoading />;
  if (state.status === "error") {
    return (
      <ErrorState
        className="block"
        title={t.home.errorTitle}
        description={t.home.errorDesc}
        onRetry={retry}
      />
    );
  }
  const me = meData(state);
  if (!me) return null;

  // The hero's era switch makes Current / Retired the two sides of the site (F16).
  const eraSwitch = <EraSwitch legend={t.era.pick} value={era} onChange={setEra} />;

  if (me.gamesPlayed === 0) {
    return (
      <div className="era-scope era-scope--page" data-era={era}>
        <div className="hero">
          <div className="stack">
            <h1 className="hero__title" id="home-title">
              {t.home.welcome} <em>{t.home.rookie}</em>
            </h1>
            <p className="hero__lead">{t.home.firstLead}</p>
            {eraSwitch}
            <div className="hero__cta">
              <Button href={gameHref("starting-five", era)} size="lg" icon="play">
                {t.common.playYourFirstGame}
              </Button>
            </div>
          </div>
          <EmptyState icon="trophy" title={t.home.waitingTitle} description={t.home.waitingDesc} />
        </div>
      </div>
    );
  }

  return (
    <div className="era-scope era-scope--page" data-era={era}>
      <div className="hero">
        <div className="stack">
          <span className="t-label t-accent">{t.home.kicker}</span>
          <h1 className="hero__title" id="home-title">
            {t.home.heroTitle}
            <br />
            <em>{t.home.heroTitleEm}</em>
          </h1>
          <p className="hero__lead">{t.home.heroLead}</p>
          {eraSwitch}
          <div className="hero__cta">
            <Button href={gameHref("starting-five", era)} size="lg" icon="play">
              {t.common.playNow}
            </Button>
            <Button href="/games" variant="secondary" size="lg">
              {t.common.allGames}
            </Button>
          </div>
        </div>
        <DailyBlock />
      </div>

      <div className="summary-strip">
        <StatTile
          label={t.common.totalPoints}
          value={fmtNumber(me.totalPoints, locale)}
          countTo={me.totalPoints}
        />
        <StatTile
          label={t.common.gamesPlayed}
          value={fmtNumber(me.gamesPlayed, locale)}
          countTo={me.gamesPlayed}
        />
        <StatTile
          label={t.common.bestStreak}
          value={me.bestStreak}
          countTo={me.bestStreak}
          tone="accent"
        />
        <StatTile
          label={t.common.accuracy}
          value={fmtPercent(me.accuracy, locale)}
          className="hide-mobile"
        />
      </div>

      <div className="block">
        <div className="block__head">
          <h2 className="block__title">{t.home.featured}</h2>
          <Button href="/games" variant="ghost" size="sm" iconEnd="chevron-right">
            {t.home.seeAll}
          </Button>
        </div>
        <div className="grid--3 grid">
          {FEATURED_MODES.map((m) => (
            <GameCard key={m} mode={MODES[m]} variant="featured" headingLevel="h3" era={era} />
          ))}
        </div>
      </div>

      <div className="split block">
        <div>
          <div className="block__head">
            <h2 className="block__title">{t.home.topThisWeek}</h2>
            <Button href="/leaderboard" variant="ghost" size="sm" iconEnd="chevron-right">
              {t.home.fullBoard}
            </Button>
          </div>
          <WeeklyBoard />
        </div>
        <div>
          <div className="block__head">
            <h2 className="block__title">{t.home.scoringTitle}</h2>
          </div>
          <Card className="stack">
            <div className="row row--nowrap">
              <Badge>100</Badge>
              <span className="t-sm">{t.home.scoringBase}</span>
            </div>
            <div className="row row--nowrap">
              <Badge variant="warning">+50</Badge>
              <span className="t-sm">{t.home.scoringTime}</span>
            </div>
            <div className="row row--nowrap">
              <Badge variant="accent">+20</Badge>
              <span className="t-sm">{t.home.scoringStreak}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
