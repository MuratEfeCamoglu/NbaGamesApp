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
import { fmtNumber, fmtPercent, guestName, initials } from "@/lib/format";
import { achievementCopy } from "@/lib/i18n/helpers";
import { useI18n, useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/me-context";
import { useApi } from "@/lib/use-api";

function ProfileLoading() {
  const t = useT();
  return (
    <div aria-busy="true" aria-label={t.profile.loading}>
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
  const t = useT();
  const { state, retry } = useApi("history", (s) => api.getHistory(s));
  const [now] = useState(() => new Date());
  if (state.status === "loading") {
    return (
      <div className="stack stack--sm" aria-busy="true" aria-label={t.profile.loadingHistory}>
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    );
  }
  if (state.status === "error")
    return <ErrorState compact title={t.profile.historyError} onRetry={retry} />;
  if (state.data.items.length === 0) {
    return (
      <EmptyState
        compact
        icon="gamepad"
        title={t.common.noGamesYet}
        description={t.profile.historyEmptyDesc}
      />
    );
  }
  return <GameHistoryList items={state.data.items} now={now} />;
}

function Header({ me, onEdit }: { me: MeDTO; onEdit: () => void }) {
  const { t, locale } = useI18n();
  const name = me.nickname ?? guestName(me.id, locale);
  return (
    <div className="page-header profile-head" data-component="PageHeader">
      <span className="profile-head__avatar" aria-hidden="true">
        {initials(me.nickname ?? t.nav.guest)}
      </span>
      <div className="stack stack--sm grow">
        <span className="t-label page-header__eyebrow">{t.meta.profileTitle}</span>
        <h1 className="page-header__title" id="profile-title">
          {name}
        </h1>
        <div className="row">
          <Badge variant="outline">
            {me.nickname ? t.profile.guestNicknameSet : t.profile.guest}
          </Badge>
        </div>
      </div>
      <IconButton
        icon="pencil"
        label={me.nickname ? t.profile.editNickname : t.common.setNickname}
        onClick={onEdit}
      />
    </div>
  );
}

export function ProfileView() {
  const { t, locale } = useI18n();
  const { state, retry, setMe } = useMe();
  const [nickOpen, setNickOpen] = useState(false);

  if (state.status === "loading") return <ProfileLoading />;
  if (state.status === "error") {
    return (
      <ErrorState
        className="block"
        variant="storage"
        title={t.profile.errorTitle}
        description={t.profile.errorDesc}
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
          <b>{t.profile.guestNoteStrong}</b> {t.profile.guestNoteRest}
        </span>
      </div>

      <div className="profile-tiles block">
        <StatTile
          label={t.common.totalPoints}
          value={fmtNumber(me.totalPoints, locale)}
          countTo={me.totalPoints}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label={t.common.gamesPlayed}
          value={fmtNumber(me.gamesPlayed, locale)}
          countTo={me.gamesPlayed}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label={t.common.accuracy}
          value={isEmpty ? "—" : fmtPercent(me.accuracy, locale)}
          tone={isEmpty ? "muted" : undefined}
        />
        <StatTile
          label={t.common.bestStreak}
          value={me.bestStreak}
          countTo={me.bestStreak}
          tone={isEmpty ? "muted" : "accent"}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          className="block"
          icon="gamepad"
          title={t.common.noGamesYet}
          description={t.profile.emptyDesc}
          actions={
            <Button href="/games/starting-five" icon="play">
              {t.common.playYourFirstGame}
            </Button>
          }
        />
      ) : null}

      {isEmpty ? null : (
        <div className="block">
          <div className="block__head">
            <h2 className="block__title">{t.profile.achievements}</h2>
            <span className="t-sm t-muted">
              {earned} / {me.achievements.length}
            </span>
          </div>
          <div className="achievements">
            {me.achievements.map((a) => (
              <AchievementBadge
                key={a.id}
                id={a.id}
                name={achievementCopy(t, a).name}
                description={achievementCopy(t, a).description}
                state={a.earnedAt ? "earned" : "locked"}
              />
            ))}
          </div>
        </div>
      )}

      {isEmpty ? null : (
        <div className="block">
          <div className="block__head">
            <h2 className="block__title">{t.profile.history}</h2>
            <span className="t-sm t-muted">{t.profile.last20}</span>
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
