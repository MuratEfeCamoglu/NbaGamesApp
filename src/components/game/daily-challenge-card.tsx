"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { DailyStatusDTO } from "@/lib/api-types";
import { fmtCountdown, fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { useNow } from "@/lib/use-api";

export function CountdownChip({
  targetIso,
  prefix,
}: {
  targetIso: string;
  /** Defaults to "Next in". */
  prefix?: string;
}) {
  const { t } = useI18n();
  const now = useNow();
  const ms = new Date(targetIso).getTime() - now;
  return (
    <span className="countdown-chip">
      <Icon name="clock" size="sm" />
      {prefix ?? t.daily.nextIn} <strong suppressHydrationWarning>{fmtCountdown(ms)}</strong>
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
  const { t, locale } = useI18n();
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
          {t.daily.card.badge}
        </Badge>
        <CountdownChip targetIso={status.nextResetAt} />
      </div>
      {played ? (
        <div className="daily-card__played">
          <Badge variant="success" icon="check">
            {t.daily.alreadyPlayed}
          </Badge>
          <div className="row row--between">
            <div>
              <span className="t-label">{t.daily.card.yourScore}</span>
              <div className="daily-card__score">
                {fmtNumber(status.result?.score ?? 0, locale)}
              </div>
            </div>
            {rank ? (
              <div>
                <span className="t-label">{t.common.rank}</span>
                <div className="daily-card__score">#{fmtNumber(rank, locale)}</div>
              </div>
            ) : null}
          </div>
          <Button href="/daily" variant="secondary" block>
            {t.daily.seeRanking}
          </Button>
        </div>
      ) : (
        <div className="daily-card__open">
          <h2 className="daily-card__title">{t.daily.card.title}</h2>
          <p className="t-sm t-muted">{t.daily.card.sub}</p>
          <Button href="/daily" block>
            {t.daily.card.play}
          </Button>
        </div>
      )}
    </Card>
  );
}
