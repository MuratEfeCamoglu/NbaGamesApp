import { describe, expect, it } from "vitest";
import { readTeamColorTokens, validateSeedFiles } from "./validate-data";

const meta = { snapshotDate: "2026-11-19", source: "fixture", endpoints: ["fixture"] };
const team = (id: string) => ({
  id,
  name: id,
  city: id,
  franchiseId: id,
  conference: "East" as const,
  primaryColor: "#000000",
  secondaryColor: "#FFFFFF",
});
const player = (id: string) => ({
  id,
  name: `P${id}`,
  position: "G",
  fameTier: 3,
  allStarCount: 0,
  active: true,
  headshotId: id,
});

function files() {
  return {
    "teams.json": { meta, items: [team("BOS"), team("XYZ")] },
    "players.json": { meta, items: [player("1"), player("2")] },
    "rosters.json": {
      meta,
      items: [
        { playerId: "1", teamId: "BOS", season: "2000-01" },
        { playerId: "9", teamId: "BOS", season: "2000-01" },
      ],
    },
    "starting-fives.json": { meta, items: [] },
    "career-stints.json": {
      meta,
      items: [
        { playerId: "1", teamId: "BOS", fromSeason: "2000-01", toSeason: "2001-02", order: 1 },
        { playerId: "1", teamId: "XYZ", fromSeason: "2002-03", toSeason: "2003-04", order: 3 },
      ],
    },
    "career-stats.json": { meta, items: [] },
    "box-scores.json": { meta, items: [] },
    "leaderboards.json": { meta, items: [] },
  };
}

describe("validateSeedFiles", () => {
  const tokens = readTeamColorTokens("--color-team-bos: #007a33;\n--color-team-bos-fg: #ffffff;");

  it("reads team color tokens", () => {
    expect([...tokens]).toEqual(["bos"]);
  });

  it("reports minimums, integrity, stint order and missing color tokens", () => {
    const { errors, counts } = validateSeedFiles(files(), tokens);
    expect(counts["players.json"]).toBe(2);
    expect(errors).toContain("players.json: 2 items, minimum is 150");
    expect(errors.some((e) => e.includes("unknown playerId 9"))).toBe(true);
    expect(errors.some((e) => e.includes("not contiguous"))).toBe(true);
    expect(errors.some((e) => e.includes("no --color-team-xyz token"))).toBe(true);
  });

  it("reports missing files and schema errors", () => {
    const f: Record<string, unknown> = files();
    delete f["leaderboards.json"];
    f["teams.json"] = { meta, items: [{ id: "bad" }] };
    const { errors } = validateSeedFiles(f, tokens);
    expect(errors).toContain("leaderboards.json: file missing");
    expect(errors.some((e) => e.startsWith("teams.json: items.0"))).toBe(true);
  });
});
