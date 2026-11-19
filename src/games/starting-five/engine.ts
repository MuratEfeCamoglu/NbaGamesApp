// F1 Starting Five — 4 of a team-season's most-used five are shown; the user finds the 5th.
import { DIFFICULTY_RULES, SESSION_LENGTH } from "../core/difficulty";
import type { GameEngine } from "../core/types";
import { toPlayerRef } from "../shared/player-ref";
import { getPoolIds, singleAnswerQuestion, teamDisplayName } from "../shared/question";

export const engine: GameEngine = {
  mode: "starting-five",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude) {
    const pool = getPoolIds(ds, difficulty);
    // A lineup already used in this session (with any missing player) would reveal its answer.
    const usedLineups = new Set([...exclude].filter((k) => k.startsWith("sf:")).map((k) => k.split(":")[1]));

    const candidates: { lineupIndex: number; missingId: string }[] = [];
    const lineups = ds.getStartingFives();
    lineups.forEach((lineup, lineupIndex) => {
      if (usedLineups.has(lineup.id)) return;
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
