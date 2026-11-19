import "server-only";
import type { StartSessionResponse } from "@/lib/api-types";
import {
  ANSWER_GRACE_SEC,
  FIRST_QUESTION_DELAY_MS,
  NEXT_QUESTION_DELAY_MS,
  SESSION_IDLE_MINUTES,
} from "@/games/core/difficulty";
import { getEngine } from "@/games/core/registry";
import { createRng } from "@/games/core/rng";
import { scoreAnswer } from "@/games/core/scoring";
import type {
  AchievementView,
  AnswerKey,
  AnswerResult,
  Difficulty,
  GameMode,
  GeneratedQuestion,
  PublicQuestion,
  SessionSummary,
  SubmittedAnswer,
} from "@/games/core/types";
import { evaluateAnswer } from "@/games/shared/answer";
import { toPublicQuestion } from "@/games/shared/public";
import type { GameSession, Question } from "@/generated/prisma/client";
import type { ServiceContext } from "../context";
import { AppError } from "../errors";
import { achievementsEarnedAt, awardAchievements } from "./achievements";

const MS_PER_SEC = 1000;
const MS_PER_MIN = 60 * MS_PER_SEC;
export const DAILY_MODE = "daily";

/**
 * The client shows a "3-2-1" countdown before the first question and the reveal + slide before
 * every later one, so a question's server clock starts when it actually becomes visible.
 */
function issueAt(now: Date, delayMs: number): Date {
  return new Date(now.getTime() + delayMs);
}

/**
 * Question payload as stored: the public view minus per-issue fields. Built by
 * `toPublicQuestion`, so it can never contain `key`/`answerKey`.
 */
type StoredPayload = Omit<PublicQuestion, "index" | "total" | "issuedAt">;

export function unitsOf(key: AnswerKey): number {
  return key.kind === "slots" ? Object.keys(key.slots).length : 1;
}

/**
 * Builds the stored rows for a list of generated questions. Top-10 list numbering is rewritten
 * here because the engine generates each list without knowing its position in the session.
 */
export function toQuestionRows(questions: GeneratedQuestion[]) {
  const total = questions.length;
  return questions.map((q, index) => {
    const content =
      q.content.mode === "top-10"
        ? { ...q.content, listIndex: index + 1, listTotal: total }
        : q.content;
    const pub = toPublicQuestion({ ...q, content }, index, total, new Date(0));
    const stored: StoredPayload = {
      mode: pub.mode,
      difficulty: pub.difficulty,
      timeLimitSec: pub.timeLimitSec,
      input: pub.input,
      options: pub.options,
      content: pub.content,
    };
    return {
      index,
      payload: JSON.stringify(stored),
      answerKey: JSON.stringify(q.answerKey),
      units: unitsOf(q.answerKey),
    };
  });
}

export function toPublic(
  question: Pick<Question, "index" | "payload" | "issuedAt">,
  total: number,
): PublicQuestion {
  const payload = JSON.parse(question.payload) as StoredPayload;
  if (!question.issuedAt) throw new Error(`Question ${question.index} served before being issued`);
  return { ...payload, index: question.index, total, issuedAt: question.issuedAt.toISOString() };
}

/** Generates up to `count` distinct questions; stops early when the engine runs out. */
export function generateQuestions(
  ctx: ServiceContext,
  mode: GameMode,
  difficulty: Difficulty,
  count: number,
  seed: number,
): GeneratedQuestion[] {
  const engine = getEngine(mode);
  const rng = createRng(seed);
  const exclude = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const q = engine.generateQuestion(ctx.ds, difficulty, rng, exclude);
    if (!q) break;
    exclude.add(q.key);
    out.push(q);
  }
  return out;
}

