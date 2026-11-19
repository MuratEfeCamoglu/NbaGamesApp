import { describe, expect, it } from "vitest";
import type { GeneratedQuestion } from "../core/types";
import { toPublicQuestion } from "./public";

const q: GeneratedQuestion = {
  key: "cs:2544",
  mode: "career-stats",
  difficulty: "easy",
  timeLimitSec: 30,
  input: "choices",
  options: [{ id: "2544", label: "LeBron James" }],
  content: {
    mode: "career-stats",
    stats: { ppg: 27, rpg: 7.5, apg: 7.4, spg: 1.5, bpg: 0.7, fgPct: 50.6, games: 1562, seasons: 23, position: "F" },
  },
  answerKey: { kind: "player", playerId: "2544" },
};

describe("toPublicQuestion", () => {
  it("drops key and answerKey and adds index/total/issuedAt", () => {
    const pub = toPublicQuestion(q, 3, 10, new Date("2026-11-19T10:00:00Z"));
    expect(pub).not.toHaveProperty("key");
    expect(pub).not.toHaveProperty("answerKey");
    expect(pub).toMatchObject({ index: 3, total: 10, issuedAt: "2026-11-19T10:00:00.000Z", mode: "career-stats" });
    expect(JSON.stringify(pub)).not.toContain("answerKey");
  });

  it("does not share references with the server question", () => {
    const pub = toPublicQuestion(q, 0, 10, new Date(0));
    expect(pub.content).toEqual(q.content);
    expect(pub.content).not.toBe(q.content);
  });
});
