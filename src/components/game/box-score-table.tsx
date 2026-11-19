import type { BoxScoreStatLine } from "@/games/core/types";
import { fmtGameDate } from "@/lib/format";
import { TeamBadge } from "./team-badge";

interface GameInfo {
  date: string;
  teamId: string;
  opponentId: string;
  teamScore: number;
  opponentScore: number;
}

export function BoxScoreHeader({ game }: { game: GameInfo }) {
  const won = game.teamScore >= game.opponentScore;
  return (
    <div className="box-score__matchup" data-component="BoxScoreHeader">
      <span className="box-score__team" data-variant={won ? "winner" : "loser"}>
        <TeamBadge teamId={game.teamId} size="lg" />
        <span className="box-score__pts">{game.teamScore}</span>
      </span>
      <span className="t-xs t-muted">{fmtGameDate(game.date)}</span>
      <span className="box-score__team" data-variant={won ? "loser" : "winner"}>
        <span className="box-score__pts">{game.opponentScore}</span>
        <TeamBadge teamId={game.opponentId} size="lg" />
      </span>
    </div>
  );
}

/** Sticky first column + horizontally scrollable stats (design note §9). */
export function BoxScoreTable({
  line,
  teamId,
  playerLabel,
}: {
  line: BoxScoreStatLine;
  /** null at Expert: the team is hidden too. */
  teamId: string | null;
  /** "???" before the answer, the player's name after. */
  playerLabel: string;
}) {
  return (
    <div
      className="table-scroll"
      data-component="BoxScoreTable"
      tabIndex={0}
      aria-label="Box score line"
    >
      <table className="data-table">
        <thead>
          <tr>
            <th className="is-sticky" scope="col">
              Player
            </th>
            <th scope="col">MIN</th>
            <th scope="col">PTS</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">STL</th>
            <th scope="col">BLK</th>
            <th scope="col">FG</th>
            <th scope="col">3P</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="is-sticky" scope="row">
              <span className="mystery-name">
                {teamId ? <TeamBadge teamId={teamId} /> : null}
                <span>{playerLabel}</span>
              </span>
            </th>
            <td>{line.min}</td>
            <td className="is-key">{line.pts}</td>
            <td>{line.reb}</td>
            <td>{line.ast}</td>
            <td>{line.stl}</td>
            <td>{line.blk}</td>
            <td>
              {line.fgm}-{line.fga}
            </td>
            <td>
              {line.tpm}-{line.tpa}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
