"use client";

import { useState } from "react";
import { LeaderboardTable } from "@/components/game/leaderboard-table";
import { NicknameModal } from "@/components/game/nickname-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import type { LeaderboardPeriod } from "@/lib/api-types";
import { guestName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { meData, useMe } from "@/lib/me-context";
import { useApi } from "@/lib/use-api";

const PERIODS: readonly LeaderboardPeriod[] = ["all", "week", "day"];

export function LeaderboardView() {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [nickOpen, setNickOpen] = useState(false);
  const { state: meState, setMe } = useMe();
  const me = meData(meState);
  const { state, retry } = useApi(`lb-${period}`, (s) => api.getLeaderboard(period, s));

  function body() {
    if (state.status === "loading") {
      return (
        <div className="stack stack--sm" aria-busy="true" aria-label={t.common.loadingLeaderboard}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} shape="row" />
          ))}
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <ErrorState
          title={t.common.leaderboardUnavailable}
          description={t.leaderboard.unavailableDesc}
          onRetry={retry}
        />
      );
    }
    const data = state.data;
    if (data.rows.length === 0) {
      return (
        <EmptyState
          icon="trophy"
          title={t.common.noScoresYet}
          description={t.leaderboard.emptyDesc}
          actions={<Button href="/games">{t.common.playNow}</Button>}
        />
      );
    }
    const noNickname = !data.me.nickname && !me?.nickname;
    const youName =
      data.me.nickname ??
      me?.nickname ??
      t.leaderboard.noNickname(me ? guestName(me.id, locale) : t.nav.guest);
    return (
      <LeaderboardTable
        variant="full"
        rows={data.rows}
        label={t.leaderboard.top100}
        me={{ rank: data.me.rank, points: data.me.points, name: youName }}
        callout={
          noNickname ? (
            <div className="nickname-cta" data-component="Card">
              <Icon name="user" size="lg" className="t-accent" />
              <span className="t-sm grow">{t.common.nicknameCta}</span>
              <Button size="sm" onClick={() => setNickOpen(true)}>
                {t.common.setNickname}
              </Button>
            </div>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <div className="block">
        <Tabs
          idBase="lb"
          label={t.leaderboard.periodLabel}
          size="lg"
          items={PERIODS.map((value) => ({ value, label: t.leaderboard.periods[value] }))}
          value={period}
          onChange={setPeriod}
        />
      </div>
      <div className="block" id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${period}`}>
        {body()}
      </div>
      <NicknameModal
        open={nickOpen}
        onClose={() => setNickOpen(false)}
        initial={me?.nickname}
        onSaved={(updated) => {
          setMe(updated);
          retry();
        }}
      />
    </>
  );
}
