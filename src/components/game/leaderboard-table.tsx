"use client";

import type { ReactNode } from "react";
import type { LeaderboardDTO } from "@/lib/api-types";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
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
  const { t, locale } = useI18n();
  const variant: LeaderboardRowVariant = isMe ? "you" : medal(rank);
  return (
    <Tag className="leaderboard-row" data-component="LeaderboardRow" data-variant={variant}>
      <span className="leaderboard-row__rank">{rank === null ? "—" : fmtNumber(rank, locale)}</span>
      <span className="leaderboard-row__player">
        <PlayerAvatar name={name} size="sm" />
        <span className="stack stack--sm grow">
          <span className="leaderboard-row__name">
            {name}
            {isMe ? (
              <>
                {" "}
                <span className="you-tag">{t.common.you}</span>
              </>
            ) : null}
          </span>
        </span>
      </span>
      <span className="leaderboard-row__points">{fmtNumber(points, locale)}</span>
    </Tag>
  );
}

interface LeaderboardTableProps {
  rows: Row[];
  /** Sticky "You" row. Shown only while your own row is not among `rows`; null hides it. */
  me?: { rank: number | null; points: number; name: string } | null;
  variant: "full" | "compact" | "daily";
  /** Rendered above the header (no-nickname call-out). */
  callout?: ReactNode;
  label?: string;
}

export function LeaderboardTable({ rows, me, variant, callout, label }: LeaderboardTableProps) {
  const { t } = useI18n();
  const short = variant !== "full";
  // Already listed (highlighted in place) → a second sticky copy would just repeat it.
  const stickyMe = me && !rows.some((r) => r.isMe) ? me : null;
  return (
    <div
      className={short ? "leaderboard leaderboard--short" : "leaderboard"}
      data-component="LeaderboardTable"
      data-variant={variant}
    >
      {callout}
      {variant === "full" ? (
        <div className="leaderboard__head t-label" aria-hidden="true">
          <span>{t.common.rank}</span>
          <span>{t.common.player}</span>
          <span>{t.common.points}</span>
        </div>
      ) : null}
      <ol className="leaderboard__body" aria-label={label ?? t.leaderboard.defaultLabel}>
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
      {stickyMe ? (
        <div className="leaderboard__you">
          <LeaderboardRow
            as="div"
            rank={stickyMe.rank}
            name={stickyMe.name}
            points={stickyMe.points}
            isMe
          />
        </div>
      ) : null}
    </div>
  );
}
