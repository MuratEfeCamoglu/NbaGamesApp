import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createFixtureDataSource } from "../test-fixtures";
import { buildOptions, positionGroup, teamDisplayName } from "./question";

const ds = createFixtureDataSource();

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
});

describe("teamDisplayName", () => {
  it("returns the full team name and falls back to the id", () => {
    expect(teamDisplayName(ds, "GSW")).toBe("Golden State Warriors");
    expect(teamDisplayName(ds, "XXX")).toBe("XXX");
  });
});