export async function createSessionWithQuestions(
  ctx: ServiceContext,
  input: {
    userId: string;
    mode: GameMode | typeof DAILY_MODE;
    difficulty: Difficulty;
    seed: number;
    questions: GeneratedQuestion[];
    dailyDate?: string;
  },
): Promise<StartSessionResponse> {
  if (input.questions.length === 0)
    throw new AppError("NOT_FOUND", "No questions for this mode yet.");
  const now = ctx.now();
  const firstIssuedAt = issueAt(now, FIRST_QUESTION_DELAY_MS);
  const rows = toQuestionRows(input.questions);
  const session = await ctx.db.gameSession.create({
    data: {
      userId: input.userId,
      mode: input.mode,
      difficulty: input.difficulty,
      isDaily: input.mode === DAILY_MODE,
      dailyDate: input.dailyDate ?? null,
      seed: input.seed,
      total: rows.reduce((sum, r) => sum + r.units, 0),
      questionCount: rows.length,
      createdAt: now,
      lastActivityAt: now,
      questions: {
        create: rows.map((r) => ({ ...r, issuedAt: r.index === 0 ? firstIssuedAt : null })),
      },
    },
    include: { questions: { where: { index: 0 } } },
  });
  const first = session.questions[0];
  if (!first) throw new Error("Session created without questions");
  return {
    sessionId: session.id,
    mode: input.mode,
    difficulty: input.difficulty,
    total: session.questionCount,
    question: toPublic(first, session.questionCount),
  };
}

/** POST /api/games/sessions */
export async function startSession(
  ctx: ServiceContext,
  userId: string,
  mode: GameMode,
  difficulty: Difficulty,
): Promise<StartSessionResponse> {
  const seed = ctx.randomSeed();
  const questions = generateQuestions(
    ctx,
    mode,
    difficulty,
    getEngine(mode).questionsPerSession,
    seed,
  );
  return createSessionWithQuestions(ctx, { userId, mode, difficulty, seed, questions });
}

/** Re-serves the current question of an ACTIVE session without touching its `issuedAt`. */
export async function resumeSession(
  ctx: ServiceContext,
  session: GameSession,
): Promise<StartSessionResponse> {
  const now = ctx.now();
  let current = await ctx.db.question.findUnique({
    where: { sessionId_index: { sessionId: session.id, index: session.currentIndex } },
  });
  if (!current) throw new AppError("NOT_FOUND", "Session not found.");
  if (!current.issuedAt) {
    current = await ctx.db.question.update({
      where: { id: current.id },
      data: { issuedAt: issueAt(now, FIRST_QUESTION_DELAY_MS) },
    });
  }
  // Activity refresh only: a stale question is still judged from its original issuedAt (→ timeout).
  await ctx.db.gameSession.update({ where: { id: session.id }, data: { lastActivityAt: now } });
  return {
    sessionId: session.id,
    mode: session.mode as GameMode | typeof DAILY_MODE,
    difficulty: session.difficulty as Difficulty,
    total: session.questionCount,
    question: toPublic(current, session.questionCount),
  };
}

export function toSummary(session: GameSession): SessionSummary {
  return {
    sessionId: session.id,
    mode: session.mode as GameMode | typeof DAILY_MODE,
    difficulty: session.difficulty as Difficulty,
    score: session.score,
    correct: session.correctCount,
    total: session.total,
    bestStreak: session.bestStreak,
  };
}

interface UnitScore {
  points: number;
  streak: number;
  bestStreak: number;
}

/**
 * Scores one answer. A top-10 list scores each hidden slot as its own unit, in rank order, all
 * with the same remaining time; a wrong slot resets the streak like a wrong answer.
 */
function scoreUnits(
  key: AnswerKey,
  submitted: SubmittedAnswer,
  correct: boolean,
  difficulty: Difficulty,
  remainingSec: number,
  limitSec: number,
  streakBefore: number,
): UnitScore {
  const results =
    key.kind === "player"
      ? [correct]
      : Object.entries(key.slots)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([rank, playerId]) => "slots" in submitted && submitted.slots[rank] === playerId);
  let streak = streakBefore;
  let bestStreak = streakBefore;
  let points = 0;
  for (const unitCorrect of results) {
    const r = scoreAnswer({
      correct: unitCorrect,
      difficulty,
      remainingSec,
      limitSec,
      streakBefore: streak,
    });
    points += r.points;
    streak = r.streak;
    bestStreak = Math.max(bestStreak, streak);
  }
  return { points, streak, bestStreak };
}

/** Key-order independent form of a submitted answer, so a retried request compares equal. */
export function canonicalAnswer(answer: SubmittedAnswer): string {
  if ("slots" in answer) {
    const slots = Object.fromEntries(
      Object.entries(answer.slots).sort(([a], [b]) => Number(a) - Number(b)),
    );
    return JSON.stringify({ slots });
  }
  return JSON.stringify(answer);
}

