// Oyun modu kayıt defteri. Yeni mod = engine dosyası + buraya bir satır (CLAUDE.md).
import { engine as boxScore } from "../box-score/engine";
import { engine as careerStats } from "../career-stats/engine";
import { engine as startingFive } from "../starting-five/engine";
import { engine as teamJourney } from "../team-journey/engine";
import { engine as teammateChallenge } from "../teammate-challenge/engine";
import { engine as top10 } from "../top-10/engine";
import { GAME_MODES, type GameEngine, type GameMode } from "./types";

export const ENGINES: Record<GameMode, GameEngine> = {
  "starting-five": startingFive,
  "team-journey": teamJourney,
  "teammate-challenge": teammateChallenge,
  "career-stats": careerStats,
  "box-score": boxScore,
  "top-10": top10,
};

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && (GAME_MODES as readonly string[]).includes(value);
}

export function getEngine(mode: GameMode): GameEngine {
  return ENGINES[mode];
}

/** Modes used by the Daily Challenge (top-10 excluded: different timing model). */
export const DAILY_MODES: readonly GameMode[] = GAME_MODES.filter((m) => m !== "top-10");
