import "server-only";
import { z } from "zod";
import { DIFFICULTIES, GAME_MODES } from "@/games/core/types";
import { AppError } from "./errors";

const MAX_ID = 64;
const MAX_QUESTION_INDEX = 100;
const MAX_SLOTS = 10;

const playerId = z.string().min(1).max(MAX_ID);

export const startSessionSchema = z.strictObject({
  mode: z.enum(GAME_MODES),
  difficulty: z.enum(DIFFICULTIES),
});

export const submittedAnswerSchema = z.union([
  z.strictObject({ playerId }),
  z.strictObject({
    slots: z
      .record(z.string().regex(/^\d{1,2}$/), playerId)
      .refine((s) => Object.keys(s).length <= MAX_SLOTS, "Too many slots"),
  }),
  z.strictObject({ timeout: z.literal(true) }),
]);

export const answerSchema = z.strictObject({
  questionIndex: z.int().min(0).max(MAX_QUESTION_INDEX),
  answer: submittedAnswerSchema,
});

// Length/charset rules are checked by user-service so the client gets a specific message.
export const nicknameSchema = z.strictObject({ nickname: z.string().max(MAX_ID) });

export const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(40) });

export const leaderboardQuerySchema = z.object({
  period: z.enum(["all", "week", "day"]).default("all"),
});

export const sessionIdSchema = z
  .string()
  .min(1)
  .max(MAX_ID)
  .regex(/^[A-Za-z0-9_-]+$/);

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new AppError("VALIDATION", `Invalid request. ${where}${issue?.message ?? ""}`.trim());
  }
  return result.data;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON.");
  }
}

export function searchParams(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}