/** Seconds since the question became visible; never negative, so early answers can't over-score. */
function elapsedSecSince(issuedAt: Date, at: Date): number {
  return Math.max(0, (at.getTime() - issuedAt.getTime()) / MS_PER_SEC);
}

/** The server clock is the only timer that counts; the client timer is cosmetic. */
function effectiveAnswer(
  answer: SubmittedAnswer,
  elapsedSec: number,
  limitSec: number,
): SubmittedAnswer {
  return elapsedSec > limitSec + ANSWER_GRACE_SEC ? { timeout: true } : answer;
}

/** Badges must never cost the player the answer response: the answer is already committed. */
async function safeAwardAchievements(
  ctx: ServiceContext,
  userId: string,
  session: GameSession,
): Promise<AchievementView[]> {
  try {
    return await awardAchievements(
      ctx,
      userId,
      {
        isDaily: session.isDaily,
        difficulty: session.difficulty,
        correct: session.correctCount,
        total: session.total,
        bestStreak: session.bestStreak,
        dailyDate: session.dailyDate,
      },
      session.finishedAt ?? ctx.now(),
    );
  } catch (err) {
    console.error("awardAchievements failed", err);
    return [];
  }
}

/** Badges earned by finishing this session (stamped with its `finishedAt`). */
async function achievementsOfSession(
  ctx: ServiceContext,
  userId: string,
  session: GameSession,
): Promise<AchievementView[]> {
  if (!session.finishedAt) return [];
  try {
    return await achievementsEarnedAt(ctx, userId, session.finishedAt);
  } catch (err) {
    console.error("loading achievements failed", err);
    return [];
  }
}

/**
 * Rebuilds the response of an already answered question from the stored rows, so a client that
 * lost the response (or a double submit) gets the identical result instead of a CONFLICT.
 */
async function replayAnswer(
  ctx: ServiceContext,
  userId: string,
  session: GameSession,
  question: Question,
): Promise<AnswerResult> {
  if (!question.answeredAt || !question.issuedAt || !question.submittedAnswer) {
    throw new AppError("CONFLICT", "This question was already answered.");
  }
  const payload = JSON.parse(question.payload) as StoredPayload;
  const key = JSON.parse(question.answerKey) as AnswerKey;
  const submitted = JSON.parse(question.submittedAnswer) as SubmittedAnswer;
  const elapsedSec = elapsedSecSince(question.issuedAt, question.answeredAt);
  const evaluation = evaluateAnswer(
    ctx.ds,
    key,
    effectiveAnswer(submitted, elapsedSec, payload.timeLimitSec),
  );
  const isLast = question.index + 1 >= session.questionCount;
  const finished = isLast && session.status === "FINISHED";
  const next = isLast
    ? null
    : await ctx.db.question.findUnique({
        where: { sessionId_index: { sessionId: session.id, index: question.index + 1 } },
      });
  let newAchievements: AchievementView[] = [];
  if (finished) {
    // Also covers a first attempt whose badge awarding failed after the answer was committed.
    await safeAwardAchievements(ctx, userId, session);
    newAchievements = await achievementsOfSession(ctx, userId, session);
  }
  return {
    correct: evaluation.correct,
    correctUnits: evaluation.correctUnits,
    totalUnits: evaluation.totalUnits,
    correctAnswer: evaluation.correctAnswer,
    points: question.points ?? 0,
    streak: question.streakAfter ?? session.streak,
    totalScore: question.scoreAfter ?? session.score,
    next: next?.issuedAt ? toPublic(next, session.questionCount) : null,
    summary: finished ? toSummary(session) : null,
    newAchievements,
  };
}

/** Thrown inside the answer transaction when a concurrent request answered first. */
class AlreadyAnswered extends Error {}

/**
 * POST /api/games/sessions/[id]/answer (also used by daily sessions).
 * Idempotent per question: repeating the same answer returns the original result; only a
 * different answer for an already answered question is a CONFLICT.
 */
