import "server-only";
import type { DailyStatusDTO, StartSessionResponse } from "@/lib/api-types";
import { DAILY_LENGTH } from "@/games/core/difficulty";
import { DAILY_MODES, getEngine } from "@/games/core/registry";
import { createRng, dailySeed } from "@/games/core/rng";
import type { Difficulty, GeneratedQuestion } from "@/games/core/types";
import type { ServiceContext } from "../context";
import { isUniqueViolation } from "../db";
import { AppError } from "../errors";
import { createSessionWithQuestions, DAILY_MODE, resumeSession, toSummary } from "./game-service";

const DAILY_DIFFICULTY: Difficulty = "medium";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily boundaries are UTC (ISKELET V7). */
export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function nextUtcMidnight(date: Date): Date {
  return new Date(Date.parse(`${utcDate(date)}T00:00:00Z`) + DAY_MS);
}

/**
 * The day's questions depend only on the date: one RNG seeded from it drives the mode order and
 * every engine call, with a shared exclude set, so every user gets identical questions.
 */
export function generateDailyQuestions(ctx: ServiceContext, date: string): GeneratedQuestion[] {
  const rng = createRng(dailySeed(date));
  const exclude = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (const mode of rng.shuffle(DAILY_MODES).slice(0, DAILY_LENGTH)) {
    const q = getEngine(mode).generateQuestion(ctx.ds, DAILY_DIFFICULTY, rng, exclude);
    if (!q) continue;
    exclude.add(q.key);
    out.push(q);
  }
  return out;
}

/** GET /api/daily */
export async function getDailyStatus(
  ctx: ServiceContext,
  userId: string | null,
): Promise<DailyStatusDTO> {
  const now = ctx.now();
  const date = utcDate(now);
  const session = userId
    ? await ctx.db.gameSession.findUnique({
        where: { userId_dailyDate: { userId, dailyDate: date } },
      })
    : null;
  const played = session?.status === "FINISHED";
  return {
    date,
    played,
    result: played && session ? toSummary(session) : null,
    nextResetAt: nextUtcMidnight(now).toISOString(),
  };
}

/** POST /api/daily/sessions: one attempt per user per UTC day; an unfinished one is resumed. */
export async function startDaily(
  ctx: ServiceContext,
  userId: string,
): Promise<StartSessionResponse> {
  const date = utcDate(ctx.now());
  const existing = await ctx.db.gameSession.findUnique({
    where: { userId_dailyDate: { userId, dailyDate: date } },
  });
  if (existing) {
    if (existing.status === "FINISHED") throw new AppError("CONFLICT", "Already played today.");
    return resumeSession(ctx, existing);
  }
  try {
    return await createSessionWithQuestions(ctx, {
      userId,
      mode: DAILY_MODE,
      difficulty: DAILY_DIFFICULTY,
      seed: dailySeed(date),
      dailyDate: date,
      questions: generateDailyQuestions(ctx, date),
    });
  } catch (err) {
    // Two tabs started at once: the unique (userId, dailyDate) key let only one through.
    if (!isUniqueViolation(err)) throw err;
    const winner = await ctx.db.gameSession.findUniqueOrThrow({
      where: { userId_dailyDate: { userId, dailyDate: date } },
    });
    if (winner.status === "FINISHED") throw new AppError("CONFLICT", "Already played today.");
    return resumeSession(ctx, winner);
  }
}
