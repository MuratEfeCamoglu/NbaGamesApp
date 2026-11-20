"use client";

import Image from "next/image";
import { useState } from "react";
import type { Era, GameMode } from "@/games/core/types";
import { coverPlayer } from "@/lib/covers";
import { initials } from "@/lib/format";
import { HEADSHOT_HEIGHT, HEADSHOT_WIDTH, headshotUrl, remoteMediaEnabled } from "@/lib/media";

/**
 * Cover star of a mode (ISKELET F17): the photo window and name plate of the GameCard's trading-card
 * front. Retired covers print in sepia like an old card. Not in design.html — built inside the
 * existing GameCard visual. The image box has fixed width/height attributes, so loading never
 * shifts layout.
 */
export function GameCover({
  mode,
  era,
  size = "card",
}: {
  mode: GameMode;
  era: Era;
  /** "intro" = the larger cover on the game intro card. */
  size?: "card" | "intro";
}) {
  const player = coverPlayer(mode, era);
  // Remember which photo failed, so switching era tries the other player's photo again.
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImage = remoteMediaEnabled() && failedId !== player.id;

  return (
    <span
      className="game-cover"
      data-component="GameCover"
      data-size={size === "intro" ? "intro" : undefined}
      data-era={era}
      data-state={showImage ? undefined : "fallback"}
    >
      {showImage ? (
        <Image
          key={player.id}
          className="game-cover__img"
          src={headshotUrl(player.id)}
          alt={player.name}
          width={HEADSHOT_WIDTH}
          height={HEADSHOT_HEIGHT}
          // Straight from the NBA CDN, never through /_next/image (see PlayerAvatar).
          unoptimized
          onError={() => setFailedId(player.id)}
        />
      ) : (
        <span className="game-cover__initials" role="img" aria-label={player.name}>
          <span aria-hidden="true">{initials(player.name)}</span>
        </span>
      )}
      <span className="game-cover__name" lang="en" aria-hidden="true">
        {player.name}
      </span>
    </span>
  );
}
