// Mode structure: slug, number, title, icon. The copy (descriptions, rules, era lines) lives in the
// i18n dictionaries (`t.modes[slug]`, F18); mode titles are English in every language.
import { GAME_MODES, type Difficulty, type GameMode } from "@/games/core/types";
import { DIFFICULTY_RULES, TOP10_HIDDEN_ROWS, TOP10_TIME_LIMIT_SEC } from "@/games/core/difficulty";
import type { IconName } from "@/components/ui/icon";
import type { Messages } from "@/lib/i18n/types";

export interface ModeInfo {
  slug: GameMode;
  /** "01".."06" — card index and "Mode 01" badge */
  n: string;
  title: string;
  /** Short title used in tight places (design mode tabs: "Teammates", "Top 10"). */
  shortTitle: string;
  icon: IconName;
}

const BASE: Record<GameMode, Pick<ModeInfo, "n" | "title" | "shortTitle" | "icon">> = {
  "starting-five": { n: "01", title: "Starting Five", shortTitle: "Starting Five", icon: "grid" },
  "team-journey": { n: "02", title: "Team Journey", shortTitle: "Team Journey", icon: "route" },
  "teammate-challenge": {
    n: "03",
    title: "Teammate Challenge",
    shortTitle: "Teammates",
    icon: "users",
  },
  "career-stats": { n: "04", title: "Career Stats", shortTitle: "Career Stats", icon: "chart" },
  "box-score": { n: "05", title: "Box Score", shortTitle: "Box Score", icon: "table" },
  "top-10": { n: "06", title: "Top 10 Challenge", shortTitle: "Top 10", icon: "list" },
};

export const MODES = Object.fromEntries(
  GAME_MODES.map((slug) => [slug, { slug, ...BASE[slug] }]),
) as Record<GameMode, ModeInfo>;

export const MODE_LIST: ModeInfo[] = GAME_MODES.map((m) => MODES[m]);

/** Home "Featured games" (design: Starting Five, Career Stats, Top 10). */
export const FEATURED_MODES: GameMode[] = ["starting-five", "career-stats", "top-10"];

export function isGameModeSlug(value: string): value is GameMode {
  return (GAME_MODES as readonly string[]).includes(value);
}

/** DifficultySelector meta line, derived from the real rules so it never drifts from the server. */
export function difficultyMeta(mode: GameMode, d: Difficulty, t: Messages): string {
  const tx = t.difficulty;
  if (mode === "top-10")
    return `${tx.blanks(TOP10_HIDDEN_ROWS[d])} · ${tx.seconds(TOP10_TIME_LIMIT_SEC)}`;
  const rule = DIFFICULTY_RULES[d];
  const base =
    rule.input === "choices"
      ? `${tx.options(rule.optionCount ?? 0)} · ${tx.seconds(rule.timeLimitSec)}`
      : `${tx.search} · ${tx.seconds(rule.timeLimitSec)}`;
  return rule.reducedHints ? `${base} · ${tx.fewerHints}` : base;
}

export function modeTitle(mode: GameMode | "daily", t: Messages): string {
  return mode === "daily" ? t.dailyTitle : MODES[mode].title;
}
