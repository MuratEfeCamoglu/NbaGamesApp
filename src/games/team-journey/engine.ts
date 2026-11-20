// F2 Team Journey — chronological teams of a player who played for ≥2 franchises.
import type { CareerStint } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { DIFFICULTY_RULES, SESSION_LENGTH } from "../core/difficulty";
import type { GameEngine } from "../core/types";
import { getPoolIds, singleAnswerQuestion } from "../shared/question";
import { formatYears } from "../shared/years";

const MIN_FRANCHISES = 2;

/** One displayed stint: consecutive stints of the same franchise merged into one. */
export interface JourneyStint {
  teamId: string;
  fromSeason: string;
  toSeason: string;
}

interface JourneyIndex {
  /** Eligible player id → merged stints. */
  journeys: Map<string, JourneyStint[]>;
  /** Players whose clue is unique with years visible (Easy/Medium/Hard). */
  uniqueWithYears: Set<string>;
  /** Players whose ordered team sequence alone is unique (Expert). */
  uniqueSequence: Set<string>;
}

// Built once per data source: generation stays O(pool) instead of re-scanning every journey.
const indexCache = new WeakMap<NbaDataSource, JourneyIndex>();

function franchiseOf(ds: NbaDataSource, teamId: string): string {
  return ds.getTeam(teamId)?.franchiseId ?? teamId;
}

/**
 * Merges consecutive stints of the same franchise (SEA→OKC, NOH→NOK→NOH) so a relocation or
 * rename is not shown as a team change. The merged stint spans both year ranges and keeps the
 * abbreviation of its LAST part — the name the franchise had when the player left (e.g. Durant
 * SEA 2007-08 + OKC 2008-16 → OKC 2007–16).
 */
export function mergeFranchiseStints(ds: NbaDataSource, stints: readonly CareerStint[]): JourneyStint[] {
  const sorted = [...stints].sort((a, b) => a.order - b.order);
  const merged: JourneyStint[] = [];
  let lastFranchise: string | null = null;
  for (const s of sorted) {
    const franchise = franchiseOf(ds, s.teamId);
    const prev = merged[merged.length - 1];
    if (prev && franchise === lastFranchise) {
      prev.teamId = s.teamId;
      prev.toSeason = s.toSeason;
    } else {
      merged.push({ teamId: s.teamId, fromSeason: s.fromSeason, toSeason: s.toSeason });
    }
    lastFranchise = franchise;
  }
  return merged;
}

function sequenceKey(journey: readonly JourneyStint[]): string {
  return journey.map((s) => s.teamId).join(">");
}

function yearsKey(journey: readonly JourneyStint[]): string {
  return journey.map((s) => `${s.teamId}:${formatYears(s.fromSeason, s.toSeason)}`).join(">");
}

function countKeys(keys: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

export function getJourneyIndex(ds: NbaDataSource): JourneyIndex {
  const cached = indexCache.get(ds);
  if (cached) return cached;

  const journeys = new Map<string, JourneyStint[]>();
  // ≥2 distinct franchises implies ≥2 distinct team ids, so this is a superset of the eligible set.
  for (const p of ds.getPlayersWithStints(MIN_FRANCHISES)) {
    const journey = mergeFranchiseStints(ds, ds.getCareerStints(p.id));
    const franchises = new Set(journey.map((s) => franchiseOf(ds, s.teamId)));
    if (franchises.size >= MIN_FRANCHISES) journeys.set(p.id, journey);
  }

  // Uniqueness is checked over ALL eligible players (not only the difficulty pool): search input
  // offers every player, so any other player with the same clue would be a valid-looking answer.
  const seqCounts = countKeys([...journeys.values()].map(sequenceKey));
  const yearCounts = countKeys([...journeys.values()].map(yearsKey));
  const uniqueSequence = new Set<string>();
  const uniqueWithYears = new Set<string>();
  for (const [id, journey] of journeys) {
    if (seqCounts.get(sequenceKey(journey)) === 1) uniqueSequence.add(id);
    if (yearCounts.get(yearsKey(journey)) === 1) uniqueWithYears.add(id);
  }

  const index = { journeys, uniqueWithYears, uniqueSequence };
  indexCache.set(ds, index);
  return index;
}

export const engine: GameEngine = {
  mode: "team-journey",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude, era = "all") {
    const hide = DIFFICULTY_RULES[difficulty].reducedHints;
    // The index (and its uniqueness sets) is era-independent: an active and a retired player with
    // the same clue would both be valid-looking answers, because search offers every player.
    const index = getJourneyIndex(ds);
    const unique = hide ? index.uniqueSequence : index.uniqueWithYears;
    const pool = getPoolIds(ds, difficulty, era);
    const candidates = ds
      .getPlayersWithStints(MIN_FRANCHISES)
      .filter((p) => unique.has(p.id) && pool.has(p.id) && !exclude.has(`tj:${p.id}`));
    if (candidates.length === 0) return null;

    const player = rng.pick(candidates);
    const journey = index.journeys.get(player.id) ?? [];

    return singleAnswerQuestion({
      ds,
      mode: "team-journey",
      difficulty,
      key: `tj:${player.id}`,
      answerId: player.id,
      rng,
      era,
      content: {
        mode: "team-journey",
        stints: journey.map((s) => ({
          teamId: s.teamId,
          years: hide ? null : formatYears(s.fromSeason, s.toSeason),
        })),
        seasons: hide ? null : (ds.getCareerStats(player.id)?.seasons ?? null),
        allStarCount: hide ? null : player.allStarCount,
      },
    });
  },
};
