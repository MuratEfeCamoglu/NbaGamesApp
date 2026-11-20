// Oyun çekirdeği tipleri — motorlar, servisler, API ve UI arasındaki sözleşme.
// Bu dosya istemci tarafından da import edilir (yalnız tipler); sunucuya özel bir şey içermez.
import type { NbaDataSource } from "@/data/source";

export const GAME_MODES = [
  "starting-five",
  "team-journey",
  "teammate-challenge",
  "career-stats",
  "box-score",
  "top-10",
] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Era split (ISKELET F16): "current" = active players & today's teams,
 * "retired" = retired players & classic teams. The answer player's status always matches the era.
 */
export const ERAS = ["current", "retired"] as const;
export type Era = (typeof ERAS)[number];
/** "all" = no era filter (Daily Challenge, legacy sessions). */
export type EraFilter = Era | "all";

/** How the client collects the answer. */
export type AnswerInput = "choices" | "search" | "top10";

/** Minimal player info safe to show to the client. */
export interface PlayerRef {
  id: string;
  name: string;
  position: string;
  /** Team used for avatar fallback colour (lowercase via CSS token). */
  teamId: string | null;
  headshotId: string | null;
}

/** A choice button (Easy/Medium). `id` is always a playerId. */
export interface AnswerOptionView {
  id: string;
  label: string;
}

export interface BoxScoreStatLine {
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
}

/**
 * Mode-specific content shown in QuestionCard. Fields that Expert hides are `null`
 * (ISKELET §2.2 per-mode "ipucu azaltma" rule) — the engine nulls them, the UI never decides.
 */
export type QuestionContent =
  | {
      mode: "starting-five";
      teamId: string;
      teamName: string;
      season: string | null; // null at Expert
      players: PlayerRef[]; // the 4 shown starters
      missingPosition: string;
    }
  | {
      mode: "team-journey";
      stints: { teamId: string; years: string | null }[]; // years null at Expert, e.g. "2003–11"
      seasons: number | null;
      allStarCount: number | null;
    }
  | {
      mode: "teammate-challenge";
      teammates: { player: PlayerRef; teamId: string; season: string | null }[];
    }
  | {
      mode: "career-stats";
      stats: {
        ppg: number;
        rpg: number;
        apg: number;
        spg: number;
        bpg: number;
        fgPct: number;
        games: number;
        seasons: number | null; // null at Expert
        position: string | null; // null at Expert
      };
    }
  | {
      mode: "box-score";
      line: BoxScoreStatLine;
      /** null at Expert (date + teams + score hidden). */
      game: {
        date: string; // YYYY-MM-DD
        teamId: string;
        opponentId: string;
        teamScore: number;
        opponentScore: number;
      } | null;
    }
  | {
      mode: "top-10";
      title: string;
      statLabel: string;
      listIndex: number; // 1-based
      listTotal: number;
      /** player === null → hidden row the user must fill. */
      rows: { rank: number; value: number; player: PlayerRef | null }[];
    };

/** Server-only answer key. Never sent to the client before the answer. */
export type AnswerKey =
  | { kind: "player"; playerId: string }
  | { kind: "slots"; slots: Record<string, string> }; // rank → playerId (hidden rows only)

/** What a mode engine produces. */
export interface GeneratedQuestion {
  /** Stable identity used to avoid repeats within a session (e.g. "sf:GSW:2015-16:203110"). */
  key: string;
  mode: GameMode;
  difficulty: Difficulty;
  timeLimitSec: number;
  input: AnswerInput;
  options: AnswerOptionView[] | null; // only for input === "choices"
  content: QuestionContent;
  answerKey: AnswerKey;
}

/** What the client receives. */
export interface PublicQuestion {
  index: number; // 0-based
  total: number;
  mode: GameMode;
  difficulty: Difficulty;
  timeLimitSec: number;
  input: AnswerInput;
  options: AnswerOptionView[] | null;
  content: QuestionContent;
  issuedAt: string; // ISO
}

/** Client → server answer payload. */
export type SubmittedAnswer =
  | { playerId: string }
  | { slots: Record<string, string> } // rank → playerId
  | { timeout: true };

/** Revealed after answering. */
export type CorrectAnswerView =
  | { kind: "player"; player: PlayerRef }
  | { kind: "slots"; rows: { rank: number; player: PlayerRef; correct: boolean }[] };

export interface AnswerResult {
  correct: boolean;
  /** For top-10: number of correctly filled slots / hidden slots. */
  correctUnits: number;
  totalUnits: number;
  correctAnswer: CorrectAnswerView;
  points: number;
  streak: number;
  totalScore: number;
  next: PublicQuestion | null;
  summary: SessionSummary | null;
  newAchievements: AchievementView[];
}

export interface SessionSummary {
  sessionId: string;
  mode: GameMode | "daily";
  difficulty: Difficulty;
  era: EraFilter;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
}

export interface AchievementView {
  id: string;
  name: string;
  description: string;
}

/** Deterministic RNG (see rng.ts). */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export interface GameEngine {
  mode: GameMode;
  /** Number of questions in a normal session (top-10: 3 lists). */
  questionsPerSession: number;
  /**
   * Produce one question. Must be pure: same (ds, difficulty, rng state, exclude, era) → same output.
   * Returns null when no eligible question remains.
   * `era` (default "all") restricts the ANSWER to players of that era (and, for team-centric
   * modes, the team-seasons used) — see ISKELET F16. Uniqueness checks still run against all players.
   */
  generateQuestion(
    ds: NbaDataSource,
    difficulty: Difficulty,
    rng: Rng,
    exclude: ReadonlySet<string>,
    era?: EraFilter,
  ): GeneratedQuestion | null;
}
