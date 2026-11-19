// Mode copy for cards, intro and history — text taken from design/design.html (Games section + demo MODES).
import { GAME_MODES, type Difficulty, type GameMode } from "@/games/core/types";
import {
  DIFFICULTY_RULES,
  TOP10_HIDDEN_ROWS,
  TOP10_LISTS_PER_SESSION,
  TOP10_TIME_LIMIT_SEC,
  SESSION_LENGTH,
} from "@/games/core/difficulty";
import type { IconName } from "@/components/ui/icon";

export interface ModeInfo {
  slug: GameMode;
  /** "01".."06" — card index and "Mode 01" badge */
  n: string;
  title: string;
  /** Short title used in tight places (design mode tabs: "Teammates", "Top 10"). */
  shortTitle: string;
  icon: IconName;
  /** Games grid card description */
  cardDesc: string;
  /** Home "Featured games" description */
  featuredDesc: string;
  rules: [string, string];
  /** Intro (Game Detail phase a) */
  introDesc: string;
  introRule: string;
  lengthLabel: string;
}

const questionsLabel = `${SESSION_LENGTH} questions`;
const top10Label = `${TOP10_LISTS_PER_SESSION} lists · ${TOP10_TIME_LIMIT_SEC}s`;

export const MODES: Record<GameMode, ModeInfo> = {
  "starting-five": {
    slug: "starting-five",
    n: "01",
    title: "Starting Five",
    shortTitle: "Starting Five",
    icon: "grid",
    cardDesc: "A real opening-night lineup with one slot left blank.",
    featuredDesc: "Four starters are on the floor. Name the fifth.",
    rules: ["See 4 starters: name, position, photo", "Find the missing fifth player"],
    introDesc: "A real opening-night lineup with one slot left blank. Name the missing starter.",
    introRule: "You see 4 starters with name, position and photo.",
    lengthLabel: questionsLabel,
  },
  "team-journey": {
    slug: "team-journey",
    n: "02",
    title: "Team Journey",
    shortTitle: "Team Journey",
    icon: "route",
    cardDesc: "Follow a career stop by stop and name the traveller.",
    featuredDesc: "Follow a career stop by stop and name the traveller.",
    rules: ["Teams shown in order with years", "Guess the player"],
    introDesc: "Every stop of a career, in order. Who made the trip?",
    introRule: "Teams appear on a timeline with the years spent there.",
    lengthLabel: questionsLabel,
  },
  "teammate-challenge": {
    slug: "teammate-challenge",
    n: "03",
    title: "Teammate Challenge",
    shortTitle: "Teammates",
    icon: "users",
    cardDesc: "Who shared a locker room with all of them?",
    featuredDesc: "Who shared a locker room with all of them?",
    rules: ["2–5 teammates with team and season", "Name the common player"],
    introDesc: "Two to five teammates, one common link. Find him.",
    introRule: "Each card shows a teammate with the team and seasons they shared.",
    lengthLabel: questionsLabel,
  },
  "career-stats": {
    slug: "career-stats",
    n: "04",
    title: "Career Stats",
    shortTitle: "Career Stats",
    icon: "chart",
    cardDesc: "A career told in averages. No names, just numbers.",
    featuredDesc: "PPG, RPG, APG and more. Whose career is it?",
    rules: ["PPG, RPG, APG, SPG, BPG, FG%", "Games, seasons and position"],
    introDesc: "A whole career in averages. No names, just numbers.",
    introRule: "PPG, RPG, APG, SPG, BPG, FG%, games, seasons and position.",
    lengthLabel: questionsLabel,
  },
  "box-score": {
    slug: "box-score",
    n: "05",
    title: "Box Score",
    shortTitle: "Box Score",
    icon: "table",
    cardDesc: "One stat line from a real game. Whose night was it?",
    featuredDesc: "One stat line from a real game. Whose night was it?",
    rules: ["MIN, PTS, REB, AST, STL, BLK, FG, 3P", "Date, matchup and final score"],
    introDesc: "One player's line from a real game. Whose night was it?",
    introRule: "Classic box score row plus date, matchup and final score.",
    lengthLabel: questionsLabel,
  },
  "top-10": {
    slug: "top-10",
    n: "06",
    title: "Top 10 Challenge",
    shortTitle: "Top 10",
    icon: "list",
    cardDesc: "An all-time ranking with gaps. Fill every blank.",
    featuredDesc: "Fill the blanks in an all-time ranking before the clock runs out.",
    rules: [
      `${TOP10_LISTS_PER_SESSION} lists, ${TOP10_TIME_LIMIT_SEC} seconds each`,
      "Points for every hidden row you fill",
    ],
    introDesc: "An all-time ranking with gaps. Fill every hidden row before time runs out.",
    introRule: `Pick a player for every blank row. Each list has ${TOP10_TIME_LIMIT_SEC} seconds.`,
    lengthLabel: top10Label,
  },
};

export const MODE_LIST: ModeInfo[] = GAME_MODES.map((m) => MODES[m]);

/** Home "Featured games" (design: Starting Five, Career Stats, Top 10). */
export const FEATURED_MODES: GameMode[] = ["starting-five", "career-stats", "top-10"];

export function isGameModeSlug(value: string): value is GameMode {
  return (GAME_MODES as readonly string[]).includes(value);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

/** DifficultySelector meta line, derived from the real rules so it never drifts from the server. */
export function difficultyMeta(mode: GameMode, d: Difficulty): string {
  if (mode === "top-10") return `${TOP10_HIDDEN_ROWS[d]} blanks · ${TOP10_TIME_LIMIT_SEC}s`;
  const rule = DIFFICULTY_RULES[d];
  const base =
    rule.input === "choices"
      ? `${rule.optionCount ?? 0} options · ${rule.timeLimitSec}s`
      : `Search · ${rule.timeLimitSec}s`;
  return rule.reducedHints ? `${base} · fewer hints` : base;
}

export function modeTitle(mode: GameMode | "daily"): string {
  return mode === "daily" ? "Daily Challenge" : MODES[mode].title;
}
