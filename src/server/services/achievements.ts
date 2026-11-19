import "server-only";
import { GAME_MODES, type AchievementView } from "@/games/core/types";
import { isUniqueViolation } from "../db";
import type { ServiceContext } from "../context";

/** Badge definitions live in code, not the DB (ISKELET §3.4). */
export const ACHIEVEMENTS = [
  { id: "first-game", name: "First Game", description: "Finish your first game." },
  {
    id: "perfect-10",
    name: "Perfect 10",
    description: "Answer every question of a game correctly.",
  },
  { id: "streak-5", name: "Streak 5", description: "Get 5 correct answers in a row." },
  { id: "streak-10", name: "Streak 10", description: "Get 10 correct answers in a row." },
  { id: "expert-win", name: "Expert Win", description: "Score at least 7/10 on Expert." },
  { id: "all-modes", name: "All Modes", description: "Finish a game in all 6 modes." },
  { id: "daily-3", name: "Daily 3", description: "Play the Daily Challenge 3 days in a row." },
  { id: "points-10k", name: "10K Points", description: "Reach 10,000 total points." },
] as const satisfies readonly AchievementView[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

const EXPERT_WIN_RATIO = 0.7;
const STREAK_SMALL = 5;
const STREAK_BIG = 10;
const DAILY_RUN = 3;
const POINTS_GOAL = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FinishedSessionFacts {
  isDaily: boolean;
  difficulty: string;
  correct: number;
  total: number;
  bestStreak: number;
  dailyDate: string | null;
}

function previousUtcDate(date: string, daysBack: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - daysBack * DAY_MS).toISOString().slice(0, 10);
}

/** Which badges the just-finished session qualifies the user for (before de-duplication). */
export async function qualifyingAchievements(
  ctx: ServiceContext,
  userId: string,
  session: FinishedSessionFacts,
): Promise<AchievementId[]> {
  const ids: AchievementId[] = ["first-game"];
  if (!session.isDaily && session.total > 0 && session.correct === session.total)
    ids.push("perfect-10");
  if (session.bestStreak >= STREAK_SMALL) ids.push("streak-5");
  if (session.bestStreak >= STREAK_BIG) ids.push("streak-10");
  if (
    !session.isDaily &&
    session.difficulty === "expert" &&
    session.total > 0 &&
    session.correct / session.total >= EXPERT_WIN_RATIO
  ) {
    ids.push("expert-win");
  }

  const modes = await ctx.db.gameSession.findMany({
    where: { userId, status: "FINISHED", isDaily: false },
    distinct: ["mode"],
    select: { mode: true },
  });
  if (GAME_MODES.every((m) => modes.some((s) => s.mode === m))) ids.push("all-modes");

  if (session.isDaily && session.dailyDate) {
    const days = Array.from({ length: DAILY_RUN }, (_, i) =>
      previousUtcDate(session.dailyDate as string, i),
    );
    const played = await ctx.db.gameSession.count({
      where: { userId, isDaily: true, status: "FINISHED", dailyDate: { in: days } },
    });
    if (played === DAILY_RUN) ids.push("daily-3");
  }

  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    select: { totalPoints: true },
  });
  if ((user?.totalPoints ?? 0) >= POINTS_GOAL) ids.push("points-10k");
  return ids;
}

/**
 * Awards new badges (each at most once per user, enforced by the DB key) and returns them.
 * `earnedAt` defaults to now; the game service passes the session's `finishedAt` so a replayed
 * answer can find exactly the badges that this session awarded.
 */
export async function awardAchievements(
  ctx: ServiceContext,
  userId: string,
  session: FinishedSessionFacts,
  earnedAt: Date = ctx.now(),
): Promise<AchievementView[]> {
  const candidates = await qualifyingAchievements(ctx, userId, session);
  const owned = await ctx.db.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const ownedIds = new Set(owned.map((a) => a.achievementId));
  const awarded: AchievementView[] = [];
  for (const def of ACHIEVEMENTS) {
    if (!candidates.includes(def.id) || ownedIds.has(def.id)) continue;
    try {
      await ctx.db.userAchievement.create({
        data: { userId, achievementId: def.id, earnedAt },
      });
      awarded.push({ id: def.id, name: def.name, description: def.description });
    } catch (err) {
      // A concurrent request already awarded it.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return awarded;
}

/** Badges stamped with exactly this time (the finishing moment of one session). */
export async function achievementsEarnedAt(
  ctx: ServiceContext,
  userId: string,
  earnedAt: Date,
): Promise<AchievementView[]> {
  const rows = await ctx.db.userAchievement.findMany({
    where: { userId, earnedAt },
    select: { achievementId: true },
  });
  const ids = new Set(rows.map((r) => r.achievementId));
  return ACHIEVEMENTS.filter((def) => ids.has(def.id)).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
