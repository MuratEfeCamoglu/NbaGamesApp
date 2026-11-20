import { describe, expect, it } from "vitest";
import type { StartingFive } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { CURRENT_ERA_LINEUP_SEASONS } from "../core/difficulty";
import { createRng } from "../core/rng";
import { DIFFICULTIES, ERAS, type Difficulty, type EraFilter, type GeneratedQuestion } from "../core/types";
import { ds, ERA_FILTERS, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { currentEraSeasons, engine } from "./engine";

runEngineContract(engine);

function lineupOf(q: GeneratedQuestion, source: NbaDataSource = ds): StartingFive {
  const lineup = source.getStartingFives().find((l) => l.id === q.key.split(":")[1]);
  if (!lineup) throw new Error(`no lineup for ${q.key}`);
  return lineup;
}

function answerOf(q: GeneratedQuestion): string {
  if (q.answerKey.kind !== "player") throw new Error("shape");
  return q.answerKey.playerId;
}

/** Every question one RNG stream yields until the engine runs dry (each lineup at most once). */
function exhaust(source: NbaDataSource, difficulty: Difficulty, era: EraFilter): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const keys = new Set<string>();
  const rng = createRng(1);
  for (let q = engine.generateQuestion(source, difficulty, rng, keys, era); q; q = engine.generateQuestion(source, difficulty, rng, keys, era)) {
    out.push(q);
    keys.add(q.key);
  }
  return out;
}

/** Independent of the engine: the newest CURRENT_ERA_LINEUP_SEASONS distinct seasons. */
function latestSeasons(source: NbaDataSource): Set<string> {
  const seasons = [...new Set(source.getStartingFives().map((l) => l.season))].sort();
  return new Set(seasons.slice(-CURRENT_ERA_LINEUP_SEASONS));
}

describe("starting-five specifics", () => {
  for (const era of ERA_FILTERS) {
    it(`${era}: shows the 4 other starters of a real lineup; the answer is the missing one`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, "medium", seed, new Set(), era);
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

    it(`${era}: hides the season only at Expert`, () => {
      for (const seed of SEEDS) {
        const hard = generate(engine, "hard", seed, new Set(), era);
        const expert = generate(engine, "expert", seed, new Set(), era);
        if (hard.content.mode !== "starting-five" || expert.content.mode !== "starting-five") throw new Error("shape");
        expect(hard.content.season).toMatch(/^\d{4}-\d{2}$/);
        expect(expert.content.season).toBeNull();
        expect(expert.content.teamName.length).toBeGreaterThan(0);
      }
    });
  }

  it("does not reuse a lineup already used in the session", () => {
    const first = generate(engine, "hard", 3);
    const lineupId = first.key.split(":")[1];
    for (const seed of SEEDS) {
      const q = generate(engine, "hard", seed, new Set([first.key]));
      expect(q.key.split(":")[1]).not.toBe(lineupId);
    }
  });
});

describe("starting-five eras (ISKELET F16)", () => {
  it(`the current era is the latest ${CURRENT_ERA_LINEUP_SEASONS} seasons of the data`, () => {
    expect([...currentEraSeasons(ds)].sort()).toEqual(["2023-24", "2024-25", "2025-26"]);
    expect(new Set(currentEraSeasons(ds))).toEqual(latestSeasons(ds));
  });

  for (const era of ERAS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${era}/${difficulty}: lineups from the era's seasons, missing player of the era`, () => {
        const current = latestSeasons(ds);
        const lineups = new Set<string>();
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed, new Set(), era);
          const lineup = lineupOf(q);
          expect(current.has(lineup.season), `${lineup.id} in era ${era}`).toBe(era === "current");
          expect(ds.getPlayer(answerOf(q))?.active).toBe(era === "current");
          lineups.add(lineup.id);
        }
        expect(lineups.size).toBeGreaterThan(1);
      });
    }
  }

  it("may show a retired starter in a current lineup, but never asks for one", () => {
    // MIL 2023-24 includes Malik Beasley, who is not active in the snapshot.
    const asked = exhaust(ds, "hard", "current").filter((q) => lineupOf(q).id === "MIL-2023-24");
    expect(asked).toHaveLength(1);
    const q = asked[0];
    if (!q || q.content.mode !== "starting-five") throw new Error("shape");
    expect(answerOf(q)).not.toBe("1627736");
    expect(q.content.players.map((p) => p.id)).toContain("1627736");
  });

  it("treats an older opening-night lineup (boxscoretraditionalv3) like any retired-era lineup", () => {
    const openingNight: StartingFive = {
      id: "LAL-2003-04",
      teamId: "LAL",
      season: "2003-04",
      playerIds: ["56", "977", "965", "252", "406"],
      minutes: 0,
      source: "boxscoretraditionalv3",
    };
    const source: NbaDataSource = { ...ds, getStartingFives: () => [openingNight, ...ds.getStartingFives()] };
    expect(currentEraSeasons(source)).toEqual(currentEraSeasons(ds));
    expect(exhaust(source, "hard", "retired").some((q) => lineupOf(q, source).id === "LAL-2003-04")).toBe(true);
    expect(exhaust(source, "hard", "current").some((q) => lineupOf(q, source).id === "LAL-2003-04")).toBe(false);
  });

  it("moves the window when a newer season appears", () => {
    const newer: StartingFive = {
      id: "GSW-2026-27",
      teamId: "GSW",
      season: "2026-27",
      playerIds: ["201939", "202710", "203110", "1630541", "1641764"],
      minutes: 0,
      source: "test-fixture",
    };
    const source: NbaDataSource = { ...ds, getStartingFives: () => [...ds.getStartingFives(), newer] };
    expect([...currentEraSeasons(source)].sort()).toEqual(["2024-25", "2025-26", "2026-27"]);
    const current = exhaust(source, "hard", "current").map((q) => lineupOf(q, source));
    expect(current.some((l) => l.id === "GSW-2026-27")).toBe(true);
    expect(current.every((l) => l.season >= "2024-25")).toBe(true);
    // 2023-24 is now retired-era: its only retired starter (Malik Beasley, MIL) becomes askable.
    const retired = exhaust(source, "hard", "retired");
    expect(retired.some((q) => q.key === "sf:MIL-2023-24:1627736")).toBe(true);
  });
});
