"use client";

import { useState } from "react";
import { AchievementBadge } from "@/components/game/achievement-badge";
import { GameHistoryList } from "@/components/game/game-history-list";
import { NicknameModal } from "@/components/game/nickname-form";
import { StatTile } from "@/components/game/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";
import { fmtNumber, guestName, initials } from "@/lib/format";
import { useMe } from "@/lib/me-context";
import { useApi } from "@/lib/use-api";

function ProfileLoading() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <div className="page-header profile-head">
        <Skeleton shape="circle" />
        <div className="stack stack--sm grow">
          <Skeleton shape="title" />
          <Skeleton shape="text" width={40} />
        </div>
      </div>
      <div className="profile-tiles block">
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
        <Skeleton shape="block" />
      </div>
      <div className="stack stack--sm block">
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    </div>
  );
}

function History() {
  const { state, retry } = useApi("history", (s) => api.getHistory(s));
  const [now] = useState(() => new Date());
  if (state.status === "loading") {
    return (
      <div className="stack stack--sm" aria-busy="true" aria-label="Loading game history">
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    );
  }
  if (state.status === "error")
    return <ErrorState compact title="Couldn't load your history" onRetry={retry} />;
  if (state.data.items.length === 0) {
    return (
      <EmptyState
        compact
        icon="gamepad"
        title="No games played yet"
        description="Play your first game to start your history."
      />
    );
  }
  return <GameHistoryList items={state.data.items} now={now} />;
}

function Header({ me, onEdit }: { me: MeDTO; onEdit: () => void }) {
  const name = me.nickname ?? guestName(me.id);
  return (
    <div className="page-header profile-head" data-component="PageHeader">
      <span className="profile-head__avatar" aria-hidden="true">
        {initials(me.nickname ?? "Guest")}
      </span>
      <div className="stack stack--sm grow">
        <span className="t-label page-header__eyebrow">Profile</span>
        <h1 className="page-header__title" id="profile-title">
          {name}
        </h1>
        <div className="row">
          <Badge variant="outline">{me.nickname ? "Guest · nickname set" : "Guest"}</Badge>
        </div>
      </div>
      <IconButton
        icon="pencil"
        label={me.nickname ? "Edit nickname" : "Set nickname"}
        onClick={onEdit}
      />
    </div>
  );
}

export function ProfileView() {
  const { state, retry, setMe } = useMe();
  const [nickOpen, setNickOpen] = useState(false);

  if (state.status === "loading") return <ProfileLoading />;
  if (state.status === "error") {
    return (
      <ErrorState
        className="block"
        variant="storage"
        title="Couldn't read your progress"
        description="Check your connection and try again. Your stats are stored on our server."
        onRetry={retry}
      />
    );
  }
  const me = state.data;
  const earned = me.achievements.filter((a) => a.earnedAt !== null).length;
  const isEmpty = me.gamesPlayed === 0;

  return (
    <>
      <Header me={me} onEdit={() => setNickOpen(true)} />
      <div className="guest-note" role="note">
        <Icon name="info" />
        <span>
          <b>Your progress is saved in this browser.</b> Clearing site data or switching devices
          starts you over.
        </span>
      </div>

      <div className="profile-tiles block">
        <StatTile
          label="Total points"
          value={fmtNumber(me.totalPoints)}
          countTo={me.totalPoints}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label="Games played"
          value={fmtNumber(me.gamesPlayed)}
          countTo={me.gamesPlayed}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label="Accuracy"
          value={isEmpty ? "—" : `${me.accuracy}%`}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label="Best streak"
          value={me.bestStreak}
          countTo={me.bestStreak}
          tone={isEmpty ? "muted" : "accent"}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          className="block"
          icon="gamepad"
          title="No games played yet"
          description="Play your first game to start your history and unlock badges."
          actions={
            <Button href="/games/starting-five" icon="play">
              Play your first game
            </Button>
          }
        />
      ) : null}

      {isEmpty ? null : (
        <div className="block">
          <div className="block__head">
            <h2 className="block__title">Achievements</h2>
            <span className="t-sm t-muted">
              {earned} / {me.achievements.length}
            </span>
          </div>
          <div className="achievements">
            {me.achievements.map((a) => (
              <AchievementBadge
                key={a.id}
                id={a.id}
                name={a.name}
                description={a.description}
                state={a.earnedAt ? "earned" : "locked"}
              />
            ))}
          </div>
        </div>
      )}

      {isEmpty ? null : (
        <div className="block">
          <div className="block__head">
            <h2 className="block__title">Game history</h2>
            <span className="t-sm t-muted">Last 20</span>
          </div>
          <History />
        </div>
      )}

      <NicknameModal
        open={nickOpen}
        onClose={() => setNickOpen(false)}
        initial={me.nickname}
        onSaved={setMe}
      />
    </>
  );
}
