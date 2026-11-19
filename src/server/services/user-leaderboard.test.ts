import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../errors";
import {
  answerKeyOf,
  correctAnswerFor,
  createTestEnv,
  createUser,
  TEST_START,
  wrongAnswerFor,
  type TestEnv,
} from "../test-helpers";
import { startSession, submitAnswer } from "./game-service";
import { getLeaderboard, LEADERBOARD_SIZE } from "./leaderboard-service";
import { isNicknameBlocked } from "./nickname-blocklist";
import { getHistory, getMe, updateNickname, validateNickname } from "./user-service";

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  return e instanceof AppError ? e.code : null;
}

describe("user-service", () => {
  it("validates nicknames", () => {
    expect(validateNickname("ab")).toMatch(/3–20/);
    expect(validateNickname("a".repeat(21))).toMatch(/3–20/);
    expect(validateNickname("bad name")).toMatch(/letters/);
    expect(validateNickname("Admin")).toMatch(/not allowed/);
    expect(validateNickname("NBA_1")).toMatch(/not allowed/);
    expect(validateNickname("moderator")).toMatch(/not allowed/);
    expect(validateNickname("Hoops_Fan_23")).toBeNull();
    expect(isNicknameBlocked("Dame_Time")).toBe(false);
  });

  it("sets a nickname, case-insensitively unique", async () => {
    const { ctx } = env;
    const a = await createUser(ctx);
    const b = await createUser(ctx);
    expect((await updateNickname(ctx, a, "  Splash_Bro ")).nickname).toBe("Splash_Bro");
    expect(await codeOf(updateNickname(ctx, b, "splash_bro"))).toBe("CONFLICT");
    expect(await codeOf(updateNickname(ctx, b, "x!"))).toBe("VALIDATION");
    // Re-saving your own name (different case) is fine.
    expect((await updateNickname(ctx, a, "SPLASH_BRO")).nickname).toBe("SPLASH_BRO");
  });

  it("reports totals, accuracy, achievements and history", async () => {
    const { ctx } = env;
    const userId = await createUser(ctx);
    const fresh = await getMe(ctx, userId);
    expect(fresh).toMatchObject({ gamesPlayed: 0, accuracy: 0, totalPoints: 0 });
    expect(fresh.achievements).toHaveLength(8);
    expect(fresh.achievements.every((a) => a.earnedAt === null)).toBe(true);

    const s = await startSession(ctx, userId, "career-stats", "medium");
    for (let i = 0; i < s.total; i++) {
      const key = await answerKeyOf(ctx, s.sessionId, i);
      await submitAnswer(
        ctx,
        userId,
        s.sessionId,
        i,
        i < 8 ? correctAnswerFor(key) : wrongAnswerFor(key),
      );
    }
    const me = await getMe(ctx, userId);
    expect(me.gamesPlayed).toBe(1);
    expect(me.accuracy).toBe(80);
    expect(me.bestStreak).toBe(8);
    expect(me.achievements.find((a) => a.id === "first-game")?.earnedAt).not.toBeNull();
    const history = await getHistory(ctx, userId);
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({
      sessionId: s.sessionId,
      correct: 8,
      total: 10,
      bestStreak: 8,
    });
  });
});

