import type { ReactNode } from "react";
import { fmtNumber } from "@/lib/format";
import { QuestionProgress } from "./question-progress";
import { StreakMeter } from "./streak-meter";

interface GameHudProps {
  index: number;
  total: number;
  results: ("correct" | "wrong")[];
  streak: number;
  score: number;
  /** TimerBar slot (keyed per question by the parent). */
  timer: ReactNode;
}

export function GameHud({ index, total, results, streak, score, timer }: GameHudProps) {
  return (
    <div className="game-hud" data-component="GameHud">
      <div className="game-hud__top">
        <QuestionProgress index={index} total={total} results={results} />
        <StreakMeter streak={streak} />
        <div className="game-hud__score">
          <span className="t-label">Score</span>
          <span className="game-hud__score-value" aria-live="polite">
            {fmtNumber(score)}
          </span>
        </div>
      </div>
      {timer}
    </div>
  );
}
