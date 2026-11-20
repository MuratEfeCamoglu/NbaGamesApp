"use client";

import { useEffect, useState } from "react";
import type { Difficulty, Era, GameMode } from "@/games/core/types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api-client";
import type { StartSessionResponse } from "@/lib/api-types";
import { ERA_INFO, withEraParam } from "@/lib/era";
import { useT } from "@/lib/i18n/provider";
import { MODES } from "@/lib/modes";
import { useEraPreference } from "@/lib/use-era-preference";
import { DifficultySelector } from "./difficulty-selector";
import { EraBadge, EraSwitch } from "./era-switch";
import { GameCover } from "./game-cover";
import { LazyGamePlay, usePrefetchGamePlay } from "./lazy-game-play";

interface Run {
  key: number;
  era: Era;
  request: Promise<StartSessionResponse>;
}

interface GameFlowProps {
  mode: GameMode;
  /** `?era=` of the page URL; null → the era remembered by this browser (default Current). */
  initialEra?: Era | null;
}

/** /games/[mode]: (a) intro + era + difficulty → (b) play → (c) result (design #game phases). */
export function GameFlow({ mode, initialEra = null }: GameFlowProps) {
  const info = MODES[mode];
  const t = useT();
  usePrefetchGamePlay();
  const copy = t.modes[mode];
  const [rememberedEra, rememberEra] = useEraPreference();
  // An era from the URL or a click beats the remembered one.
  const [pickedEra, setPickedEra] = useState<Era | null>(initialEra);
  const era = pickedEra ?? rememberedEra;
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [run, setRun] = useState<Run | null>(null);

  // Keep the address bar on the era shown (shareable, survives reload). The native History API
  // updates the URL without a reload or a server round trip; Next keeps its router in sync.
  useEffect(() => {
    if (run) return;
    const search = withEraParam(window.location.search, era);
    if (search !== window.location.search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }, [era, run]);

  function changeEra(next: Era) {
    setPickedEra(next);
    rememberEra(next);
  }

  function start(playEra: Era) {
    rememberEra(playEra);
    // Request created here, not in the state updater: StrictMode runs updaters twice.
    const request = api.startSession({ mode, difficulty, era: playEra });
    setRun((prev) => ({ key: (prev?.key ?? 0) + 1, era: playEra, request }));
  }

  return (
    <div className="era-scope" data-era={run?.era ?? era}>
      <PageHeader
        titleId="game-title"
        title={<span lang="en">{info.title}</span>}
        back={
          <Button href="/games" variant="ghost" size="sm" icon="arrow-left">
            {t.common.allGames}
          </Button>
        }
        description={run ? <EraBadge era={run.era} /> : undefined}
      />

      {run ? (
        <LazyGamePlay
          key={run.key}
          request={run.request}
          onRestart={() => start(run.era)}
          emptyState={
            <EmptyState
              className="block"
              icon="search"
              title={t.flow.emptyTitle}
              description={t.flow.emptyEraDesc}
              actions={
                <>
                  <Button onClick={() => setRun(null)}>{t.flow.changeEraLevel}</Button>
                  <Button href="/games" variant="ghost">
                    {t.common.chooseAnotherGame}
                  </Button>
                </>
              }
            />
          }
          resultActions={
            <>
              <Button size="lg" icon="rotate" onClick={() => start(run.era)}>
                {t.flow.playAgain}
              </Button>
              <Button href="/games" variant="secondary" size="lg">
                {t.common.chooseAnotherGame}
              </Button>
            </>
          }
        />
      ) : (
        <div className="block">
          <div className="split">
            <Card className="stack">
              <div className="game-card__visual intro-cover" data-era={era}>
                <span className="game-card__orb" aria-hidden="true" />
                <GameCover mode={mode} era={era} size="intro" />
              </div>
              <div className="row">
                <Badge variant="accent">{t.flow.modeBadge(info.n)}</Badge>
                <Badge variant="outline">{copy.lengthLabel}</Badge>
              </div>
              <h2 className="t-display t-3xl" lang="en">
                {info.title}
              </h2>
              <p className="t-muted">{copy.introDesc}</p>
              <ul className="game-card__rules">
                <li>
                  <Icon name="check" size="sm" />
                  <span>{copy.introRule}</span>
                </li>
                <li data-era={era}>
                  <Icon name={ERA_INFO[era].icon} size="sm" />
                  <span>
                    <span className="sr-only">{t.era.srPrefix(t.era[era].label)}</span>
                    {copy.eraRule[era]}
                  </span>
                </li>
                <li>
                  <Icon name="clock" size="sm" />
                  {t.flow.timerRule}
                </li>
                <li>
                  <Icon name="flame" size="sm" />
                  {t.flow.streakRule}
                </li>
                <li>
                  <Icon name="zap" size="sm" />
                  {mode === "top-10" ? t.flow.keyboardTop10 : t.flow.keyboardChoices}
                </li>
              </ul>
            </Card>
            <Card className="stack">
              <EraSwitch value={era} onChange={changeEra} />
              <DifficultySelector mode={mode} value={difficulty} onChange={setDifficulty} />
              <Button block size="lg" icon="play" onClick={() => start(era)}>
                {t.flow.start}
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
