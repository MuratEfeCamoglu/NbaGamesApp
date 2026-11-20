// F5 Box Score — one real player line from a game; the user names the player.
import { DIFFICULTY_RULES, SESSION_LENGTH } from "../core/difficulty";
import type { GameEngine } from "../core/types";
import { getPoolIds, singleAnswerQuestion } from "../shared/question";

export const engine: GameEngine = {
  mode: "box-score",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude, era = "all") {
    // The line's player must match the era; the game itself may be from any season.
    const pool = getPoolIds(ds, difficulty, era);
    const candidates = ds
      .getBoxScores()
      .filter((l) => pool.has(l.playerId) && ds.getPlayer(l.playerId) && !exclude.has(`bs:${l.id}`));
    if (candidates.length === 0) return null;

    const line = rng.pick(candidates);
    const hide = DIFFICULTY_RULES[difficulty].reducedHints;

    return singleAnswerQuestion({
      ds,
      mode: "box-score",
      difficulty,
      key: `bs:${line.id}`,
      answerId: line.playerId,
      rng,
      era,
      content: {
        mode: "box-score",
        line: {
          min: line.min,
          pts: line.pts,
          reb: line.reb,
          ast: line.ast,
          stl: line.stl,
          blk: line.blk,
          fgm: line.fgm,
          fga: line.fga,
          tpm: line.tpm,
          tpa: line.tpa,
        },
        game: hide
          ? null
          : {
              date: line.gameDate,
              teamId: line.teamId,
              opponentId: line.opponentId,
              teamScore: line.teamScore,
              opponentScore: line.opponentScore,
            },
      },
    });
  },
};
