import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAILY_LENGTH, NEXT_QUESTION_DELAY_MS } from "@/games/core/difficulty";
import { AppError } from "../errors";
import {
  answerKeyOf,
  correctAnswerFor,
  createTestEnv,
  createUser,
  TEST_START,
  type TestEnv,
} from "../test-helpers";
import { getDailyStatus, startDaily } from "./daily-service";
import { submitAnswer } from "./game-service";

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

async function finish(userId: string, sessionId: string, total: number) {
  let last = null;
  for (let i = 0; i < total; i++) {
    last = await submitAnswer(
      env.ctx,
      userId,
      sessionId,
      i,
      correctAnswerFor(await answerKeyOf(env.ctx, sessionId, i)),
    );
  }
  return last;
}

describe("daily-service", () => {
  it("gives two users identical questions on the same UTC date", async () => {
    const { ctx } = env;
    const a = await createUser(ctx);
    const b = await createUser(ctx);
    const sa = await startDaily(ctx, a);
    const sb = await startDaily(ctx, b);
    expect(sa.mode).toBe("daily");
    expect(sa.difficulty).toBe("medium");
    expect(sa.total).toBe(DAILY_LENGTH);
    const payloads = async (sessionId: string) =>
      (await ctx.db.question.findMany({ where: { sessionId }, orderBy: { index: "asc" } })).map(
        (q) => [q.payload, q.answerKey],
      );
    expect(await payloads(sa.sessionId)).toEqual(await payloads(sb.sessionId));
    const modes = (await payloads(sa.sessionId)).map(
      ([p]) => (JSON.parse(p as string) as { mode: string }).mode,
    );
    expect(new Set(modes).size).toBe(DAILY_LENGTH);
  });

  it("allows one attempt per day: finished → CONFLICT, next day → new session", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const s = await startDaily(ctx, userId);
    const last = await finish(userId, s.sessionId, s.total);
    expect(last?.summary).toMatchObject({
      mode: "daily",
      difficulty: "medium",
      correct: DAILY_LENGTH,
    });

    const err = await startDaily(ctx, userId).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("CONFLICT");

    const status = await getDailyStatus(ctx, userId);
    expect(status).toMatchObject({
      date: "2026-03-10",
      played: true,
      nextResetAt: "2026-03-11T00:00:00.000Z",
    });
    expect(status.result?.sessionId).toBe(s.sessionId);

    clock.advanceSec(24 * 60 * 60);
    const tomorrow = await startDaily(ctx, userId);
    expect(tomorrow.sessionId).not.toBe(s.sessionId);
  });

  it("resumes an unfinished daily without resetting issuedAt", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const s = await startDaily(ctx, userId);
    await submitAnswer(ctx, userId, s.sessionId, 0, { timeout: true });
    clock.advanceSec(7);
    const resumed = await startDaily(ctx, userId);
    expect(resumed.sessionId).toBe(s.sessionId);
    expect(resumed.question.index).toBe(1);
    // Question 1 was issued when question 0 was answered (at the start time), stamped to begin
    // after the reveal + slide; resuming keeps that stamp instead of restarting the timer.
    expect(resumed.question.issuedAt).toBe(
      new Date(TEST_START.getTime() + NEXT_QUESTION_DELAY_MS).toISOString(),
    );
    expect(await getDailyStatus(ctx, userId)).toMatchObject({ played: false, result: null });
  });

  it("reports not played for an anonymous visitor", async () => {
    expect(await getDailyStatus(env.ctx, null)).toMatchObject({ played: false, result: null });
  });
});
