import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANSWER_GRACE_SEC,
  FIRST_QUESTION_DELAY_MS,
  NEXT_QUESTION_DELAY_MS,
  SESSION_IDLE_MINUTES,
} from "@/games/core/difficulty";
import { scoreAnswer } from "@/games/core/scoring";
import { GAME_MODES, type AnswerKey, type PublicQuestion } from "@/games/core/types";
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
import { canonicalAnswer, startSession, submitAnswer } from "./game-service";

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

function hiddenIds(key: AnswerKey): string[] {
  return key.kind === "player" ? [key.playerId] : Object.values(key.slots);
}

/** The response must not reveal the key of any question that is not yet answered. */
function assertNoLeak(json: string, keys: AnswerKey[], checkIds: boolean) {
  expect(json).not.toContain("answerKey");
  expect(json).not.toMatch(/"key"\s*:/);
  if (!checkIds) return;
  for (const key of keys) for (const id of hiddenIds(key)) expect(json).not.toContain(`"${id}"`);
}

const FIRST_DELAY_SEC = FIRST_QUESTION_DELAY_MS / 1000;
const NEXT_DELAY_SEC = NEXT_QUESTION_DELAY_MS / 1000;

async function expectAppError(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

describe("game-service", () => {
  it("plays a full 10-question session to a summary and updates the user", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "career-stats", "easy");
    expect(start.total).toBe(10);
    expect(start.question.index).toBe(0);

    let question: PublicQuestion | null = start.question;
    let last = null;
    let expectedScore = 0;
    for (let i = 0; i < 10; i++) {
      expect(question?.index).toBe(i);
      clock.advanceSec(5);
      const key = await answerKeyOf(ctx, start.sessionId, i);
      // Alternate correct/wrong so streak and score paths are both exercised.
      const correct = i % 3 !== 2;
      last = await submitAnswer(
        ctx,
        userId,
        start.sessionId,
        i,
        correct ? correctAnswerFor(key) : wrongAnswerFor(key),
      );
      expect(last.correct).toBe(correct);
      expectedScore += last.points;
      question = last.next;
    }
    expect(last?.next).toBeNull();
    expect(last?.summary).toMatchObject({
      sessionId: start.sessionId,
      mode: "career-stats",
      difficulty: "easy",
      correct: 7,
      total: 10,
      score: expectedScore,
    });
    expect(last?.newAchievements.map((a) => a.id)).toContain("first-game");
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totalPoints).toBe(expectedScore);
    expect(user.bestStreak).toBe(2);
  });

  it("never sends an answer key (or a hidden answer) before the question is answered", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    for (const mode of GAME_MODES) {
      // Hard uses the search box, so not even the correct option id is in the payload.
      const start = await startSession(ctx, userId, mode, "hard");
      const keys: AnswerKey[] = [];
      for (let i = 0; i < start.total; i++) keys.push(await answerKeyOf(ctx, start.sessionId, i));
      // A later question may legitimately feature this player; only the served question's key matters.
      assertNoLeak(JSON.stringify(start), keys.slice(0, 1), true);
      for (let i = 0; i < start.total; i++) {
        clock.advanceSec(1);
        const res = await submitAnswer(
          ctx,
          userId,
          start.sessionId,
          i,
          wrongAnswerFor(keys[i] as AnswerKey),
        );
        // The reveal of question i is allowed; the newly served question i+1 must stay hidden.
        const rest = { ...res, correctAnswer: null };
        assertNoLeak(JSON.stringify(rest), keys.slice(i + 1, i + 2), true);
      }
    }
    // Easy: options contain the answer by design, but no key field is ever serialized.
    const easy = await startSession(ctx, userId, "starting-five", "easy");
    assertNoLeak(JSON.stringify(easy), [], false);
  });

  it("scores with the server clock and treats late answers as timeouts", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "career-stats", "hard");
    const limit = start.question.timeLimitSec;
    // The timer starts after the client's 3-2-1 countdown, not when the session is created.
    expect(start.question.issuedAt).toBe(
      new Date(TEST_START.getTime() + FIRST_QUESTION_DELAY_MS).toISOString(),
    );

    clock.advanceSec(FIRST_DELAY_SEC + 10);
    const first = await submitAnswer(
      ctx,
      userId,
      start.sessionId,
      0,
      correctAnswerFor(await answerKeyOf(ctx, start.sessionId, 0)),
    );
    expect(first.points).toBe(
      scoreAnswer({
        correct: true,
        difficulty: "hard",
        remainingSec: limit - 10,
        limitSec: limit,
        streakBefore: 0,
      }).points,
    );

    // The next question is stamped to start after the reveal + slide.
    expect(first.next?.issuedAt).toBe(
      new Date(clock.now().getTime() + NEXT_QUESTION_DELAY_MS).toISOString(),
    );
    // Within the grace window counted from when it became visible: still accepted (bonus 0),
    // although more than limit + grace has passed since the previous answer.
    clock.advanceSec(NEXT_DELAY_SEC + limit + ANSWER_GRACE_SEC - 0.5);
    const second = await submitAnswer(
      ctx,
      userId,
      start.sessionId,
      1,
      correctAnswerFor(await answerKeyOf(ctx, start.sessionId, 1)),
    );
    expect(second.correct).toBe(true);

    clock.advanceSec(NEXT_DELAY_SEC + limit + ANSWER_GRACE_SEC + 1);
    const late = await submitAnswer(
      ctx,
      userId,
      start.sessionId,
      2,
      correctAnswerFor(await answerKeyOf(ctx, start.sessionId, 2)),
    );
    expect(late.correct).toBe(false);
    expect(late.points).toBe(0);
    expect(late.streak).toBe(0);
  });

  it("rejects a wrong question index and a different answer to an answered question", async () => {
    const { ctx } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "box-score", "medium");
    await expectAppError(
      submitAnswer(ctx, userId, start.sessionId, 3, { timeout: true }),
      "CONFLICT",
    );
    await submitAnswer(ctx, userId, start.sessionId, 0, { timeout: true });
    await expectAppError(
      submitAnswer(ctx, userId, start.sessionId, 0, { playerId: "someone" }),
      "CONFLICT",
    );
  });

  it("clamps elapsed time at 0 so an answer before the question is visible can't over-score", async () => {
    const { ctx } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "career-stats", "hard");
    const limit = start.question.timeLimitSec;
    // No clock advance: the answer arrives during the countdown, before issuedAt.
    const res = await submitAnswer(
      ctx,
      userId,
      start.sessionId,
      0,
      correctAnswerFor(await answerKeyOf(ctx, start.sessionId, 0)),
    );
    const full = scoreAnswer({
      correct: true,
      difficulty: "hard",
      remainingSec: limit,
      limitSec: limit,
      streakBefore: 0,
    }).points;
    expect(res.points).toBe(full);
  });

  it("replays the same result when an answered question is submitted again", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "career-stats", "easy");
    clock.advanceSec(FIRST_DELAY_SEC + 4);
    const key0 = await answerKeyOf(ctx, start.sessionId, 0);
    const first = await submitAnswer(ctx, userId, start.sessionId, 0, correctAnswerFor(key0));

    // Retry later (response was lost): identical result, no double scoring, same next issuedAt.
    clock.advanceSec(3);
    const retry = await submitAnswer(ctx, userId, start.sessionId, 0, correctAnswerFor(key0));
    expect(retry).toEqual(first);
    const session = await ctx.db.gameSession.findUniqueOrThrow({ where: { id: start.sessionId } });
    expect(session.score).toBe(first.totalScore);
    expect(session.currentIndex).toBe(1);
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totalPoints).toBe(first.points);
  });

  it("treats top-10 slot answers in any key order as the same answer", () => {
    expect(canonicalAnswer({ slots: { "10": "a", "2": "b" } })).toBe(
      canonicalAnswer({ slots: { "2": "b", "10": "a" } }),
    );
    expect(canonicalAnswer({ playerId: "a" })).not.toBe(canonicalAnswer({ playerId: "b" }));
  });

  it("keeps the final answer if awarding achievements fails, and a retry recovers them", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "top-10", "easy");
    for (let i = 0; i < start.total - 1; i++) {
      clock.advanceSec(5);
      await submitAnswer(
        ctx,
        userId,
        start.sessionId,
        i,
        correctAnswerFor(await answerKeyOf(ctx, start.sessionId, i)),
      );
    }
    const lastIndex = start.total - 1;
    const lastAnswer = correctAnswerFor(await answerKeyOf(ctx, start.sessionId, lastIndex));

    // Badge writes fail for the first attempt only.
    const failingDb = new Proxy(ctx.db, {
      get(target, prop, receiver) {
        const value: unknown = Reflect.get(target, prop, receiver);
        if (prop !== "userAchievement") return value;
        return new Proxy(value as object, {
          get(t, p, r) {
            if (p === "create") return () => Promise.reject(new Error("disk full"));
            return Reflect.get(t, p, r) as unknown;
          },
        });
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    clock.advanceSec(5);
    const first = await submitAnswer(
      { ...ctx, db: failingDb },
      userId,
      start.sessionId,
      lastIndex,
      lastAnswer,
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(first.summary).toMatchObject({ correct: 6, total: 6 });
    expect(first.newAchievements).toEqual([]);
    expect(first.next).toBeNull();

    clock.advanceSec(2);
    const retry = await submitAnswer(ctx, userId, start.sessionId, lastIndex, lastAnswer);
    expect(retry.summary).toEqual(first.summary);
    expect(retry.points).toBe(first.points);
    expect(retry.totalScore).toBe(first.totalScore);
    expect(retry.newAchievements.map((a) => a.id)).toEqual(
      expect.arrayContaining(["first-game", "perfect-10", "streak-5"]),
    );
    // A further retry returns this session's badges again, not an empty list.
    const again = await submitAnswer(ctx, userId, start.sessionId, lastIndex, lastAnswer);
    expect(again).toEqual(retry);
    expect(await ctx.db.userAchievement.count({ where: { userId } })).toBe(
      retry.newAchievements.length,
    );
  });

  it("expires idle sessions with EXPIRED and hides other users' sessions", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const other = await createUser(ctx);
    const start = await startSession(ctx, userId, "team-journey", "medium");
    await expectAppError(
      submitAnswer(ctx, other, start.sessionId, 0, { timeout: true }),
      "NOT_FOUND",
    );
    clock.advanceSec(SESSION_IDLE_MINUTES * 60 + 1);
    await expectAppError(
      submitAnswer(ctx, userId, start.sessionId, 0, { timeout: true }),
      "EXPIRED",
    );
  });

  it("scores each hidden top-10 slot as its own unit in rank order", async () => {
    const { ctx, clock } = env;
    const userId = await createUser(ctx);
    const start = await startSession(ctx, userId, "top-10", "easy");
    expect(start.total).toBe(3);
    expect(start.question.input).toBe("top10");
    if (start.question.content.mode !== "top-10") throw new Error("expected top-10 content");
    expect(start.question.content.listIndex).toBe(1);
    expect(start.question.content.listTotal).toBe(3);

    const key0 = await answerKeyOf(ctx, start.sessionId, 0);
    if (key0.kind !== "slots") throw new Error("expected slots");
    const ranks = Object.keys(key0.slots).sort((a, b) => Number(a) - Number(b));
    expect(ranks).toHaveLength(2);
    const [r1, r2] = ranks as [string, string];

    clock.advanceSec(FIRST_DELAY_SEC + 30);
    // First slot right, second wrong.
    const res = await submitAnswer(ctx, userId, start.sessionId, 0, {
      slots: { [r1]: key0.slots[r1] as string, [r2]: "__wrong__" },
    });
    const unit = (streakBefore: number) =>
      scoreAnswer({
        correct: true,
        difficulty: "easy",
        remainingSec: 30,
        limitSec: 60,
        streakBefore,
      }).points;
    expect(res.correct).toBe(false);
    expect(res.correctUnits).toBe(1);
    expect(res.totalUnits).toBe(2);
    expect(res.points).toBe(unit(0));
    expect(res.streak).toBe(0);
    if (res.next?.content.mode !== "top-10") throw new Error("expected next list");
    expect(res.next.content.listIndex).toBe(2);

    clock.advanceSec(NEXT_DELAY_SEC + 30);
    const all = await submitAnswer(
      ctx,
      userId,
      start.sessionId,
      1,
      correctAnswerFor(await answerKeyOf(ctx, start.sessionId, 1)),
    );
    expect(all.correct).toBe(true);
    expect(all.points).toBe(unit(0) + unit(1));
    expect(all.streak).toBe(2);

    const done = await submitAnswer(ctx, userId, start.sessionId, 2, { timeout: true });
    expect(done.summary).toMatchObject({ correct: 3, total: 6, bestStreak: 2 });
  });

  it("awards achievements once per user", async () => {
    const { ctx } = env;
    const userId = await createUser(ctx);
    const play = async () => {
      const s = await startSession(ctx, userId, "top-10", "easy");
      let last = null;
      for (let i = 0; i < s.total; i++) {
        last = await submitAnswer(
          ctx,
          userId,
          s.sessionId,
          i,
          correctAnswerFor(await answerKeyOf(ctx, s.sessionId, i)),
        );
      }
      return last?.newAchievements.map((a) => a.id) ?? [];
    };
    const first = await play();
    expect(first).toEqual(expect.arrayContaining(["first-game", "perfect-10", "streak-5"]));
    const second = await play();
    expect(second).not.toContain("first-game");
    expect(second).not.toContain("perfect-10");
    expect(
      await ctx.db.userAchievement.count({ where: { userId, achievementId: "first-game" } }),
    ).toBe(1);
  });
});
