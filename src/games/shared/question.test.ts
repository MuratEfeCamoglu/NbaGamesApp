import { describe, expect, it } from "vitest";
import { DIFFICULTY_RULES } from "../core/difficulty";
import { createRng } from "../core/rng";
import { DIFFICULTIES, ERAS } from "../core/types";
import { createFixtureDataSource } from "../test-fixtures";
import { buildOptions, getPool, getPoolIds, positionGroup, teamDisplayName } from "./question";

const ds = createFixtureDataSource();

describe("getPool", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: "all" is the fame-tier pool; the eras split it by Player.active`, () => {
      const tierPool = ds.getPlayers({ maxFameTier: DIFFICULTY_RULES[difficulty].maxFameTier });
      expect(getPool(ds, difficulty)).toEqual(tierPool);
      expect(getPool(ds, difficulty, "all")).toEqual(tierPool);
      const current = getPool(ds, difficulty, "current");
      const retired = getPool(ds, difficulty, "retired");
      expect(current.every((p) => p.active)).toBe(true);
      expect(retired.every((p) => !p.active)).toBe(true);
      expect(current.length + retired.length).toBe(tierPool.length);
      expect(getPoolIds(ds, difficulty, "current")).toEqual(new Set(current.map((p) => p.id)));
    });
  }
});

describe("positionGroup", () => {
  it.each([
    ["G", "G"],
    ["PG", "G"],
    ["G-F", "G"],
    ["SF", "F"],
    ["F-C", "F"],
    ["C", "C"],
    ["C-F", "C"],
    ["", "F"],
  ])("%s -> %s", (input, group) => expect(positionGroup(input)).toBe(group));
});

describe("buildOptions", () => {
  it("returns null for search difficulties", () => {
    expect(buildOptions(ds, "hard", "2544", createRng(1))).toBeNull();
    expect(buildOptions(ds, "expert", "2544", createRng(1))).toBeNull();
  });

  it("prefers distractors from the answer's position group", () => {
    // Plenty of tier-1 guards exist, so every Easy distractor for Curry should be a guard.
    for (let seed = 0; seed < 50; seed++) {
      const options = buildOptions(ds, "easy", "201939", createRng(seed)) ?? [];
      expect(options).toHaveLength(4);
      for (const o of options) expect(positionGroup(ds.getPlayer(o.id)?.position ?? "")).toBe("G");
    }
  });

  it("never offers avoided players", () => {
    const avoid = new Set(["202691", "203110"]);
    for (let seed = 0; seed < 50; seed++) {
      const options = buildOptions(ds, "medium", "201939", createRng(seed), avoid) ?? [];
      expect(options.some((o) => avoid.has(o.id))).toBe(false);
    }
  });

  for (const era of ERAS) {
    it(`${era}: distractors come only from the era's pool`, () => {
      // Stephen Curry (active) / Kobe Bryant (retired): both guards, so position preference applies too.
      const answerId = era === "current" ? "201939" : "977";
      for (const difficulty of ["easy", "medium"] as const) {
        for (let seed = 0; seed < 50; seed++) {
          const options = buildOptions(ds, difficulty, answerId, createRng(seed), new Set(), era) ?? [];
          expect(options).toHaveLength(DIFFICULTY_RULES[difficulty].optionCount ?? -1);
          expect(options.map((o) => o.id)).toContain(answerId);
          for (const o of options) expect(ds.getPlayer(o.id)?.active).toBe(era === "current");
        }
      }
    });
  }

  it("default era offers players of both eras", () => {
    const seen = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      for (const o of buildOptions(ds, "medium", "201939", createRng(seed)) ?? []) seen.add(ds.getPlayer(o.id)?.active ?? false);
    }
    expect(seen).toEqual(new Set([true, false]));
  });
});

describe("teamDisplayName", () => {
  it("returns the full team name and falls back to the id", () => {
    expect(teamDisplayName(ds, "GSW")).toBe("Golden State Warriors");
    expect(teamDisplayName(ds, "XXX")).toBe("XXX");
  });
});
