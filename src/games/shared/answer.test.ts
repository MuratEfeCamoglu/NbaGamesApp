import { describe, expect, it } from "vitest";
import type { AnswerKey } from "../core/types";
import { createFixtureDataSource } from "../test-fixtures";
import { evaluateAnswer } from "./answer";

const ds = createFixtureDataSource();
const playerKey: AnswerKey = { kind: "player", playerId: "201939" };
const slotsKey: AnswerKey = { kind: "slots", slots: { "7": "2594", "2": "951", "4": "203081" } };

describe("evaluateAnswer: player key", () => {
  it("is correct only for the same id", () => {
    const right = evaluateAnswer(ds, playerKey, { playerId: "201939" });
    expect(right).toMatchObject({ correct: true, correctUnits: 1, totalUnits: 1 });
    expect(right.correctAnswer).toEqual({
      kind: "player",
      player: { id: "201939", name: "Stephen Curry", position: "G", teamId: "GSW", headshotId: "201939" },
    });
    expect(evaluateAnswer(ds, playerKey, { playerId: "202691" })).toMatchObject({ correct: false, correctUnits: 0 });
  });

  it("treats timeout and a wrong answer shape as wrong", () => {
    expect(evaluateAnswer(ds, playerKey, { timeout: true })).toMatchObject({
      correct: false,
      correctUnits: 0,
      totalUnits: 1,
    });
    expect(evaluateAnswer(ds, playerKey, { slots: { "1": "201939" } })).toMatchObject({ correct: false });
  });
});

describe("evaluateAnswer: slots key", () => {
  it("all slots right is correct, rows sorted by rank", () => {
    const r = evaluateAnswer(ds, slotsKey, { slots: { "2": "951", "4": "203081", "7": "2594" } });
    expect(r).toMatchObject({ correct: true, correctUnits: 3, totalUnits: 3 });
    if (r.correctAnswer.kind !== "slots") throw new Error("shape");
    expect(r.correctAnswer.rows.map((row) => row.rank)).toEqual([2, 4, 7]);
    expect(r.correctAnswer.rows.every((row) => row.correct)).toBe(true);
    expect(r.correctAnswer.rows[0]?.player.name).toBe("Ray Allen");
  });

  it("partial slots count units and flag each row", () => {
    const r = evaluateAnswer(ds, slotsKey, { slots: { "2": "951", "4": "2594", "9": "203081" } });
    expect(r).toMatchObject({ correct: false, correctUnits: 1, totalUnits: 3 });
    if (r.correctAnswer.kind !== "slots") throw new Error("shape");
    expect(r.correctAnswer.rows.map((row) => row.correct)).toEqual([true, false, false]);
  });

  it("timeout and a player answer score zero units", () => {
    expect(evaluateAnswer(ds, slotsKey, { timeout: true })).toMatchObject({
      correct: false,
      correctUnits: 0,
      totalUnits: 3,
    });
    expect(evaluateAnswer(ds, slotsKey, { playerId: "951" })).toMatchObject({ correct: false, correctUnits: 0 });
  });

  it("ignores inherited keys in submitted slots", () => {
    const submitted = JSON.parse('{"__proto__": {"1": "2544"}}') as Record<string, string>;
    const r = evaluateAnswer(ds, { kind: "slots", slots: { "1": "2544" } }, { slots: submitted });
    expect(r.correctUnits).toBe(0);
  });
});
