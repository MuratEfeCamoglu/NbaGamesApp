// Loads the committed NBA API snapshot and checks it against ISKELET §2.2 minimums.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStaticDataSource, type SeedFiles } from "./build-source";
import { seedFileSchemas, seedMinimums, type SeedFileName } from "./schema";

const dir = path.join(process.cwd(), "src", "data", "seed");
const files = Object.fromEntries(
  (Object.keys(seedFileSchemas) as SeedFileName[]).map((n) => [
    n,
    JSON.parse(readFileSync(path.join(dir, n), "utf8")),
  ]),
) as SeedFiles;
const ds = createStaticDataSource(files);

describe("seed snapshot", () => {
  it("meets every seedMinimums count", () => {
    for (const name of Object.keys(seedMinimums) as SeedFileName[]) {
      const items = (files[name] as { items: unknown[] }).items;
      expect(items.length, name).toBeGreaterThanOrEqual(seedMinimums[name]);
    }
  });

  it("meets the per-mode acceptance minimums (ISKELET §2.2)", () => {
    expect(ds.getStartingFives().length).toBeGreaterThanOrEqual(40); // F1
    expect(ds.getPlayersWithStints(2).length).toBeGreaterThanOrEqual(60); // F2
    expect(ds.getPlayersWithCareerStats().length).toBeGreaterThanOrEqual(120); // F4
    expect(ds.getBoxScores().length).toBeGreaterThanOrEqual(40); // F5
    expect(ds.getLeaderboards().length).toBeGreaterThanOrEqual(8); // F6
    expect(ds.getPlayers({ maxFameTier: 1 }).length).toBeGreaterThan(0);
  });

  it("finds well-known players with accent-insensitive search", () => {
    expect(ds.searchPlayers("jokic").some((p) => p.name.includes("Joki"))).toBe(true);
    expect(ds.searchPlayers("LeBron")[0]?.name).toBe("LeBron James");
  });

  it("every starting five player has teammates on that team-season roster", () => {
    for (const five of ds.getStartingFives()) {
      const [first, ...rest] = five.playerIds;
      const mates = new Set(ds.getTeammates(first!, five.teamId, five.season).map((p) => p.id));
      for (const id of rest) expect(mates.has(id), `${five.id} ${id}`).toBe(true);
    }
  });
});

// Era split (ISKELET F16): Current = active players and the latest lineup seasons,
// Retired = everyone else. Mirrors CURRENT_ERA_LINEUP_SEASONS in src/games/core/difficulty.ts
// (src/data must not import from src/games).
const CURRENT_LINEUP_SEASONS = 3;

describe("seed snapshot — era split (F16)", () => {
  const isActive = (id: string) => ds.getPlayer(id)?.active === true;
  const eras = [
    ["current", true],
    ["retired", false],
  ] as const;

  it("has active-player leader lists (only active players) and all-time lists", () => {
    const lbs = ds.getLeaderboards();
    const active = lbs.filter((lb) => lb.scope === "active");
    expect(active.length).toBeGreaterThanOrEqual(6);
    for (const lb of active) {
      expect(lb.title, lb.id).toMatch(/Active Players$/);
      for (const r of lb.rows) expect(isActive(r.playerId), `${lb.id} ${r.playerId}`).toBe(true);
    }
    expect(lbs.filter((lb) => lb.scope === "all-time").length).toBeGreaterThanOrEqual(8);
  });

  it("all-time lists have enough retired rows to hide (Retired era; Expert hides 5 of 10)", () => {
    const usable = ds
      .getLeaderboards()
      .filter((lb) => lb.scope === "all-time" && lb.rows.filter((r) => !isActive(r.playerId)).length >= 5);
    expect(usable.length).toBeGreaterThanOrEqual(3); // a Top 10 session plays 3 lists
  });

  const fives = ds.getStartingFives();
  const lineupSeasons = [...new Set(fives.map((l) => l.season))].sort();
  const latestSeasons = new Set(lineupSeasons.slice(-CURRENT_LINEUP_SEASONS));

  it.each(eras)("has enough Easy (tier 1) answers per mode in the %s era", (_era, active) => {
    const tier1 = ds.getPlayers({ maxFameTier: 1 }).filter((p) => p.active === active);
    const tier1Ids = new Set(tier1.map((p) => p.id));
    expect(tier1.filter((p) => ds.getCareerStats(p.id)).length).toBeGreaterThanOrEqual(20); // F4
    expect(ds.getPlayersWithStints(2).filter((p) => tier1Ids.has(p.id)).length).toBeGreaterThanOrEqual(20); // F2
    expect(ds.getBoxScores().filter((b) => tier1Ids.has(b.playerId)).length).toBeGreaterThanOrEqual(20); // F5
    const withFiveMates = tier1.filter((p) =>
      ds.getRosterEntries(p.id).some((r) => ds.getTeammates(p.id, r.teamId, r.season).length >= 5),
    );
    expect(withFiveMates.length).toBeGreaterThanOrEqual(20); // F3 (Easy shows 5 teammates)
    // F1: Current uses the latest lineup seasons, Retired the older ones.
    const eraFives = fives.filter((l) => latestSeasons.has(l.season) === active);
    const inLineups = new Set(eraFives.flatMap((l) => l.playerIds).filter((id) => tier1Ids.has(id)));
    expect(inLineups.size).toBeGreaterThanOrEqual(20);
  });

  it("splits starting fives into current (latest seasons) and older lineups back to 1996-97", () => {
    const current = fives.filter((l) => latestSeasons.has(l.season));
    expect(current.length).toBeGreaterThanOrEqual(60);
    expect(fives.length - current.length).toBeGreaterThanOrEqual(200);
    // Opening-night starters (boxscoretraditionalv3) cover the seasons before leaguedashlineups.
    expect(lineupSeasons[0]).toBe("1996-97");
    const openers = fives.filter((l) => l.source === "boxscoretraditionalv3");
    expect(openers.length).toBeGreaterThanOrEqual(200);
    for (const l of openers) expect(l.id, l.id).toMatch(/-opener$/);
  });

  it("keeps whole careers of pre-1996 legends, with every team they played for", () => {
    const wilt = ds.searchPlayers("Wilt Chamberlain")[0];
    expect(wilt?.active).toBe(false);
    const stints = ds.getCareerStints(wilt!.id);
    expect(stints[0]?.fromSeason).toBe("1959-60");
    expect(stints.at(-1)?.teamId).toBe("LAL");
    expect(new Set(ds.getRosterEntries(wilt!.id).map((r) => r.season)).size).toBe(14); // 1959-60…1972-73
    for (const s of stints) expect(ds.getTeam(s.teamId), s.teamId).toBeDefined();
  });

  it("does not split a one-team career at the 1996 team-code switch", () => {
    const stockton = ds.searchPlayers("John Stockton")[0];
    expect(ds.getCareerStints(stockton!.id).map((s) => [s.teamId, s.fromSeason, s.toSeason])).toEqual([
      ["UTA", "1984-85", "2002-03"],
    ]);
  });
});
