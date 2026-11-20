import { describe, expect, it } from "vitest";
import { DIFFICULTIES, ERAS } from "../core/types";
import { ds, ERA_FILTERS, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("box-score specifics", () => {
  for (const era of ERA_FILTERS) {
    it(`${era}: shows the line and game of a box score row`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, "hard", seed, new Set(), era);
        if (q.content.mode !== "box-score" || q.answerKey.kind !== "player") throw new Error("shape");
        const line = ds.getBoxScores().find((l) => `bs:${l.id}` === q.key);
        expect(line?.playerId).toBe(q.answerKey.playerId);
        expect(q.content.line.pts).toBe(line?.pts);
        expect(q.content.game?.date).toBe(line?.gameDate);
        expect(q.content.game?.teamId).toBe(line?.teamId);
      }
    });

    it(`${era}: hides the game (date, teams, score) only at Expert`, () => {
      for (const seed of SEEDS) {
        const expert = generate(engine, "expert", seed, new Set(), era);
        if (expert.content.mode !== "box-score") throw new Error("shape");
        expect(expert.content.game).toBeNull();
        expect(expert.content.line.pts).toBeGreaterThan(0);
      }
    });
  }

  for (const era of ERAS) {
    it(`${era}: every difficulty uses only lines of players of the era`, () => {
      const lines = new Set<string>();
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed, new Set(), era);
          const line = ds.getBoxScores().find((l) => `bs:${l.id}` === q.key);
          expect(ds.getPlayer(line?.playerId ?? "")?.active).toBe(era === "current");
          lines.add(q.key);
        }
      }
      expect(lines.size).toBeGreaterThan(1);
    });
  }
});
