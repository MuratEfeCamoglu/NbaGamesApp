import { describe, expect, it } from "vitest";
import { createStaticDataSource, normalizeName, type SeedFiles } from "./build-source";

const meta = { snapshotDate: "2026-11-19", source: "test fixture", endpoints: ["fixture"] };
const team = (id: string, franchiseId = id) => ({
  id,
  name: `${id} Team`,
  city: id,
  franchiseId,
  conference: "West" as const,
  primaryColor: "#000000",
  secondaryColor: "#FFFFFF",
});
const player = (id: string, name: string, fameTier: 1 | 2 | 3) => ({
  id,
  name,
  position: "G",
  fameTier,
  allStarCount: fameTier === 1 ? 5 : 0,
  active: false,
  headshotId: id,
});

function fixture(): SeedFiles {
  return {
    "teams.json": { meta, items: [team("OKC"), team("SEA", "OKC"), team("DEN")] },
    "players.json": {
      meta,
      items: [
        player("1", "Nikola Jokić", 1),
        player("2", "Nick Collison", 2),
        player("3", "Kevin Durant", 1),
        player("4", "Jeff Green", 3),
        player("5", "Nikola Pekovic", 3),
      ],
    },
    "rosters.json": {
      meta,
      items: [
        { playerId: "3", teamId: "SEA", season: "2007-08" },
        { playerId: "2", teamId: "SEA", season: "2007-08" },
        { playerId: "4", teamId: "SEA", season: "2007-08" },
        { playerId: "3", teamId: "OKC", season: "2008-09" },
        { playerId: "1", teamId: "DEN", season: "2015-16" },
      ],
    },
    "starting-fives.json": {
      meta,
      items: [
        {
          id: "SEA-2007-08",
          teamId: "SEA",
          season: "2007-08",
          playerIds: ["1", "2", "3", "4", "5"],
          minutes: 300,
          source: "f",
        },
      ],
    },
    "career-stints.json": {
      meta,
      items: [
        { playerId: "3", teamId: "OKC", fromSeason: "2008-09", toSeason: "2015-16", order: 2 },
        { playerId: "3", teamId: "SEA", fromSeason: "2007-08", toSeason: "2007-08", order: 1 },
        { playerId: "1", teamId: "DEN", fromSeason: "2015-16", toSeason: "2025-26", order: 1 },
      ],
    },
    "career-stats.json": {
      meta,
      items: [
        {
          playerId: "3",
          games: 1100,
          seasons: 17,
          ppg: 27.2,
          rpg: 7,
          apg: 4.4,
          spg: 1.1,
          bpg: 1.1,
          fgPct: 50.1,
          source: "f",
        },
      ],
    },
    "box-scores.json": { meta, items: [] },
    "leaderboards.json": { meta, items: [] },
  };
}

describe("createStaticDataSource", () => {
  const ds = createStaticDataSource(fixture());

  it("exposes meta, teams and players", () => {
    expect(ds.meta.snapshotDate).toBe("2026-11-19");
    expect(ds.getTeams()).toHaveLength(3);
    expect(ds.getTeam("SEA")?.franchiseId).toBe("OKC");
    expect(ds.getTeam("XXX")).toBeUndefined();
    expect(ds.getPlayer("3")?.name).toBe("Kevin Durant");
    expect(ds.getPlayer("999")).toBeUndefined();
  });

  it("filters players by fame tier", () => {
    expect(ds.getPlayers()).toHaveLength(5);
    expect(ds.getPlayers({ maxFameTier: 1 }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(ds.getPlayers({ maxFameTier: 2 }).map((p) => p.id)).toEqual(["1", "2", "3"]);
  });

  it("searches accent- and case-insensitively, prefix and famous first", () => {
    expect(ds.searchPlayers("JOKIC").map((p) => p.id)).toEqual(["1"]);
    expect(ds.searchPlayers("jokić").map((p) => p.id)).toEqual(["1"]);
    // "nik" is a prefix for both Nikolas; tier 1 before tier 3
    expect(ds.searchPlayers("nik").map((p) => p.id)).toEqual(["1", "5"]);
    // prefix matches (word start) before inner substring matches
    // (Kevin Durant is tier 1 but only an inner match for "n")
    expect(ds.searchPlayers("n").map((p) => p.id)).toEqual(["1", "2", "5", "3", "4"]);
    expect(ds.searchPlayers("n", 2)).toHaveLength(2);
    expect(ds.searchPlayers("   ")).toEqual([]);
    expect(ds.searchPlayers("zzz")).toEqual([]);
  });

  it("returns starting fives, stints sorted by order and the multi-team filter", () => {
    expect(ds.getStartingFives()).toHaveLength(1);
    expect(ds.getCareerStints("3").map((s) => s.teamId)).toEqual(["SEA", "OKC"]);
    expect(ds.getCareerStints("2")).toEqual([]);
    expect(ds.getPlayersWithStints(2).map((p) => p.id)).toEqual(["3"]);
    expect(ds.getPlayersWithStints(1).map((p) => p.id)).toEqual(["1", "3"]);
  });

  it("returns career stats", () => {
    expect(ds.getCareerStats("3")?.ppg).toBe(27.2);
    expect(ds.getCareerStats("1")).toBeUndefined();
    expect(ds.getPlayersWithCareerStats().map((p) => p.id)).toEqual(["3"]);
  });

  it("returns roster entries and teammates excluding the player", () => {
    expect(ds.getRosterEntries("3")).toHaveLength(2);
    expect(
      ds
        .getTeammates("3", "SEA", "2007-08")
        .map((p) => p.id)
        .sort(),
    ).toEqual(["2", "4"]);
    expect(ds.getTeammates("3", "OKC", "2008-09")).toEqual([]);
  });

  it("returns box scores and leaderboards", () => {
    expect(ds.getBoxScores()).toEqual([]);
    expect(ds.getLeaderboards()).toEqual([]);
  });

  it("rejects invalid seed data", () => {
    const bad = fixture();
    bad["players.json"] = { meta, items: [{ id: "x" }] };
    expect(() => createStaticDataSource(bad)).toThrow(/players\.json/);
  });
});

describe("normalizeName", () => {
  it("strips diacritics and case", () => {
    expect(normalizeName("  Luka  Dončić ")).toBe("luka doncic");
  });
});
