// Era split (ISKELET F16): labels, URLs and parsing. Pure (no React), so server pages can use it too;
// the per-browser remembered choice lives in use-era-preference.ts.
import { ERAS, type Era, type EraFilter, type GameMode } from "@/games/core/types";
import type { IconName } from "@/components/ui/icon";

/** Current is the default era (ISKELET V11), so its game URL stays the bare `/games/<mode>`. */
export const DEFAULT_ERA: Era = "current";

export interface EraInfo {
  icon: IconName;
}

/** Era icons; the labels and taglines are in the i18n dictionaries (`t.era`). */
export const ERA_INFO: Record<Era, EraInfo> = {
  current: { icon: "zap" },
  retired: { icon: "award" },
};

/** "mixed" = a session without an era filter (Daily, or played before F16). */
export type EraBadgeVariant = Era | "mixed";

export const MIXED_ERA: EraInfo = { icon: "ball" };

export function eraBadgeVariant(era: EraFilter): EraBadgeVariant {
  return era === "current" || era === "retired" ? era : "mixed";
}

export function parseEra(value: unknown): Era | null {
  return typeof value === "string" && (ERAS as readonly string[]).includes(value)
    ? (value as Era)
    : null;
}

/** Link to a game intro in an era. The default era has no query, which keeps old links canonical. */
export function gameHref(mode: GameMode, era: Era): string {
  return era === DEFAULT_ERA ? `/games/${mode}` : `/games/${mode}?era=${era}`;
}

/** `search` with its `era` param set to `era` (removed for the default); other params are kept. */
export function withEraParam(search: string, era: Era): string {
  const params = new URLSearchParams(search);
  if (era === DEFAULT_ERA) params.delete("era");
  else params.set("era", era);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
