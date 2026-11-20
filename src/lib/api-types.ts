// API yanıt/istek tipleri — Route Handler'lar (Backend) ve istemci (Frontend) arasındaki sözleşme.
// Değişiklik = Architect + Orchestrator onayı (AGENT.md §2).
import type {
  AnswerResult,
  Difficulty,
  Era,
  EraFilter,
  GameMode,
  PublicQuestion,
  SessionSummary,
  SubmittedAnswer,
} from "@/games/core/types";

export type ApiErrorCode =
  "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "EXPIRED" | "RATE_LIMITED" | "INTERNAL";

export interface ApiErrorDTO {
  error: { code: ApiErrorCode; message: string };
}

export interface AchievementStatusDTO {
  id: string;
  name: string;
  description: string;
  earnedAt: string | null; // ISO; null = locked
}

/** GET /api/me (creates guest cookie if missing) */
export interface MeDTO {
  id: string;
  nickname: string | null;
  totalPoints: number;
  bestStreak: number;
  gamesPlayed: number; // finished sessions
  accuracy: number; // 0–100, integer; 0 when no answers
  achievements: AchievementStatusDTO[]; // all 8, locked ones with earnedAt null
}

/** PATCH /api/me */
export interface UpdateNicknameRequest {
  nickname: string;
}

/** GET /api/me/history */
export interface HistoryItemDTO {
  sessionId: string;
  mode: GameMode | "daily";
  difficulty: Difficulty;
  era: EraFilter;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  finishedAt: string; // ISO
}
export interface HistoryDTO {
  items: HistoryItemDTO[]; // newest first, max 20
}

/** POST /api/games/sessions */
export interface StartSessionRequest {
  mode: GameMode;
  difficulty: Difficulty;
  /** Omitted → "all" (no era filter; legacy behaviour). The UI always sends one. */
  era?: Era;
}
/** Also returned by POST /api/daily/sessions (mode "daily", difficulty "medium", era "all"). */
export interface StartSessionResponse {
  sessionId: string;
  mode: GameMode | "daily";
  difficulty: Difficulty;
  era: EraFilter;
  total: number;
  question: PublicQuestion;
}

/** POST /api/games/sessions/[id]/answer */
export interface AnswerRequest {
  questionIndex: number;
  answer: SubmittedAnswer;
}
export type AnswerResponse = AnswerResult;

/** GET /api/daily */
export interface DailyStatusDTO {
  date: string; // UTC YYYY-MM-DD
  played: boolean;
  result: SessionSummary | null;
  nextResetAt: string; // ISO, next 00:00 UTC
}

/** GET /api/players/search?q= */
export interface PlayerSearchResultDTO {
  id: string;
  name: string;
  position: string;
  teamId: string | null;
  headshotId: string | null;
}
export interface PlayerSearchDTO {
  results: PlayerSearchResultDTO[]; // max 10
}

export type LeaderboardPeriod = "all" | "week" | "day";

/** GET /api/leaderboard?period= */
export interface LeaderboardDTO {
  period: LeaderboardPeriod;
  rows: { rank: number; nickname: string; points: number; isMe: boolean }[]; // max 100
  me: { rank: number | null; points: number; nickname: string | null };
}
