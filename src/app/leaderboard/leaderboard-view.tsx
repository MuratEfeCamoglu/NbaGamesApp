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
import { meData, useMe } from "@/lib/me-context";
import { useApi } from "@/lib/use-api";

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "day", label: "Today" },
] as const satisfies readonly { value: LeaderboardPeriod; label: string }[];

export function LeaderboardView() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [nickOpen, setNickOpen] = useState(false);
  const { state: meState, setMe } = useMe();
  const me = meData(meState);
  const { state, retry } = useApi(`lb-${period}`, (s) => api.getLeaderboard(period, s));

  function body() {
    if (state.status === "loading") {
      return (
        <div className="stack stack--sm" aria-busy="true" aria-label="Loading leaderboard">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} shape="row" />
          ))}
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <ErrorState
          title="Leaderboard unavailable"
          description="We couldn't fetch rankings. Your points are still counted."
          onRetry={retry}
        />
      );
    }
    const data = state.data;
    if (data.rows.length === 0) {
      return (
        <EmptyState
          icon="trophy"
          title="No scores yet"
          description="Nobody has played in this period. Be the first name on the board."
          actions={<Button href="/games">Play now</Button>}
        />
      );
    }
    const noNickname = !data.me.nickname && !me?.nickname;
    const youName =
      data.me.nickname ?? me?.nickname ?? `${me ? guestName(me.id) : "Guest"} · no nickname`;
    return (
      <LeaderboardTable
        variant="full"
        rows={data.rows}
        label="Top 100 players"
        me={{ rank: data.me.rank, points: data.me.points, name: youName }}
        callout={
          noNickname ? (
            <div className="nickname-cta" data-component="Card">
              <Icon name="user" size="lg" className="t-accent" />
              <span className="t-sm grow">Set a nickname to appear on the leaderboard.</span>
              <Button size="sm" onClick={() => setNickOpen(true)}>
                Set nickname
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
          label="Leaderboard period"
          size="lg"
          items={PERIODS}
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
