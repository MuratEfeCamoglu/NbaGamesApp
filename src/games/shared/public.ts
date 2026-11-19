import type { GeneratedQuestion, PublicQuestion } from "../core/types";

/** Strips server-only fields (`key`, `answerKey`) — the only shape that may reach the client. */
export function toPublicQuestion(
  q: GeneratedQuestion,
  index: number,
  total: number,
  issuedAt: Date,
): PublicQuestion {
  return {
    index,
    total,
    mode: q.mode,
    difficulty: q.difficulty,
    timeLimitSec: q.timeLimitSec,
    input: q.input,
    options: q.options ? q.options.map((o) => ({ id: o.id, label: o.label })) : null,
    content: structuredClone(q.content),
    issuedAt: issuedAt.toISOString(),
  };
}
