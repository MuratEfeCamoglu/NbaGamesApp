import "server-only";
import type { LeaderboardDTO, LeaderboardPeriod } from "@/lib/api-types";
import type { ServiceContext } from "../context";
import { utcDate } from "./daily-service";

export const LEADERBOARD_SIZE = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface Entry {
  id: string;
  nickname: string;
  points: number;
}

/**
 * One period's queries. Every query is ordered and limited in the database: the server never
 * loads more than LEADERBOARD_SIZE rows, whatever the number of users.
 */
interface PeriodSource {
  /** Named users with points > 0, best first; ties: older account first (stable order). */
  top(): Promise<Entry[]>;
  /** The caller's points for the period (also for users without a nickname). */
  pointsOf(userId: string): Promise<number>;
  /** Named users with strictly more points than `points`. */
  countAbove(points: number): Promise<number>;
}

function allTime(ctx: ServiceContext): PeriodSource {
  const named = { nickname: { not: null } };
  return {
    top: async () =>
      (
        await ctx.db.user.findMany({
          where: { ...named, totalPoints: { gt: 0 } },
          orderBy: [{ totalPoints: "desc" }, { createdAt: "asc" }],
          take: LEADERBOARD_SIZE,
          select: { id: true, nickname: true, totalPoints: true },
        })
      ).map((u) => ({ id: u.id, nickname: u.nickname ?? "", points: u.totalPoints })),
    pointsOf: async (userId) =>
      (await ctx.db.user.findUnique({ where: { id: userId }, select: { totalPoints: true } }))
        ?.totalPoints ?? 0,
    countAbove: (points) => ctx.db.user.count({ where: { ...named, totalPoints: { gt: points } } }),
  };
}

function today(ctx: ServiceContext): PeriodSource {
  const dailyDate = utcDate(ctx.now());
  const named = { user: { nickname: { not: null } } };
  return {
    top: async () =>
      (
        await ctx.db.gameSession.findMany({
          where: { isDaily: true, dailyDate, score: { gt: 0 }, ...named },
          orderBy: [{ score: "desc" }, { user: { createdAt: "asc" } }],
          take: LEADERBOARD_SIZE,
          select: { score: true, user: { select: { id: true, nickname: true } } },
        })
      ).map((s) => ({ id: s.user.id, nickname: s.user.nickname ?? "", points: s.score })),
    pointsOf: async (userId) =>
      (
        await ctx.db.gameSession.findUnique({
          where: { userId_dailyDate: { userId, dailyDate } },
          select: { score: true },
        })
      )?.score ?? 0,
    countAbove: (points) =>
      ctx.db.gameSession.count({
        where: { isDaily: true, dailyDate, score: { gt: points }, ...named },
      }),
  };
}

/**
 * ISKELET V8: points of answers given in the last 7×24 h, unfinished sessions included (V9).
 * Prisma's groupBy can't join through GameSession to the user, so the aggregate is raw SQL.
 */
function lastWeek(ctx: ServiceContext): PeriodSource {
  const since = new Date(ctx.now().getTime() - WEEK_MS);
  return {
    top: async () => {
      const rows = await ctx.db.$queryRaw<
        { id: string; nickname: string; points: number | bigint }[]
      >`
        SELECT u."id" AS id, u."nickname" AS nickname, SUM(q."points") AS points
        FROM "Question" q
        JOIN "GameSession" s ON s."id" = q."sessionId"
        JOIN "User" u ON u."id" = s."userId"
        WHERE q."answeredAt" >= ${since} AND q."points" > 0 AND u."nickname" IS NOT NULL
        GROUP BY u."id", u."nickname", u."createdAt"
        ORDER BY points DESC, u."createdAt" ASC
        LIMIT ${LEADERBOARD_SIZE}`;
      return rows.map((r) => ({ id: r.id, nickname: r.nickname, points: Number(r.points) }));
    },
    pointsOf: async (userId) =>
      (
        await ctx.db.question.aggregate({
          where: { answeredAt: { gte: since }, points: { gt: 0 }, session: { userId } },
          _sum: { points: true },
        })
      )._sum.points ?? 0,
    countAbove: async (points) => {
      const [row] = await ctx.db.$queryRaw<{ n: number | bigint }[]>`
        SELECT COUNT(*) AS n FROM (
          SELECT s."userId"
          FROM "Question" q
          JOIN "GameSession" s ON s."id" = q."sessionId"
          JOIN "User" u ON u."id" = s."userId"
          WHERE q."answeredAt" >= ${since} AND q."points" > 0 AND u."nickname" IS NOT NULL
          GROUP BY s."userId"
          HAVING SUM(q."points") > ${points}
        )`;
      return Number(row?.n ?? 0);
    },
  };
}

function sourceFor(ctx: ServiceContext, period: LeaderboardPeriod): PeriodSource {
  if (period === "all") return allTime(ctx);
  if (period === "day") return today(ctx);
  return lastWeek(ctx);
}

/** GET /api/leaderboard. Users without a nickname are never listed (F10). */
export async function getLeaderboard(
  ctx: ServiceContext,
  period: LeaderboardPeriod,
  meId: string | null,
): Promise<LeaderboardDTO> {
  const source = sourceFor(ctx, period);
  const top = await source.top();

  // Ties share a rank (1, 1, 3): the list is a sorted prefix, so position + 1 is exactly
  // "1 + number of users with more points" for the first row of each tie group.
  let prevPoints: number | null = null;
  let prevRank = 0;
  const rows = top.map((r, i) => {
    const rank = r.points === prevPoints ? prevRank : i + 1;
    prevPoints = r.points;
    prevRank = rank;
    return { rank, nickname: r.nickname, points: r.points, isMe: r.id === meId };
  });

  let me: LeaderboardDTO["me"] = { rank: null, points: 0, nickname: null };
  if (meId) {
    const user = await ctx.db.user.findUnique({ where: { id: meId }, select: { nickname: true } });
    const points = await source.pointsOf(meId);
    const listed = user?.nickname != null && points > 0;
    const rank = listed ? 1 + (await source.countAbove(points)) : null;
    me = { rank, points, nickname: user?.nickname ?? null };
  }
  return { period, rows, me };
}
