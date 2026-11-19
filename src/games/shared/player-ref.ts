import type { NbaDataSource } from "@/data/source";
import type { PlayerRef } from "../core/types";

/**
 * Client-safe player view. `teamId` drives the avatar fallback colour; when the caller has no
 * contextual team, the player's most recent roster team is used.
 */
export function toPlayerRef(ds: NbaDataSource, playerId: string, teamId?: string | null): PlayerRef {
  const player = ds.getPlayer(playerId);
  if (!player) throw new Error(`Unknown player id: ${playerId}`);
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    teamId: teamId ?? latestTeamId(ds, playerId),
    headshotId: player.headshotId,
  };
}

function latestTeamId(ds: NbaDataSource, playerId: string): string | null {
  let best: { teamId: string; season: string } | null = null;
  for (const entry of ds.getRosterEntries(playerId)) {
    // Season labels ("2015-16") sort chronologically as strings; ties keep the later entry
    // (mid-season trades are listed in order).
    if (!best || entry.season >= best.season) best = { teamId: entry.teamId, season: entry.season };
  }
  return best?.teamId ?? null;
}
