"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { DailyStatusDTO } from "@/lib/api-types";
import { fmtCountdown, fmtNumber } from "@/lib/format";
import { useNow } from "@/lib/use-api";

export function CountdownChip({
  targetIso,
  prefix = "Next in",
}: {
  targetIso: string;
  prefix?: string;
}) {
  const now = useNow();
  const ms = new Date(targetIso).getTime() - now;
  return (
    <span className="countdown-chip">
      <Icon name="clock" size="sm" />
      {prefix} <strong suppressHydrationWarning>{fmtCountdown(ms)}</strong>
    </span>
  );
}

/** Home card: "open" invites to play, "played" shows today's score (+ rank when known). */
export function DailyChallengeCard({
  status,
  rank,
}: {
  status: DailyStatusDTO;
  rank?: number | null;
}) {
  const played = status.played;
  return (
    <Card
      as="article"
      component="DailyChallengeCard"
      className="daily-card"
      data-state={played ? "played" : "open"}
    >
      <div className="row row--between">
        <Badge variant="accent" icon="calendar">
          Daily challenge
        </Badge>
        <CountdownChip targetIso={status.nextResetAt} />
      </div>
      {played ? (
        <div className="daily-card__played">
          <Badge variant="success" icon="check">
            Already played today
          </Badge>
          <div className="row row--between">
            <div>
              <span className="t-label">Your score</span>
              <div className="daily-card__score">{fmtNumber(status.result?.score ?? 0)}</div>
            </div>
            {rank ? (
              <div>
                <span className="t-label">Rank</span>
                <div className="daily-card__score">#{fmtNumber(rank)}</div>
              </div>
            ) : null}
          </div>
          <Button href="/daily" variant="secondary" block>
            See daily ranking
          </Button>
        </div>
      ) : (
        <div className="daily-card__open">
          <h2 className="daily-card__title">5 questions. All modes. One shot.</h2>
          <p className="t-sm t-muted">Same questions for everyone today.</p>
          <Button href="/daily" block>
            Play today&apos;s challenge
          </Button>
        </div>
      )}
    </Card>
  );
}
