// Zorluk ve oturum sabitleri (ISKELET §2.1, §2.2). Magic number'lar yalnız burada.
import type { Difficulty } from "./types";

export interface DifficultyRule {
  timeLimitSec: number;
  /** Answer input for single-answer modes. */
  input: "choices" | "search";
  /** Number of buttons when input === "choices". */
  optionCount: number | null;
  /** Player pool: fameTier <= maxFameTier. */
  maxFameTier: 1 | 2 | 3;
  multiplier: number;
  /** Expert hides mode-specific hints. */
  reducedHints: boolean;
}

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRule> = {
  easy: { timeLimitSec: 30, input: "choices", optionCount: 4, maxFameTier: 1, multiplier: 1.0, reducedHints: false },
  medium: { timeLimitSec: 25, input: "choices", optionCount: 6, maxFameTier: 2, multiplier: 1.5, reducedHints: false },
  hard: { timeLimitSec: 20, input: "search", optionCount: null, maxFameTier: 3, multiplier: 2.0, reducedHints: false },
  expert: { timeLimitSec: 20, input: "search", optionCount: null, maxFameTier: 3, multiplier: 3.0, reducedHints: true },
};

export const SESSION_LENGTH = 10;
export const DAILY_LENGTH = 5;
/** Extra seconds accepted after the limit before an answer counts as a timeout. */
export const ANSWER_GRACE_SEC = 2;
/** How long the correct answer is shown before the next question (client). */
export const REVEAL_MS = 1500;
/** Client "3-2-1" countdown before the first question is shown. */
export const START_COUNTDOWN_MS = 2100;
/** Client slide-out animation after the reveal, before the next question appears. */
export const QUESTION_TRANSITION_MS = 240;
/**
 * The server stamps `issuedAt` this far in the future so the timer starts when the
 * question is actually visible (first question: countdown; later: reveal + slide).
 */
export const FIRST_QUESTION_DELAY_MS = START_COUNTDOWN_MS;
export const NEXT_QUESTION_DELAY_MS = REVEAL_MS + QUESTION_TRANSITION_MS;
/** Sessions idle longer than this are expired. */
export const SESSION_IDLE_MINUTES = 30;

export const TOP10_LISTS_PER_SESSION = 3;
export const TOP10_TIME_LIMIT_SEC = 60;
export const TOP10_HIDDEN_ROWS: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4, expert: 5 };

export const TEAMMATES_SHOWN: Record<Difficulty, number> = { easy: 5, medium: 5, hard: 3, expert: 2 };

/**
 * Era "current" Starting Five uses only lineups from the latest N seasons present in the data
 * (today's teams); era "retired" uses the older ones (classic teams). ISKELET F16.
 */
export const CURRENT_ERA_LINEUP_SEASONS = 3;
