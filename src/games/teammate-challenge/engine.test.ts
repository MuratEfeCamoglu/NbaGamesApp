import { describe, expect, it } from "vitest";
import { TEAMMATES_SHOWN } from "../core/difficulty";
import { DIFFICULTIES } from "../core/types";
import { ds, ERA_FILTERS, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { matchesEra } from "../shared/era";
import { engine, identifiesUniquely } from "./engine";

runEngineContract(engine);

describe("teammate-challenge specifics", () => {
  for (const era of ERA_FILTERS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${era}/${difficulty}: shows ${TEAMMATES_SHOWN[difficulty]} real teammates that identify the target uniquely`, () => {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed, new Set(), era);
          if (q.content.mode !== "teammate-challenge" || q.answerKey.kind !== "player") throw new Error("shape");
          const targetId = q.answerKey.playerId;
          const target = ds.getPlayer(targetId);
          expect(target && matchesEra(target, era)).toBe(true);
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
          // Era-independent: no player of EITHER era besides the target played with every clue.
          expect(identifiesUniquely(ds, targetId, shown.map((t) => ({ mate: t.player })))).toBe(true);

          if (difficulty === "expert") expect(shown.every((t) => t.season === null)).toBe(true);
          else expect(shown.every((t) => t.season !== null)).toBe(true);
          expect(q.options?.some((o) => shown.some((t) => t.player.id === o.id)) ?? false).toBe(false);
        }
      });
    }
  }

  it("identifiesUniquely rejects a clue set shared by another player", () => {
    // Curry and Klay Thompson were both teammates of Draymond Green and Andre Iguodala (GSW).
    expect(identifiesUniquely(ds, "203110", [{ mate: { id: "201939" } }, { mate: { id: "202691" } }])).toBe(false);
  });

  it("identifiesUniquely counts a co-candidate of the other era", () => {
    // Shaquille O'Neal + D'Angelo Russell: both were teammates of LeBron James (active) AND Kobe Bryant
    // (retired) — and of no one else. A current-era question about LeBron must not use this set,
    // because "Kobe Bryant" typed into the search box would fit the clues just as well.
    const clues = [{ mate: { id: "406" } }, { mate: { id: "1626156" } }];
    expect(identifiesUniquely(ds, "2544", clues)).toBe(false);
    expect(identifiesUniquely(ds, "977", clues)).toBe(false);
    for (const seed of SEEDS) {
      for (const difficulty of DIFFICULTIES) {
        const q = generate(engine, difficulty, seed, new Set(), "current");
        if (q.content.mode !== "teammate-challenge") throw new Error("shape");
        const shown = new Set(q.content.teammates.map((t) => t.player.id));
        expect(shown.has("406") && shown.has("1626156") && shown.size === 2).toBe(false);
      }
    }
  });
});
