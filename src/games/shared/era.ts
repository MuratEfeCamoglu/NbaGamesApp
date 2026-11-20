// Era split (ISKELET F16): "current" = active players, "retired" = everyone else, "all" = no filter
// (Daily Challenge and sessions started without an era).
import type { Player } from "@/data/schema";
import type { EraFilter } from "../core/types";

/** True when the player may be the answer (or an Easy/Medium distractor) in this era. */
export function matchesEra(player: Pick<Player, "active">, era: EraFilter): boolean {
  if (era === "all") return true;
  return player.active === (era === "current");
}
