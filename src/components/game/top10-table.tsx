"use client";

import type { CorrectAnswerView, PlayerRef } from "@/games/core/types";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { PlayerSearch, type PickedPlayer } from "./player-search";

export type Top10Picks = Record<number, PickedPlayer>;
type SlotsReveal = Extract<CorrectAnswerView, { kind: "slots" }>;

/** `{ slots: { "3": "2544", … } }` — rank → playerId, only rows the user filled. */
export function slotsPayload(picks: Top10Picks): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const [rank, player] of Object.entries(picks)) slots[rank] = player.id;
  return slots;
}

interface Top10TableProps {
  rows: { rank: number; value: number; player: PlayerRef | null }[];
  picks: Top10Picks;
  onPick: (rank: number, player: PickedPlayer | null) => void;
  /** After submitting: per hidden rank, the right player and whether the pick was right. */
  reveal: SlotsReveal | null;
  disabled?: boolean;
}

export function Top10Table({ rows, picks, onPick, reveal, disabled }: Top10TableProps) {
  const { t, locale } = useI18n();
  return (
    <ol className="top10" data-component="Top10Table">
      {rows.map((row) => {
        if (row.player) {
          return (
            <li key={row.rank} className="top10__row" data-state="shown" data-rank={row.rank}>
              <span className="top10__rank">{row.rank}</span>
              <span className="top10__player">
                <span className="top10__name top10__reveal">{row.player.name}</span>
              </span>
              <span className="top10__value">{fmtNumber(row.value, locale)}</span>
            </li>
          );
        }
        const revealed = reveal?.rows.find((r) => r.rank === row.rank);
        if (revealed) {
          return (
            <li
              key={row.rank}
              className="top10__row"
              data-state={revealed.correct ? "filled" : "missed"}
              data-rank={row.rank}
            >
              <span className="top10__rank">{row.rank}</span>
              <span className="top10__player">
                <span className="top10__name top10__reveal">{revealed.player.name}</span>
                <span className="sr-only">
                  {revealed.correct ? t.question.gotIt : t.question.missed}
                </span>
              </span>
              <span className="top10__value">{fmtNumber(row.value, locale)}</span>
            </li>
          );
        }
        return (
          <li key={row.rank} className="top10__row" data-state="hidden" data-rank={row.rank}>
            <span className="top10__rank">{row.rank}</span>
            <span className="top10__player">
              <span className="top10__input-wrap grow">
                <PlayerSearch
                  compact
                  value={picks[row.rank] ?? null}
                  onChange={(p) => onPick(row.rank, p)}
                  disabled={disabled}
                  label={t.question.rankPlayer(row.rank)}
                  placeholder={t.question.whoIs(row.rank)}
                />
              </span>
            </span>
            <span className="top10__value">{fmtNumber(row.value, locale)}</span>
          </li>
        );
      })}
    </ol>
  );
}
