// Puanlama formülü (ISKELET §2.1) — saf fonksiyon.
import { DIFFICULTY_RULES } from "./difficulty";
import type { Difficulty } from "./types";

export const BASE_POINTS = 100;
export const MAX_TIME_BONUS = 50;
export const STREAK_STEP = 20;
export const STREAK_MAX_STEPS = 5;

export interface ScoreInput {
  correct: boolean;
  difficulty: Difficulty;
  remainingSec: number;
  limitSec: number;
  /** Streak before this answer. */
  streakBefore: number;
}

export interface ScoreResult {
  points: number;
  /** Streak after this answer (0 on wrong/timeout). */
  streak: number;
}

export function scoreAnswer(input: ScoreInput): ScoreResult {
  if (!input.correct) return { points: 0, streak: 0 };
  const streak = input.streakBefore + 1;
  const remaining = Math.min(Math.max(input.remainingSec, 0), input.limitSec);
  const timeBonus = input.limitSec > 0 ? Math.floor((MAX_TIME_BONUS * remaining) / input.limitSec) : 0;
  const streakBonus = streak >= 2 ? STREAK_STEP * Math.min(streak - 1, STREAK_MAX_STEPS) : 0;
  const multiplier = DIFFICULTY_RULES[input.difficulty].multiplier;
  return { points: Math.round((BASE_POINTS + timeBonus) * multiplier) + streakBonus, streak };
}
