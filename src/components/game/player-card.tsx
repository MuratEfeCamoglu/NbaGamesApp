import type { ReactNode } from "react";
import { teamKey } from "@/lib/format";
import { PlayerAvatar } from "./player-avatar";

interface PlayerCardProps {
  name: string;
  headshotId?: string | null;
  teamId?: string | null;
  meta?: ReactNode;
}

export function PlayerCard({ name, headshotId, teamId, meta }: PlayerCardProps) {
  return (
    <div className="player-card" data-component="PlayerCard" data-team={teamKey(teamId)}>
      <PlayerAvatar name={name} headshotId={headshotId} teamId={teamId} size="photo" />
      <div className="player-card__body">
        <span className="player-card__name">{name}</span>
        {meta ? <span className="player-card__meta">{meta}</span> : null}
      </div>
    </div>
  );
}

/** The "?" slot in Starting Five; turns green/red with the revealed name after answering. */
export function MysteryPlayerCard({
  revealedName,
  result,
  meta,
}: {
  revealedName: string | null;
  result: "correct" | "wrong" | null;
  meta?: ReactNode;
}) {
  return (
    <div
      className="player-card"
      data-component="PlayerCard"
      data-variant="mystery"
      data-state={result ?? "default"}
    >
      <div className="player-card__mystery" aria-hidden="true">
        ?
      </div>
      <div className="player-card__body">
        <span className="player-card__name">{revealedName ?? "Missing starter"}</span>
        {meta ? <span className="player-card__meta">{meta}</span> : null}
      </div>
    </div>
  );
}
