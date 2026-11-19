import { describe, expect, it } from "vitest";
import { scoreAnswer } from "./scoring";

describe("scoreAnswer", () => {
  it("matches the ISKELET example (Hard, 10/20 s left, 3rd in a row → 290)", () => {
    expect(scoreAnswer({ correct: true, difficulty: "hard", remainingSec: 10, limitSec: 20, streakBefore: 2 })).toEqual({
      points: 290,
      streak: 3,
    });
  });

  it("gives 0 and resets streak on a wrong answer", () => {
    expect(scoreAnswer({ correct: false, difficulty: "expert", remainingSec: 20, limitSec: 20, streakBefore: 7 })).toEqual({
      points: 0,
      streak: 0,
    });
  });

  it("has no streak bonus on the first correct answer", () => {
    // Easy, full time: (100 + 50) * 1.0
    expect(scoreAnswer({ correct: true, difficulty: "easy", remainingSec: 30, limitSec: 30, streakBefore: 0 }).points).toBe(150);
  });

  it("caps the streak bonus at +100", () => {
    const r = scoreAnswer({ correct: true, difficulty: "easy", remainingSec: 0, limitSec: 30, streakBefore: 20 });
    expect(r.points).toBe(100 + 100);
    expect(r.streak).toBe(21);
  });

  it("clamps remaining time into [0, limit]", () => {
    expect(scoreAnswer({ correct: true, difficulty: "medium", remainingSec: 99, limitSec: 25, streakBefore: 0 }).points).toBe(225);
    expect(scoreAnswer({ correct: true, difficulty: "medium", remainingSec: -5, limitSec: 25, streakBefore: 0 }).points).toBe(150);
  });
});
