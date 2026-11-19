import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStaticDataSource } from "@/data/build-source";
import { seedFileSchemas, type CareerStint, type SeedFileName } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { createRng } from "../core/rng";
import { DIFFICULTIES, type Difficulty, type GeneratedQuestion } from "../core/types";
import { ds, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { seasonLabel } from "../test-fixtures";
import { engine, getJourneyIndex, mergeFranchiseStints } from "./engine";

runEngineContract(engine);

function shownTeams(q: GeneratedQuestion): string[] {
  if (q.content.mode !== "team-journey") throw new Error("shape");
  return q.content.stints.map((s) => s.teamId);
}

function answerOf(q: GeneratedQuestion | null): string {
  if (!q || q.answerKey.kind !== "player") throw new Error("shape");
  return q.answerKey.playerId;
}

/** Fixture data source with some players' stints replaced. */
function withStints(base: NbaDataSource, overrides: Record<string, [string, number, number][]>): NbaDataSource {
  const stintsOf = (playerId: string): readonly CareerStint[] => {
    const rows = overrides[playerId];
    if (!rows) return base.getCareerStints(playerId);
    return rows.map(([teamId, from, to], i) => ({
      playerId,
      teamId,
      fromSeason: seasonLabel(from),
      toSeason: seasonLabel(to),
      order: i + 1,
    }));
  };
  return {
    ...base,
    getCareerStints: stintsOf,
    getPlayersWithStints: (minTeams) =>
      base.getPlayers().filter((p) => new Set(stintsOf(p.id).map((s) => s.teamId)).size >= minTeams),
  };
}

function generateOn(source: NbaDataSource, difficulty: Difficulty, seed: number): GeneratedQuestion | null {
  return engine.generateQuestion(source, difficulty, createRng(seed), new Set());
}

describe("team-journey specifics", () => {
  it("shows ≥2 franchises in career order (same-franchise stints merged) with formatted years", () => {
    for (const seed of SEEDS) {
      const q = generate(engine, "hard", seed);
      if (q.content.mode !== "team-journey") throw new Error("shape");
      const id = answerOf(q);
      const merged = mergeFranchiseStints(ds, ds.getCareerStints(id));
      const franchises = new Set(q.content.stints.map((s) => ds.getTeam(s.teamId)?.franchiseId));
      expect(franchises.size).toBeGreaterThanOrEqual(2);
      expect(shownTeams(q)).toEqual(merged.map((s) => s.teamId));
      for (const s of q.content.stints) expect(s.years).toMatch(/^\d{4}–\d{2}$/);
      expect(q.content.allStarCount).toBe(ds.getPlayer(id)?.allStarCount);
    }
  });

  it("hides years, seasons and All-Star count only at Expert", () => {
    for (const seed of SEEDS) {
      const expert = generate(engine, "expert", seed);
      if (expert.content.mode !== "team-journey") throw new Error("shape");
      expect(expert.content.stints.every((s) => s.years === null)).toBe(true);
      expect(expert.content.seasons).toBeNull();
      expect(expert.content.allStarCount).toBeNull();
    }
  });

  it("formats the first Cleveland stint of LeBron James as 2003–10", () => {
    let found = 0;
    for (const seed of SEEDS) {
      const q = generate(engine, "easy", seed);
      if (answerOf(q) === "2544" && q.content.mode === "team-journey") {
        expect(q.content.stints[0]).toEqual({ teamId: "CLE", years: "2003–10" });
        expect(shownTeams(q)).toEqual(["CLE", "MIA", "CLE", "LAL"]);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("merges a relocation (SEA→OKC) into one stint with the later abbreviation and spanning years", () => {
    // Kevin Durant: SEA 2007-08, OKC 2008-16 → OKC 2007–16.
    const merged = mergeFranchiseStints(ds, ds.getCareerStints("201142"));
    expect(merged[0]).toEqual({ teamId: "OKC", fromSeason: "2007-08", toSeason: "2015-16" });
    expect(merged.map((s) => s.teamId)).toEqual(["OKC", "GSW", "BKN", "PHX", "HOU"]);
    let found = 0;
    for (const seed of SEEDS) {
      const q = generate(engine, "medium", seed);
      if (answerOf(q) !== "201142" || q.content.mode !== "team-journey") continue;
      expect(q.content.stints[0]).toEqual({ teamId: "OKC", years: "2007–16" });
      found++;
    }
    expect(found).toBeGreaterThan(0);
  });

  it("never asks about a player whose only team changes are franchise renames", () => {
    // Kobe Bryant (tier 1) re-written as NJN → BKN → NJN: one franchise, two abbreviations.
    const source = withStints(ds, {
      "977": [
        ["NJN", 2005, 2011],
        ["BKN", 2012, 2013],
        ["NJN", 2014, 2015],
      ],
    });
    expect(source.getPlayersWithStints(2).some((p) => p.id === "977")).toBe(true);
    expect(getJourneyIndex(source).journeys.has("977")).toBe(false);
    for (const d of DIFFICULTIES) {
      for (const seed of SEEDS) expect(answerOf(generateOn(source, d, seed))).not.toBe("977");
    }
  });

  it("never picks a player at Expert whose team sequence is shared, but may with distinct years", () => {
    // Tim Duncan (tier 1) gets Chris Bosh's team sequence (TOR → MIA) with different years.
    const source = withStints(ds, {
      "1495": [
        ["TOR", 1997, 2005],
        ["MIA", 2006, 2015],
      ],
    });
    const index = getJourneyIndex(source);
    expect(index.uniqueSequence.has("1495")).toBe(false);
    expect(index.uniqueSequence.has("2547")).toBe(false);
    expect(index.uniqueWithYears.has("1495")).toBe(true);
    expect(index.uniqueWithYears.has("2547")).toBe(true);

    const easyAnswers = new Set<string>();
    for (const seed of SEEDS) {
      expect(["1495", "2547"]).not.toContain(answerOf(generateOn(source, "expert", seed)));
      easyAnswers.add(answerOf(generateOn(source, "easy", seed)));
    }
    expect(easyAnswers.has("1495") || easyAnswers.has("2547")).toBe(true);
  });

  it("never picks a player whose sequence AND years are shared at any difficulty", () => {
    const source = withStints(ds, {
      "1495": [
        ["TOR", 2003, 2009],
        ["MIA", 2010, 2015],
      ],
    });
    for (const d of DIFFICULTIES) {
      for (const seed of SEEDS) expect(["1495", "2547"]).not.toContain(answerOf(generateOn(source, d, seed)));
    }
  });
});

describe("team-journey on the real seed", () => {
  const root = path.join(process.cwd(), "src/data/seed");
  const files = Object.fromEntries(
    (Object.keys(seedFileSchemas) as SeedFileName[]).map((n) => [
      n,
      JSON.parse(readFileSync(path.join(root, n), "utf8")),
    ]),
  ) as Record<SeedFileName, unknown>;
  const real = createStaticDataSource(files);

  it("the Expert journey (team sequence only) identifies exactly one player for 200 seeds", () => {
    // Independent count over every ≥2-franchise journey in the seed.
    const sequences = new Map<string, number>();
    for (const p of real.getPlayersWithStints(2)) {
      const journey = mergeFranchiseStints(real, real.getCareerStints(p.id));
      if (new Set(journey.map((s) => real.getTeam(s.teamId)?.franchiseId ?? s.teamId)).size < 2) continue;
      const key = journey.map((s) => s.teamId).join(">");
      sequences.set(key, (sequences.get(key) ?? 0) + 1);
    }
    for (let seed = 0; seed < 200; seed++) {
      const q = engine.generateQuestion(real, "expert", createRng(`tj-unique:${seed}`), new Set());
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(sequences.get(shownTeams(q).join(">"))).toBe(1);
    }
  });

  it("never shows two consecutive stints of the same franchise", () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = engine.generateQuestion(real, "hard", createRng(`tj-merge:${seed}`), new Set());
      expect(q).not.toBeNull();
      if (!q) continue;
      const teams = shownTeams(q);
      for (let i = 1; i < teams.length; i++) {
        expect(real.getTeam(teams[i] ?? "")?.franchiseId).not.toBe(real.getTeam(teams[i - 1] ?? "")?.franchiseId);
      }
    }
  });
});
