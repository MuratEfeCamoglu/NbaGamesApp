// F1 Starting Five — 4 of a team-season's most-used five are shown; the user finds the 5th.
import type { NbaDataSource } from "@/data/source";
import { CURRENT_ERA_LINEUP_SEASONS, DIFFICULTY_RULES, SESSION_LENGTH } from "../core/difficulty";
import type { EraFilter, GameEngine } from "../core/types";
import { toPlayerRef } from "../shared/player-ref";
import { getPoolIds, singleAnswerQuestion, teamDisplayName } from "../shared/question";

const currentSeasonsCache = new WeakMap<NbaDataSource, ReadonlySet<string>>();

/**
 * The latest CURRENT_ERA_LINEUP_SEASONS distinct lineup seasons in the data: the "current" era's
 * teams (ISKELET F16). Every older lineup (including pre-2007 opening-night ones) is "retired".
 */
export function currentEraSeasons(ds: NbaDataSource): ReadonlySet<string> {
  const cached = currentSeasonsCache.get(ds);
  if (cached) return cached;
  // Season labels ("2015-16") sort chronologically as strings.
  const newestFirst = [...new Set(ds.getStartingFives().map((l) => l.season))].sort().reverse();
  const current = new Set(newestFirst.slice(0, CURRENT_ERA_LINEUP_SEASONS));
  currentSeasonsCache.set(ds, current);
  return current;
}

function seasonInEra(season: string, era: EraFilter, current: ReadonlySet<string>): boolean {
  return era === "all" || current.has(season) === (era === "current");
}

export const engine: GameEngine = {
  mode: "starting-five",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude, era = "all") {
    // The missing player (the answer) must match the era; the 4 shown starters may not
    // (a current lineup can include a player who has retired since).
    const pool = getPoolIds(ds, difficulty, era);
    const current = currentEraSeasons(ds);
    // A lineup already used in this session (with any missing player) would reveal its answer.
    const usedLineups = new Set([...exclude].filter((k) => k.startsWith("sf:")).map((k) => k.split(":")[1]));

    const candidates: { lineupIndex: number; missingId: string }[] = [];
    const lineups = ds.getStartingFives();
    lineups.forEach((lineup, lineupIndex) => {
      if (usedLineups.has(lineup.id) || !seasonInEra(lineup.season, era, current)) return;
      for (const id of lineup.playerIds) {
        if (pool.has(id) && ds.getPlayer(id)) candidates.push({ lineupIndex, missingId: id });
      }
    });
    if (candidates.length === 0) return null;

    const { lineupIndex, missingId } = rng.pick(candidates);
    const lineup = lineups[lineupIndex];
    const missing = ds.getPlayer(missingId);
    if (!lineup || !missing) return null;

    const shownIds = lineup.playerIds.filter((id) => id !== missingId);
    return singleAnswerQuestion({
      ds,
      mode: "starting-five",
      difficulty,
      key: `sf:${lineup.id}:${missingId}`,
      answerId: missingId,
      rng,
      era,
      avoidOptionIds: new Set(shownIds),
      content: {
        mode: "starting-five",
        teamId: lineup.teamId,
        teamName: teamDisplayName(ds, lineup.teamId),
        season: DIFFICULTY_RULES[difficulty].reducedHints ? null : lineup.season,
        players: shownIds.map((id) => toPlayerRef(ds, id, lineup.teamId)),
        missingPosition: missing.position,
      },
    });
  },
};