export async function submitAnswer(
  ctx: ServiceContext,
  userId: string,
  sessionId: string,
  questionIndex: number,
  answer: SubmittedAnswer,
): Promise<AnswerResult> {
  const now = ctx.now();
  const session = await ctx.db.gameSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw new AppError("NOT_FOUND", "Session not found.");
  const question = await ctx.db.question.findUnique({
    where: { sessionId_index: { sessionId, index: questionIndex } },
  });
  const submitted = canonicalAnswer(answer);
  const replayIfSame = async (): Promise<AnswerResult> => {
    const answered = await ctx.db.question.findUnique({
      where: { sessionId_index: { sessionId, index: questionIndex } },
    });
    if (answered?.answeredAt && answered.submittedAnswer === submitted) {
      const current = await ctx.db.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
      return replayAnswer(ctx, userId, current, answered);
    }
    throw new AppError("CONFLICT", "This question was already answered.");
  };
  if (question?.answeredAt) return replayIfSame();

  if (session.status !== "ACTIVE") throw new AppError("CONFLICT", "This game is already finished.");
  if (now.getTime() - session.lastActivityAt.getTime() > SESSION_IDLE_MINUTES * MS_PER_MIN) {
    throw new AppError("EXPIRED", "Session expired. Start a new game.");
  }
  if (questionIndex !== session.currentIndex || !question?.issuedAt) {
    throw new AppError("CONFLICT", "This question was already answered.");
  }

  const payload = JSON.parse(question.payload) as StoredPayload;
  const key = JSON.parse(question.answerKey) as AnswerKey;
  const limitSec = payload.timeLimitSec;
  const elapsedSec = elapsedSecSince(question.issuedAt, now);
  const effective = effectiveAnswer(answer, elapsedSec, limitSec);
  const evaluation = evaluateAnswer(ctx.ds, key, effective);
  const scored = scoreUnits(
    key,
    effective,
    evaluation.correct,
    payload.difficulty,
    limitSec - elapsedSec,
    limitSec,
    session.streak,
  );

  const isLast = questionIndex + 1 >= session.questionCount;
  const nextIndex = questionIndex + 1;

  let updated: { session: GameSession; next: Question | null };
  try {
    updated = await ctx.db.$transaction(async (tx) => {
      // Conditional update guards against a double submit racing past the checks above.
      const claimed = await tx.question.updateMany({
        where: { id: question.id, answeredAt: null },
        data: {
          answeredAt: now,
          correct: evaluation.correct,
          correctUnits: evaluation.correctUnits,
          points: scored.points,
          submittedAnswer: submitted,
          streakAfter: scored.streak,
          scoreAfter: session.score + scored.points,
        },
      });
      if (claimed.count !== 1) throw new AlreadyAnswered();
      const s = await tx.gameSession.update({
        where: { id: sessionId },
        data: {
          score: { increment: scored.points },
          streak: scored.streak,
          bestStreak: Math.max(session.bestStreak, scored.bestStreak),
          correctCount: { increment: evaluation.correctUnits },
          currentIndex: nextIndex,
          lastActivityAt: now,
          ...(isLast ? { status: "FINISHED", finishedAt: now } : {}),
        },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { bestStreak: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          totalPoints: { increment: scored.points },
          ...(scored.bestStreak > user.bestStreak ? { bestStreak: scored.bestStreak } : {}),
        },
      });
      const next = isLast
        ? null
        : await tx.question.update({
            where: { sessionId_index: { sessionId, index: nextIndex } },
            data: { issuedAt: issueAt(now, NEXT_QUESTION_DELAY_MS) },
          });
      return { session: s, next };
    });
  } catch (err) {
    // A concurrent identical submit won the race: answer it like a retry.
    if (err instanceof AlreadyAnswered) return replayIfSame();
    throw err;
  }

  const newAchievements = isLast ? await safeAwardAchievements(ctx, userId, updated.session) : [];

  return {
    correct: evaluation.correct,
    correctUnits: evaluation.correctUnits,
    totalUnits: evaluation.totalUnits,
    correctAnswer: evaluation.correctAnswer,
    points: scored.points,
    streak: updated.session.streak,
    totalScore: updated.session.score,
    next: updated.next ? toPublic(updated.next, updated.session.questionCount) : null,
    summary: isLast ? toSummary(updated.session) : null,
    newAchievements,
  };
}
