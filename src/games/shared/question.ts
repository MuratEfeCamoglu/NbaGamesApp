import type { Player } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { DIFFICULTY_RULES } from "../core/difficulty";
import type {
  AnswerOptionView,
  Difficulty,
  EraFilter,
  GameMode,
  GeneratedQuestion,
  QuestionContent,
  Rng,
} from "../core/types";
import { matchesEra } from "./era";

interface Pool {
  players: readonly Player[];
  ids: ReadonlySet<string>;
}

// Every question needs its pool; data sources are immutable snapshots, so build each
// (difficulty, era) pool once per data source instead of once per question.
const poolCache = new WeakMap<NbaDataSource, Map<string, Pool>>();

function pool(ds: NbaDataSource, difficulty: Difficulty, era: EraFilter): Pool {
  let byKey = poolCache.get(ds);
  if (!byKey) {
    byKey = new Map();
    poolCache.set(ds, byKey);
  }
  const key = `${difficulty}|${era}`;
  let entry = byKey.get(key);
  if (!entry) {
    const players = ds
      .getPlayers({ maxFameTier: DIFFICULTY_RULES[difficulty].maxFameTier })
      .filter((p) => matchesEra(p, era));
    entry = { players, ids: new Set(players.map((p) => p.id)) };
    byKey.set(key, entry);
  }
  return entry;
}

/** Players eligible as answers (and distractors) for a difficulty and era (ISKELET §2.1, F16). */
export function getPool(ds: NbaDataSource, difficulty: Difficulty, era: EraFilter = "all"): readonly Player[] {
  return pool(ds, difficulty, era).players;
}

export function getPoolIds(ds: NbaDataSource, difficulty: Difficulty, era: EraFilter = "all"): ReadonlySet<string> {
  return pool(ds, difficulty, era).ids;
}

export type PositionGroup = "G" | "F" | "C";

/** "G-F" → G, "PF" → F, "C" → C. Unknown labels fall back to F (the most common group). */
export function positionGroup(position: string): PositionGroup {
  const first = position.trim().toUpperCase().split(/[-/ ]/)[0] ?? "";
  if (first === "C") return "C";
  if (first.endsWith("G")) return "G";
  return "F";
}

/**
 * Answer buttons for "choices" difficulties: the answer + distractors from the same pool (same
 * difficulty AND era, so an era never shows players of the other era as options), same position
 * group first so the position alone doesn't give the answer away. Returns null for search
 * difficulties — search covers every player and therefore never reveals the era (F16).
 */
export function buildOptions(
  ds: NbaDataSource,
  difficulty: Difficulty,
  answerId: string,
  rng: Rng,
  avoidIds: ReadonlySet<string> = new Set(),
  era: EraFilter = "all",
): AnswerOptionView[] | null {
  const rule = DIFFICULTY_RULES[difficulty];
  if (rule.input !== "choices" || rule.optionCount === null) return null;
  const answer = ds.getPlayer(answerId);
  if (!answer) throw new Error(`Unknown answer player: ${answerId}`);

  const group = positionGroup(answer.position);
  const candidates = getPool(ds, difficulty, era).filter((p) => p.id !== answerId && !avoidIds.has(p.id));
  const same = rng.shuffle(candidates.filter((p) => positionGroup(p.position) === group));
  const other = rng.shuffle(candidates.filter((p) => positionGroup(p.position) !== group));
  const distractors = [...same, ...other].slice(0, rule.optionCount - 1);
  if (distractors.length < rule.optionCount - 1) {
    throw new Error(`Not enough players in the ${difficulty}/${era} pool to build ${rule.optionCount} options`);
  }
  return rng.shuffle([answer, ...distractors]).map((p) => ({ id: p.id, label: p.name }));
}

/** Assembles a single-answer question with the difficulty's time/input rules. */
export function singleAnswerQuestion(args: {
  ds: NbaDataSource;
  mode: GameMode;
  difficulty: Difficulty;
  key: string;
  content: QuestionContent;
  answerId: string;
  rng: Rng;
  avoidOptionIds?: ReadonlySet<string>;
  /** Distractor era (default "all"); the caller guarantees the answer matches it. */
  era?: EraFilter;
}): GeneratedQuestion {
  const rule = DIFFICULTY_RULES[args.difficulty];
  return {
    key: args.key,
    mode: args.mode,
    difficulty: args.difficulty,
    timeLimitSec: rule.timeLimitSec,
    input: rule.input,
    options: buildOptions(args.ds, args.difficulty, args.answerId, args.rng, args.avoidOptionIds, args.era),
    content: args.content,
    answerKey: { kind: "player", playerId: args.answerId },
  };
}

/** Full team label regardless of whether the data stores "Warriors" or "Golden State Warriors". */
export function teamDisplayName(ds: NbaDataSource, teamId: string): string {
  const team = ds.getTeam(teamId);
  if (!team) return teamId;
  return team.name.includes(team.city) ? team.name : `${team.city} ${team.name}`;
}
