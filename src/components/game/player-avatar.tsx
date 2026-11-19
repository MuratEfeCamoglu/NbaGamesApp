"use client";

import Image from "next/image";
import { useState } from "react";
import { initials, teamKey } from "@/lib/format";

export type PlayerAvatarSize = "sm" | "md" | "lg" | "photo";

interface PlayerAvatarProps {
  name: string;
  headshotId?: string | null;
  teamId?: string | null;
  size?: PlayerAvatarSize;
}

const HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760";
const SIZES: Record<PlayerAvatarSize, string> = {
  sm: "32px",
  md: "48px",
  lg: "72px",
  photo: "(min-width: 768px) 220px, 50vw",
};

function remoteMediaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REMOTE_MEDIA === "true";
}

/** NBA CDN headshot when allowed; initials on the team colour otherwise or when the image fails. */
export function PlayerAvatar({ name, headshotId, teamId, size = "md" }: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = remoteMediaEnabled() && !!headshotId && !failed;

  return (
    <span
      className="player-avatar"
      data-component="PlayerAvatar"
      data-size={size === "md" ? undefined : size}
      data-state={showImage ? undefined : "fallback"}
      data-team={teamKey(teamId)}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {showImage ? (
        <Image
          className="player-avatar__img"
          src={`${HEADSHOT_URL}/${headshotId}.png`}
          alt={name}
          fill
          sizes={SIZES[size]}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
