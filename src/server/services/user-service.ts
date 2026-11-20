import "server-only";
import type { HistoryDTO, MeDTO } from "@/lib/api-types";
import type { Difficulty, GameMode } from "@/games/core/types";
import type { ServiceContext } from "../context";
import { isUniqueViolation } from "../db";
import { AppError } from "../errors";
import { ACHIEVEMENTS } from "./achievements";
import { eraOf } from "./game-service";
import { isNicknameBlocked } from "./nickname-blocklist";

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;
const NICKNAME_PATTERN = /^[A-Za-z0-9_]+$/;
export const HISTORY_SIZE = 20;
const PERCENT = 100;

/** GET /api/me */
export async function getMe(ctx: ServiceContext, userId: string): Promise<MeDTO> {
  const user = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found.");
  const [gamesPlayed, answered, earned] = await Promise.all([
    ctx.db.gameSession.count({ where: { userId, status: "FINISHED" } }),
    ctx.db.question.aggregate({
      where: { session: { userId }, answeredAt: { not: null } },
      _sum: { units: true, correctUnits: true },
    }),
    ctx.db.userAchievement.findMany({ where: { userId } }),
  ]);
  const units = answered._sum.units ?? 0;
  const correct = answered._sum.correctUnits ?? 0;
  const earnedAt = new Map(earned.map((a) => [a.achievementId, a.earnedAt.toISOString()]));
  return {
    id: user.id,
    nickname: user.nickname,
    totalPoints: user.totalPoints,
    bestStreak: user.bestStreak,
    gamesPlayed,
    accuracy: units > 0 ? Math.round((PERCENT * correct) / units) : 0,
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      earnedAt: earnedAt.get(a.id) ?? null,
    })),
  };
}

/** Returns an error message, or null when the nickname is acceptable. */
export function validateNickname(nickname: string): string | null {
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return `Nickname must be ${NICKNAME_MIN}–${NICKNAME_MAX} characters.`;
  }
  if (!NICKNAME_PATTERN.test(nickname)) return "Use only letters, numbers and underscores.";
  if (isNicknameBlocked(nickname)) return "This nickname is not allowed.";
  return null;
}

/** PATCH /api/me */
export async function updateNickname(
  ctx: ServiceContext,
  userId: string,
  raw: string,
): Promise<MeDTO> {
  const nickname = raw.trim();
  const problem = validateNickname(nickname);
  if (problem) throw new AppError("VALIDATION", problem);
  const nicknameKey = nickname.toLowerCase();
  const taken = await ctx.db.user.findUnique({ where: { nicknameKey }, select: { id: true } });
  if (taken && taken.id !== userId)
    throw new AppError("CONFLICT", "This nickname is already taken.");
  try {
    await ctx.db.user.update({ where: { id: userId }, data: { nickname, nicknameKey } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "This nickname is already taken.");
    throw err;
  }
  return getMe(ctx, userId);
}

/** GET /api/me/history: finished sessions, newest first. */
export async function getHistory(ctx: ServiceContext, userId: string): Promise<HistoryDTO> {
  const sessions = await ctx.db.gameSession.findMany({
    where: { userId, status: "FINISHED" },
    orderBy: { finishedAt: "desc" },
    take: HISTORY_SIZE,
  });
  return {
    items: sessions.map((s) => ({
      sessionId: s.id,
      mode: s.mode as GameMode | "daily",
      difficulty: s.difficulty as Difficulty,
      era: eraOf(s),
      score: s.score,
      correct: s.correctCount,
      total: s.total,
      bestStreak: s.bestStreak,
      finishedAt: (s.finishedAt ?? s.createdAt).toISOString(),
    })),
  };
}
