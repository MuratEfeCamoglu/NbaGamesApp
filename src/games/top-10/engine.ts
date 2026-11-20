// F6 Top 10 Challenge — a stat leaderboard with some rows hidden; each hidden row is one unit.
import type { StatLeaderboard } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { TOP10_HIDDEN_ROWS, TOP10_LISTS_PER_SESSION, TOP10_TIME_LIMIT_SEC } from "../core/difficulty";
import type { EraFilter, GameEngine } from "../core/types";
import { matchesEra } from "../shared/era";
import { toPlayerRef } from "../shared/player-ref";

/**
 * ISKELET F16: the current era plays the career leaders among active players (`scope: "active"`);
 * the retired era — and "all" (legacy sessions), as before the era split — the all-time lists.
 */
function listInEra(board: StatLeaderboard, era: EraFilter): boolean {
  return (board.scope === "active") === (era === "current");
}

/**
 * Rows that may be hidden (= answers): only those whose player matches the era. In the retired era
 * an all-time list keeps its active players visible; in an active list every row qualifies.
 */
function hideableRows(ds: NbaDataSource, board: StatLeaderboard, era: EraFilter): StatLeaderboard["rows"] {
  return board.rows.filter((r) => {
    const player = ds.getPlayer(r.playerId);
    return player !== undefined && matchesEra(player, era);
  });
}

export const engine: GameEngine = {
  mode: "top-10",
  questionsPerSession: TOP10_LISTS_PER_SESSION,
  generateQuestion(ds, difficulty, rng, exclude, era = "all") {
    const hiddenCount = TOP10_HIDDEN_ROWS[difficulty];
    // A list with fewer hideable rows than the difficulty hides is not used at that difficulty.
    const candidates = ds
      .getLeaderboards()
      .filter(
        (lb) =>
          listInEra(lb, era) &&
          !exclude.has(`t10:${lb.id}`) &&
          lb.rows.every((r) => ds.getPlayer(r.playerId)) &&
          hideableRows(ds, lb, era).length >= hiddenCount,
      );
    if (candidates.length === 0) return null;

    const board = rng.pick(candidates);
    const hiddenRanks = new Set(
      rng
        .shuffle(hideableRows(ds, board, era))
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
