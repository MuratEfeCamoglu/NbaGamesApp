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
