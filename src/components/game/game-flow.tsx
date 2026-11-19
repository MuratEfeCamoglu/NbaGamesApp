"use client";

import { useState } from "react";
import type { Difficulty, GameMode } from "@/games/core/types";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api-client";
import type { StartSessionResponse } from "@/lib/api-types";
import { MODES } from "@/lib/modes";
import { DifficultySelector } from "./difficulty-selector";
import { GamePlay } from "./game-play";

interface Run {
  key: number;
  request: Promise<StartSessionResponse>;
}

/** /games/[mode]: (a) intro + difficulty → (b) play → (c) result (design #game phases). */
export function GameFlow({ mode }: { mode: GameMode }) {
  const info = MODES[mode];
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [run, setRun] = useState<Run | null>(null);

  function start() {
    setRun((prev) => ({
      key: (prev?.key ?? 0) + 1,
      request: api.startSession({ mode, difficulty }),
    }));
  }

  return (
    <>
      <PageHeader
        titleId="game-title"
        title={info.title}
        back={
          <Button href="/games" variant="ghost" size="sm" icon="arrow-left">
            All games
          </Button>
        }
      />

      {run ? (
        <GamePlay
          key={run.key}
          request={run.request}
          onRestart={start}
          resultActions={
            <>
              <Button size="lg" icon="rotate" onClick={start}>
                Play again
              </Button>
              <Button href="/games" variant="secondary" size="lg">
                Choose another game
              </Button>
            </>
          }
        />
      ) : (
        <div className="block">
          <div className="split">
            <Card className="stack">
              <div className="row">
                <Badge variant="accent">Mode {info.n}</Badge>
                <Badge variant="outline">{info.lengthLabel}</Badge>
              </div>
              <h2 className="t-display t-3xl">{info.title}</h2>
              <p className="t-muted">{info.introDesc}</p>
              <ul className="game-card__rules">
                <li>
                  <Icon name="check" size="sm" />
                  <span>{info.introRule}</span>
                </li>
                <li>
                  <Icon name="clock" size="sm" />
                  Answer before the timer runs out. Faster = more points.
                </li>
                <li>
                  <Icon name="flame" size="sm" />
                  Consecutive correct answers build a streak bonus.
                </li>
                <li>
                  <Icon name="zap" size="sm" />
                  {mode === "top-10"
                    ? "Keyboard: type a name, ↑↓ to move, Enter to pick."
                    : "Keyboard: 1–6 picks an option, Enter confirms."}
                </li>
              </ul>
            </Card>
            <Card className="stack">
              <DifficultySelector mode={mode} value={difficulty} onChange={setDifficulty} />
              <Button block size="lg" icon="play" onClick={start}>
                Start
              </Button>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
