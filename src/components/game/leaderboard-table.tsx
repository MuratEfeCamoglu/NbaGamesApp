import type { ReactNode } from "react";
import type { LeaderboardDTO } from "@/lib/api-types";
import { fmtNumber } from "@/lib/format";
import { PlayerAvatar } from "./player-avatar";

type Row = LeaderboardDTO["rows"][number];
export type LeaderboardRowVariant = "default" | "gold" | "silver" | "bronze" | "you";

function medal(rank: number | null): LeaderboardRowVariant {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

export function LeaderboardRow({
  rank,
  name,
  points,
  isMe,
  as: Tag = "li",
}: {
  rank: number | null;
  name: string;
  points: number;
  isMe?: boolean;
  as?: "li" | "div";
}) {
  const variant: LeaderboardRowVariant = isMe ? "you" : medal(rank);
  return (
    <Tag className="leaderboard-row" data-component="LeaderboardRow" data-variant={variant}>
      <span className="leaderboard-row__rank">{rank === null ? "—" : fmtNumber(rank)}</span>
      <span className="leaderboard-row__player">
        <PlayerAvatar name={name} size="sm" />
        <span className="stack stack--sm grow">
          <span className="leaderboard-row__name">
            {name}
            {isMe ? (
              <>
                {" "}
                <span className="you-tag">You</span>
              </>
            ) : null}
          </span>
        </span>
      </span>
      <span className="leaderboard-row__points">{fmtNumber(points)}</span>
    </Tag>
  );
}

interface LeaderboardTableProps {
  rows: Row[];
  /** Sticky "You" row; null hides it (e.g. when you are already visible in a short list). */
  me?: { rank: number | null; points: number; name: string } | null;
  variant: "full" | "compact" | "daily";
  /** Rendered above the header (no-nickname call-out). */
  callout?: ReactNode;
  label?: string;
}

export function LeaderboardTable({
  rows,
  me,
  variant,
  callout,
  label = "Top players",
}: LeaderboardTableProps) {
  const short = variant !== "full";
  return (
    <div
      className={short ? "leaderboard leaderboard--short" : "leaderboard"}
      data-component="LeaderboardTable"
      data-variant={variant}
    >
      {callout}
      {variant === "full" ? (
        <div className="leaderboard__head t-label" aria-hidden="true">
          <span>Rank</span>
          <span>Player</span>
          <span>Points</span>
        </div>
      ) : null}
      <ol className="leaderboard__body" aria-label={label}>
        {rows.map((r) => (
          <LeaderboardRow
            key={`${r.rank}-${r.nickname}`}
            rank={r.rank}
            name={r.nickname}
            points={r.points}
            isMe={r.isMe}
          />
        ))}
      </ol>
      {me ? (
        <div className="leaderboard__you">
          <LeaderboardRow as="div" rank={me.rank} name={me.name} points={me.points} isMe />
        </div>
      ) : null}
    </div>
  );
}
