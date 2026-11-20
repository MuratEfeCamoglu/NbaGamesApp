"use client";

import Image from "next/image";
import { useState } from "react";
import { initials, teamKey } from "@/lib/format";
import { headshotUrl, remoteMediaEnabled } from "@/lib/media";

export type PlayerAvatarSize = "sm" | "md" | "lg" | "photo";

interface PlayerAvatarProps {
  name: string;
  headshotId?: string | null;
  teamId?: string | null;
  size?: PlayerAvatarSize;
}

const SIZES: Record<PlayerAvatarSize, string> = {
  sm: "32px",
  md: "48px",
  lg: "72px",
  photo: "(min-width: 768px) 220px, 50vw",
};

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
          src={headshotUrl(headshotId ?? "")}
          alt={name}
          fill
          sizes={SIZES[size]}
          // Load straight from the NBA CDN, not through our /_next/image proxy: a slow upstream
          // fetch there kept same-origin connections busy (browsers allow ~6 per host on HTTP/1.1)
          // and the answer POST queued behind them, freezing the game (e2e starting-five/hard).
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
