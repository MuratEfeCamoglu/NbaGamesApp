// F6 Top 10 Challenge — a stat leaderboard with some rows hidden; each hidden row is one unit.
import { TOP10_HIDDEN_ROWS, TOP10_LISTS_PER_SESSION, TOP10_TIME_LIMIT_SEC } from "../core/difficulty";
import type { GameEngine } from "../core/types";
import { toPlayerRef } from "../shared/player-ref";

export const engine: GameEngine = {
  mode: "top-10",
  questionsPerSession: TOP10_LISTS_PER_SESSION,
  generateQuestion(ds, difficulty, rng, exclude) {
    const hiddenCount = TOP10_HIDDEN_ROWS[difficulty];
    const candidates = ds
      .getLeaderboards()
      .filter(
        (lb) =>
          !exclude.has(`t10:${lb.id}`) &&
          lb.rows.length >= hiddenCount &&
          lb.rows.every((r) => ds.getPlayer(r.playerId)),
      );
    if (candidates.length === 0) return null;

    const board = rng.pick(candidates);
    const hiddenRanks = new Set(
      rng
        .shuffle(board.rows)
        .slice(0, hiddenCount)
        .map((r) => r.rank),
    );
    const slots: Record<string, string> = {};
    for (const row of board.rows) {
      if (hiddenRanks.has(row.rank)) slots[String(row.rank)] = row.playerId;
    }

    return {
      key: `t10:${board.id}`,
      mode: "top-10",
      difficulty,
      timeLimitSec: TOP10_TIME_LIMIT_SEC,
      input: "top10",
      options: null,
      content: {
        mode: "top-10",
        title: board.title,
        statLabel: board.statLabel,
        // The session service overwrites listIndex with the real position in the session.
        listIndex: 1,
        listTotal: TOP10_LISTS_PER_SESSION,
        rows: [...board.rows]
          .sort((a, b) => a.rank - b.rank)
          .map((r) => ({
            rank: r.rank,
            value: r.value,
            player: hiddenRanks.has(r.rank) ? null : toPlayerRef(ds, r.playerId),
          })),
      },
      answerKey: { kind: "slots", slots },
    };
  },
};
