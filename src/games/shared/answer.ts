import type { NbaDataSource } from "@/data/source";
import type { AnswerKey, CorrectAnswerView, SubmittedAnswer } from "../core/types";
import { toPlayerRef } from "./player-ref";

export interface EvaluatedAnswer {
  correct: boolean;
  correctUnits: number;
  totalUnits: number;
  correctAnswer: CorrectAnswerView;
}

/** Compares a submitted answer with the server-side key. A mismatched answer shape counts as wrong. */
export function evaluateAnswer(ds: NbaDataSource, key: AnswerKey, submitted: SubmittedAnswer): EvaluatedAnswer {
  if (key.kind === "player") {
    const correct = "playerId" in submitted && submitted.playerId === key.playerId;
    return {
      correct,
      correctUnits: correct ? 1 : 0,
      totalUnits: 1,
      correctAnswer: { kind: "player", player: toPlayerRef(ds, key.playerId) },
    };
  }

  const given = "slots" in submitted ? submitted.slots : {};
  const rows = Object.entries(key.slots)
    .map(([rank, playerId]) => ({
      rank: Number(rank),
      player: toPlayerRef(ds, playerId),
      correct: Object.prototype.hasOwnProperty.call(given, rank) && given[rank] === playerId,
    }))
    .sort((a, b) => a.rank - b.rank);
  const correctUnits = rows.filter((r) => r.correct).length;
  return {
    correct: rows.length > 0 && correctUnits === rows.length,
    correctUnits,
    totalUnits: rows.length,
    correctAnswer: { kind: "slots", rows },
  };
}
