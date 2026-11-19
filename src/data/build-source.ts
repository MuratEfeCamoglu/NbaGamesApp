// Builds an in-memory NbaDataSource from parsed seed files. Pure (no fs) so it can be
// used from tests with small fixtures; static-source.ts feeds it the real seed JSON.
import type { z } from "zod";
import {
  seedFileSchemas,
  type BoxScoreLine,
  type CareerStats,
  type CareerStint,
  type Player,
  type RosterEntry,
  type SeedFileName,
  type Team,
} from "./schema";
import type { NbaDataSource, PlayerFilter } from "./source";

export type SeedFiles = { [K in SeedFileName]: unknown };

const DEFAULT_SEARCH_LIMIT = 10;

/** Lowercase, accents stripped ("Nikola Jokić" → "nikola jokic"). */
export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return map;
}

export function createStaticDataSource(files: SeedFiles): NbaDataSource {
  const parse = <K extends SeedFileName>(name: K): z.infer<(typeof seedFileSchemas)[K]> => {
    const result = seedFileSchemas[name].safeParse(files[name]);
    if (!result.success) throw new Error(`Invalid seed file ${name}: ${result.error.message}`);
    // TS cannot correlate the indexed schema with K; the schema parsed for `name` is exactly this type.
    return result.data as z.infer<(typeof seedFileSchemas)[K]>;
  };

  const teamsFile = parse("teams.json");
  const playersFile = parse("players.json");
  const rosters: readonly RosterEntry[] = parse("rosters.json").items;
  const startingFives = parse("starting-fives.json").items;
  const stints: readonly CareerStint[] = parse("career-stints.json").items;
  const careerStats: readonly CareerStats[] = parse("career-stats.json").items;
  const boxScores: readonly BoxScoreLine[] = parse("box-scores.json").items;
  const leaderboards = parse("leaderboards.json").items;

  const teams: readonly Team[] = teamsFile.items;
  const players: readonly Player[] = playersFile.items;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const searchIndex = players.map((p) => ({ player: p, key: normalizeName(p.name) }));

  const stintsByPlayer = new Map(
    [...groupBy(stints, (s) => s.playerId)].map(([id, list]) => [
      id,
      [...list].sort((a, b) => a.order - b.order),
    ]),
  );
  const statsByPlayer = new Map(careerStats.map((s) => [s.playerId, s]));
  const rostersByPlayer = groupBy(rosters, (r) => r.playerId);
  const rostersByTeamSeason = groupBy(rosters, (r) => `${r.teamId}|${r.season}`);

  const playersByTier = new Map<number, readonly Player[]>(
    [1, 2, 3].map((tier) => [tier, players.filter((p) => p.fameTier <= tier)]),
  );
  const withStintsCache = new Map<number, readonly Player[]>();
  const playersWithStats = players.filter((p) => statsByPlayer.has(p.id));

  return {
    meta: playersFile.meta,
    getTeams: () => teams,
    getTeam: (id) => teamById.get(id),
    getPlayers: (filter?: PlayerFilter) =>
      filter?.maxFameTier ? (playersByTier.get(filter.maxFameTier) ?? []) : players,
    getPlayer: (id) => playerById.get(id),
    searchPlayers(query, limit = DEFAULT_SEARCH_LIMIT) {
      const q = normalizeName(query);
      if (!q || limit <= 0) return [];
      return searchIndex
        .filter((e) => e.key.includes(q))
        .map((e) => ({
          ...e,
          // Prefix of the full name or of any word ranks first.
          prefix: e.key.startsWith(q) || e.key.split(" ").some((w) => w.startsWith(q)) ? 0 : 1,
        }))
        .sort(
          (a, b) =>
            a.prefix - b.prefix ||
            a.player.fameTier - b.player.fameTier ||
            a.player.name.localeCompare(b.player.name),
        )
        .slice(0, limit)
        .map((e) => e.player);
    },
    getStartingFives: () => startingFives,
    getCareerStints: (playerId) => stintsByPlayer.get(playerId) ?? [],
    getPlayersWithStints(minTeams) {
      const cached = withStintsCache.get(minTeams);
      if (cached) return cached;
      const result = players.filter((p) => {
        const list = stintsByPlayer.get(p.id);
        return list !== undefined && new Set(list.map((s) => s.teamId)).size >= minTeams;
      });
      withStintsCache.set(minTeams, result);
      return result;
    },
    getCareerStats: (playerId) => statsByPlayer.get(playerId),
    getPlayersWithCareerStats: () => playersWithStats,
    getRosterEntries: (playerId) => rostersByPlayer.get(playerId) ?? [],
    getTeammates(playerId, teamId, season) {
      const entries = rostersByTeamSeason.get(`${teamId}|${season}`) ?? [];
      const ids = new Set(entries.map((e) => e.playerId).filter((id) => id !== playerId));
      return [...ids].map((id) => playerById.get(id)).filter((p): p is Player => p !== undefined);
    },
    getBoxScores: () => boxScores,
    getLeaderboards: () => leaderboards,
  };
}
