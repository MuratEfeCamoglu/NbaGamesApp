import { describe, expect, it } from "vitest";
import { TEAMMATES_SHOWN } from "../core/difficulty";
import { DIFFICULTIES } from "../core/types";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine, identifiesUniquely } from "./engine";

runEngineContract(engine);

describe("teammate-challenge specifics", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: shows ${TEAMMATES_SHOWN[difficulty]} real teammates that identify the target uniquely`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, difficulty, seed);
        if (q.content.mode !== "teammate-challenge" || q.answerKey.kind !== "player") throw new Error("shape");
        const targetId = q.answerKey.playerId;
        const shown = q.content.teammates;
        expect(shown).toHaveLength(TEAMMATES_SHOWN[difficulty]);
        expect(new Set(shown.map((t) => t.player.id)).size).toBe(shown.length);

        for (const t of shown) {
          expect(t.player.id).not.toBe(targetId);
          expect(t.player.teamId).toBe(t.teamId);
          // ISKELET F3: every shown name shares a RosterEntry (team + season) with the target.
          const shared = ds
            .getRosterEntries(targetId)
            .filter((e) => e.teamId === t.teamId && (t.season === null || e.season === t.season))
            .some((e) => ds.getTeammates(targetId, e.teamId, e.season).some((m) => m.id === t.player.id));
          expect(shared).toBe(true);
        }
        expect(identifiesUniquely(ds, targetId, shown.map((t) => ({ mate: t.player })))).toBe(true);

        if (difficulty === "expert") expect(shown.every((t) => t.season === null)).toBe(true);
        else expect(shown.every((t) => t.season !== null)).toBe(true);
        expect(q.options?.some((o) => shown.some((t) => t.player.id === o.id)) ?? false).toBe(false);
      }
    });
  }

  it("identifiesUniquely rejects a clue set shared by another player", () => {
    // Curry and Klay Thompson were both teammates of Draymond Green and Andre Iguodala (GSW).
    expect(identifiesUniquely(ds, "203110", [{ mate: { id: "201939" } }, { mate: { id: "202691" } }])).toBe(false);
  });
});
