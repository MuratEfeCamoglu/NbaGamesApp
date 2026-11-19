import { describe, expect, it } from "vitest";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("box-score specifics", () => {
  it("shows the line and game of a box score row", () => {
    for (const seed of SEEDS) {
      const q = generate(engine, "hard", seed);
      if (q.content.mode !== "box-score" || q.answerKey.kind !== "player") throw new Error("shape");
      const line = ds.getBoxScores().find((l) => `bs:${l.id}` === q.key);
      expect(line?.playerId).toBe(q.answerKey.playerId);
      expect(q.content.line.pts).toBe(line?.pts);
      expect(q.content.game?.date).toBe(line?.gameDate);
      expect(q.content.game?.teamId).toBe(line?.teamId);
    }
  });

  it("hides the game (date, teams, score) only at Expert", () => {
    for (const seed of SEEDS) {
      const expert = generate(engine, "expert", seed);
      if (expert.content.mode !== "box-score") throw new Error("shape");
      expect(expert.content.game).toBeNull();
      expect(expert.content.line.pts).toBeGreaterThan(0);
    }
  });
});
