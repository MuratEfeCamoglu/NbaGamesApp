import { describe, expect, it } from "vitest";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

describe("starting-five specifics", () => {
  it("shows the 4 other starters of a real lineup; the answer is the missing one", () => {
    for (const seed of SEEDS) {
      const q = generate(engine, "medium", seed);
      if (q.content.mode !== "starting-five" || q.answerKey.kind !== "player") throw new Error("shape");
      const content = q.content;
      const answerId = q.answerKey.playerId;
      const shown = content.players.map((p) => p.id);
      const lineup = ds.getStartingFives().find((l) => l.teamId === content.teamId && l.season === content.season);
      expect(lineup).toBeDefined();
      expect(shown).toHaveLength(4);
      expect([...shown, answerId].sort()).toEqual([...(lineup?.playerIds ?? [])].sort());
      expect(content.players.every((p) => p.teamId === content.teamId)).toBe(true);
      expect(content.missingPosition).toBe(ds.getPlayer(answerId)?.position);
      expect(q.options?.some((o) => shown.includes(o.id))).toBe(false);
    }
  });

  it("hides the season only at Expert", () => {
    for (const seed of SEEDS) {
      const hard = generate(engine, "hard", seed);
      const expert = generate(engine, "expert", seed);
      if (hard.content.mode !== "starting-five" || expert.content.mode !== "starting-five") throw new Error("shape");
      expect(hard.content.season).toMatch(/^\d{4}-\d{2}$/);
      expect(expert.content.season).toBeNull();
      expect(expert.content.teamName.length).toBeGreaterThan(0);
    }
  });

  it("does not reuse a lineup already used in the session", () => {
    const first = generate(engine, "hard", 3);
    const lineupId = first.key.split(":")[1];
    for (const seed of SEEDS) {
      const q = generate(engine, "hard", seed, new Set([first.key]));
      expect(q.key.split(":")[1]).not.toBe(lineupId);
    }
  });
});
