import { describe, expect, it } from "vitest";
import { TOP10_HIDDEN_ROWS, TOP10_LISTS_PER_SESSION, TOP10_TIME_LIMIT_SEC } from "../core/difficulty";
import { DIFFICULTIES } from "../core/types";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("top-10 specifics", () => {
  it("uses the list timing and session length", () => {
    expect(engine.questionsPerSession).toBe(TOP10_LISTS_PER_SESSION);
    const q = generate(engine, "easy", 1);
    expect(q.timeLimitSec).toBe(TOP10_TIME_LIMIT_SEC);
    expect(q.input).toBe("top10");
    expect(q.options).toBeNull();
    if (q.content.mode !== "top-10") throw new Error("shape");
    expect(q.content.listIndex).toBe(1);
    expect(q.content.listTotal).toBe(TOP10_LISTS_PER_SESSION);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: hides exactly ${TOP10_HIDDEN_ROWS[difficulty]} rows and keys only those`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, difficulty, seed);
        if (q.content.mode !== "top-10" || q.answerKey.kind !== "slots") throw new Error("shape");
        const slots = q.answerKey.slots;
        const content = q.content;
        const board = ds.getLeaderboards().find((b) => `t10:${b.id}` === q.key);
        const hidden = content.rows.filter((r) => r.player === null);
        expect(content.rows).toHaveLength(10);
        expect(content.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(hidden).toHaveLength(TOP10_HIDDEN_ROWS[difficulty]);
        expect(Object.keys(slots).sort()).toEqual(hidden.map((r) => String(r.rank)).sort());
        for (const row of board?.rows ?? []) {
          const shown = content.rows.find((r) => r.rank === row.rank);
          expect(shown?.value).toBe(row.value);
          if (shown?.player) expect(shown.player.id).toBe(row.playerId);
          else expect(slots[String(row.rank)]).toBe(row.playerId);
        }
      }
    });
  }
});
