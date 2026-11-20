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

  it("requires active-player and all-time leaderboards (F16) and only active players in active lists", () => {
    const board = (id: string, scope: "active" | "all-time", ids: string[]) => ({
      id,
      title: id,
      statLabel: "PTS",
      asOf: "2026-11-20",
      rows: ids.map((playerId, i) => ({ rank: i + 1, playerId, value: 100 - i })),
      source: "fixture",
      scope,
    });
    const ten = (first: string) => [first, ...Array.from({ length: 9 }, (_, i) => `${10 + i}`)];
    const f = files();
    f["players.json"].items = [
      player("1"),
      { ...player("2"), active: false },
      ...Array.from({ length: 9 }, (_, i) => player(`${10 + i}`)),
    ];
    f["leaderboards.json"].items = [
      board("active-pts", "active", ten("2")),
      board("career-pts", "all-time", ten("1")),
      board("dup", "all-time", ["1", "1", ...ten("2").slice(2)]),
    ] as never[];
    const { errors } = validateSeedFiles(f, tokens);
    expect(errors).toContain(
      'leaderboards.json: 1 active-player lists (scope "active"), minimum is 6',
    );
    expect(errors).toContain("leaderboards.json: 2 all-time lists, minimum is 8");
    expect(errors).toContain("leaderboards.json: active-pts rank 1: player 2 is not active");
    expect(errors).toContain("leaderboards.json: duplicate dup player 1");
    expect(errors.some((e) => e.includes("career-pts") && e.includes("not active"))).toBe(false);
  });

  it("treats a leaderboard without scope as all-time", () => {
    const f = files();
    f["leaderboards.json"].items = [
      {
        id: "legacy",
        title: "Legacy",
        statLabel: "PTS",
        asOf: "2026-11-19",
        rows: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, playerId: "1", value: 10 - i })),
        source: "fixture",
      },
    ] as never[];
    const { errors } = validateSeedFiles(f, tokens);
    expect(errors).toContain("leaderboards.json: 1 all-time lists, minimum is 8");
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
