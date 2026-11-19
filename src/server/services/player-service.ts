import "server-only";
import type { PlayerSearchDTO } from "@/lib/api-types";
import { toPlayerRef } from "@/games/shared/player-ref";
import type { ServiceContext } from "../context";

export const SEARCH_LIMIT = 10;

/** GET /api/players/search: searches the whole pool, never only answer candidates (ISKELET §7). */
export function searchPlayers(ctx: ServiceContext, query: string): PlayerSearchDTO {
  return {
    results: ctx.ds
      .searchPlayers(query, SEARCH_LIMIT)
      .slice(0, SEARCH_LIMIT)
      .map((p) => toPlayerRef(ctx.ds, p.id)),
  };
}