describe("leaderboard-service", () => {
  async function earn(userId: string, correct: number) {
    const s = await startSession(env.ctx, userId, "career-stats", "easy");
    for (let i = 0; i < s.total; i++) {
      const key = await answerKeyOf(env.ctx, s.sessionId, i);
      await submitAnswer(
        env.ctx,
        userId,
        s.sessionId,
        i,
        i < correct ? correctAnswerFor(key) : wrongAnswerFor(key),
      );
    }
  }

  it("ranks named users by points and reports the caller's own rank", async () => {
    const { ctx } = env;
    const low = await createUser(ctx, "low");
    const high = await createUser(ctx, "high");
    const anon = await createUser(ctx);
    await earn(low, 2);
    await earn(high, 9);
    await earn(anon, 10);

    const all = await getLeaderboard(ctx, "all", low);
    expect(all.rows.map((r) => r.nickname)).toEqual(["high", "low"]);
    expect(all.rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(all.rows[1]?.isMe).toBe(true);
    expect(all.me).toMatchObject({ rank: 2, nickname: "low" });

    // Unnamed users are never listed but still see their points.
    const asAnon = await getLeaderboard(ctx, "all", anon);
    expect(asAnon.rows.some((r) => r.isMe)).toBe(false);
    expect(asAnon.me.rank).toBeNull();
    expect(asAnon.me.points).toBeGreaterThan(0);
  });

  it("only counts the last 7×24 h for the week tab and today's daily for the day tab", async () => {
    const { ctx, clock } = env;
    const old = await createUser(ctx, "old_timer");
    const recent = await createUser(ctx, "recent");
    await earn(old, 10);
    clock.advanceSec(8 * 24 * 60 * 60);
    await earn(recent, 1);

    const week = await getLeaderboard(ctx, "week", old);
    expect(week.rows.map((r) => r.nickname)).toEqual(["recent"]);
    expect(week.me).toMatchObject({ rank: null, points: 0 });
    const all = await getLeaderboard(ctx, "all", null);
    expect(all.rows.map((r) => r.nickname)).toEqual(["old_timer", "recent"]);
    expect((await getLeaderboard(ctx, "day", null)).rows).toEqual([]);
  });

  it("gives tied users the same rank", async () => {
    const { ctx } = env;
    const a = await createUser(ctx, "aaa");
    const b = await createUser(ctx, "bbb");
    const c = await createUser(ctx, "ccc");
    await ctx.db.user.update({ where: { id: a }, data: { totalPoints: 500 } });
    await ctx.db.user.update({ where: { id: b }, data: { totalPoints: 500 } });
    await ctx.db.user.update({ where: { id: c }, data: { totalPoints: 100 } });
    const res = await getLeaderboard(ctx, "all", c);
    expect(res.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(res.me.rank).toBe(3);
  });

  it("returns only the top 100 and ranks the caller outside it by a count", async () => {
    const { ctx } = env;
    const n = LEADERBOARD_SIZE + 5;
    // Points n..1; the two best are tied to keep 1,1,3 semantics in play.
    await ctx.db.user.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        nickname: `user_${i}`,
        nicknameKey: `user_${i}`,
        totalPoints: i === 1 ? n : n - i,
        createdAt: new Date(TEST_START.getTime() + i * 1000),
      })),
    });
    const last = await ctx.db.user.findFirstOrThrow({ where: { nickname: `user_${n - 1}` } });
    const unnamed = await createUser(ctx);
    await ctx.db.user.update({ where: { id: unnamed }, data: { totalPoints: 10_000 } });

    const res = await getLeaderboard(ctx, "all", last.id);
    expect(res.rows).toHaveLength(LEADERBOARD_SIZE);
    expect(res.rows.slice(0, 3).map((r) => [r.nickname, r.rank])).toEqual([
      ["user_0", 1],
      ["user_1", 1],
      ["user_2", 3],
    ]);
    expect(res.rows.some((r) => r.isMe)).toBe(false);
    expect(res.me).toMatchObject({ rank: n, points: 1, nickname: `user_${n - 1}` });
  });

  it("aggregates the week tab in the database with ties and the caller's rank", async () => {
    const { ctx, clock } = env;
    const a = await createUser(ctx, "week_a");
    const b = await createUser(ctx, "week_b");
    const c = await createUser(ctx, "week_c");
    const anon = await createUser(ctx);
    await earn(a, 5);
    await earn(b, 5);
    await earn(c, 1);
    await earn(anon, 10);
    clock.advanceSec(60);

    const week = await getLeaderboard(ctx, "week", c);
    const pointsOf = async (id: string) =>
      (await ctx.db.user.findUniqueOrThrow({ where: { id } })).totalPoints;
    expect(week.rows.map((r) => r.nickname)).toEqual(["week_a", "week_b", "week_c"]);
    expect(week.rows.map((r) => r.points)).toEqual([
      await pointsOf(a),
      await pointsOf(b),
      await pointsOf(c),
    ]);
    // Same answers at the same (fake) times: a and b tie; older account listed first.
    expect(week.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(week.me).toMatchObject({ rank: 3, points: await pointsOf(c), nickname: "week_c" });
    // Unnamed: not listed, no rank, but sees their own weekly points.
    const asAnon = await getLeaderboard(ctx, "week", anon);
    expect(asAnon.me).toMatchObject({ rank: null, points: await pointsOf(anon) });
  });
});
