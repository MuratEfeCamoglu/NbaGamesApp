import { describe, expect, it } from "vitest";
import { DIFFICULTIES, ERAS } from "../core/types";
import { ds, ERA_FILTERS, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("career-stats specifics", () => {
  for (const era of ERA_FILTERS) {
    it(`${era}: shows the player's career averages`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, "medium", seed, new Set(), era);
        if (q.content.mode !== "career-stats" || q.answerKey.kind !== "player") throw new Error("shape");
        const stats = ds.getCareerStats(q.answerKey.playerId);
        expect(q.content.stats.ppg).toBe(stats?.ppg);
        expect(q.content.stats.games).toBe(stats?.games);
        expect(q.content.stats.seasons).toBe(stats?.seasons);
        expect(q.content.stats.position).toBe(ds.getPlayer(q.answerKey.playerId)?.position);
      }
    });

    it(`${era}: hides seasons and position only at Expert`, () => {
      for (const seed of SEEDS) {
        const hard = generate(engine, "hard", seed, new Set(), era);
        const expert = generate(engine, "expert", seed, new Set(), era);
        if (hard.content.mode !== "career-stats" || expert.content.mode !== "career-stats") throw new Error("shape");
        expect(hard.content.stats.seasons).not.toBeNull();
        expect(hard.content.stats.position).not.toBeNull();
        expect(expert.content.stats.seasons).toBeNull();
        expect(expert.content.stats.position).toBeNull();
      }
    });
  }

  for (const era of ERAS) {
    it(`${era}: every difficulty asks only about players of the era`, () => {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed, new Set(), era);
          if (q.answerKey.kind !== "player") throw new Error("shape");
          expect(ds.getPlayer(q.answerKey.playerId)?.active).toBe(era === "current");
        }
      }
    });
  }
});
