// F4 Career Stats — career averages card; the user names the player.
import { DIFFICULTY_RULES, SESSION_LENGTH } from "../core/difficulty";
import type { GameEngine } from "../core/types";
import { getPoolIds, singleAnswerQuestion } from "../shared/question";

export const engine: GameEngine = {
  mode: "career-stats",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude) {
    const pool = getPoolIds(ds, difficulty);
    const candidates = ds
      .getPlayersWithCareerStats()
      .filter((p) => pool.has(p.id) && !exclude.has(`cs:${p.id}`));
    if (candidates.length === 0) return null;

    const player = rng.pick(candidates);
    const stats = ds.getCareerStats(player.id);
    if (!stats) return null;
    const hide = DIFFICULTY_RULES[difficulty].reducedHints;

    return singleAnswerQuestion({
      ds,
      mode: "career-stats",
      difficulty,
      key: `cs:${player.id}`,
      answerId: player.id,
      rng,
      content: {
        mode: "career-stats",
        stats: {
          ppg: stats.ppg,
          rpg: stats.rpg,
          apg: stats.apg,
          spg: stats.spg,
          bpg: stats.bpg,
          fgPct: stats.fgPct,
          games: stats.games,
          seasons: hide ? null : stats.seasons,
          position: hide ? null : player.position,
        },
      },
    });
  },
};
