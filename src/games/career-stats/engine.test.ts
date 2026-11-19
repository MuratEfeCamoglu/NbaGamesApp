import { describe, expect, it } from "vitest";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("career-stats specifics", () => {
  it("shows the player's career averages", () => {
    for (const seed of SEEDS) {
      const q = generate(engine, "medium", seed);
      if (q.content.mode !== "career-stats" || q.answerKey.kind !== "player") throw new Error("shape");
      const stats = ds.getCareerStats(q.answerKey.playerId);
      expect(q.content.stats.ppg).toBe(stats?.ppg);
      expect(q.content.stats.games).toBe(stats?.games);
      expect(q.content.stats.seasons).toBe(stats?.seasons);
      expect(q.content.stats.position).toBe(ds.getPlayer(q.answerKey.playerId)?.position);
    }
  });

  it("hides seasons and position only at Expert", () => {
    for (const seed of SEEDS) {
      const hard = generate(engine, "hard", seed);
      const expert = generate(engine, "expert", seed);
      if (hard.content.mode !== "career-stats" || expert.content.mode !== "career-stats") throw new Error("shape");
      expect(hard.content.stats.seasons).not.toBeNull();
      expect(hard.content.stats.position).not.toBeNull();
      expect(expert.content.stats.seasons).toBeNull();
      expect(expert.content.stats.position).toBeNull();
    }
  });
});
