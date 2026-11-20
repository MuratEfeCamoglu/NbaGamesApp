// F3 Teammate Challenge — teammates who shared a team-season with the target; the user names the target.
import type { Player } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { DIFFICULTY_RULES, SESSION_LENGTH, TEAMMATES_SHOWN } from "../core/difficulty";
import type { GameEngine, Rng } from "../core/types";
import { toPlayerRef } from "../shared/player-ref";
import { getPool, singleAnswerQuestion } from "../shared/question";

/** Different clue sets tried per target before moving on to another target. */
const MAX_SET_ATTEMPTS = 12;

interface Link {
  mate: Player;
  teamId: string;
  season: string;
}

// playerId → every teammate id. Depends only on the (immutable) data source, so it is shared
// across questions instead of being rebuilt for each one.
const teammateCache = new WeakMap<NbaDataSource, Map<string, Set<string>>>();

function teammateSets(ds: NbaDataSource): Map<string, Set<string>> {
  let cache = teammateCache.get(ds);
  if (!cache) {
    cache = new Map();
    teammateCache.set(ds, cache);
  }
  return cache;
}

export const engine: GameEngine = {
  mode: "teammate-challenge",
  questionsPerSession: SESSION_LENGTH,
  generateQuestion(ds, difficulty, rng, exclude, era = "all") {
    const shownCount = TEAMMATES_SHOWN[difficulty];
    // Only the target is era-bound; the shown teammates may be of either era, and uniqueness is
    // checked against every player (search offers everyone).
    const candidates = getPool(ds, difficulty, era).filter(
      (p) => !exclude.has(`tm:${p.id}`) && ds.getRosterEntries(p.id).length > 0,
    );
    const cache = teammateSets(ds);

    for (const target of rng.shuffle(candidates)) {
      const linksByMate = collectLinks(ds, target.id);
      if (linksByMate.size < shownCount) continue;

      for (let attempt = 0; attempt < MAX_SET_ATTEMPTS; attempt++) {
        const chosen = chooseLinks(linksByMate, shownCount, rng, attempt === 0);
        if (!identifiesUniquely(ds, target.id, chosen, cache)) continue;

        const hideSeason = DIFFICULTY_RULES[difficulty].reducedHints;
        return singleAnswerQuestion({
          ds,
          mode: "teammate-challenge",
          difficulty,
          key: `tm:${target.id}`,
          answerId: target.id,
          rng,
          era,
          avoidOptionIds: new Set(chosen.map((l) => l.mate.id)),
          content: {
            mode: "teammate-challenge",
            teammates: chosen.map((l) => ({
              player: toPlayerRef(ds, l.mate.id, l.teamId),
              teamId: l.teamId,
              season: hideSeason ? null : l.season,
            })),
          },
        });
      }
    }
    return null;
  },
};

function collectLinks(ds: NbaDataSource, targetId: string): Map<string, Link[]> {
  const byMate = new Map<string, Link[]>();
  for (const entry of ds.getRosterEntries(targetId)) {
    for (const mate of ds.getTeammates(targetId, entry.teamId, entry.season)) {
      if (mate.id === targetId) continue;
      const list = byMate.get(mate.id) ?? [];
      list.push({ mate, teamId: entry.teamId, season: entry.season });
      byMate.set(mate.id, list);
    }
  }
  return byMate;
}

/**
 * First attempt: most famous teammates first (low fameTier). Later attempts: random order, so a
 * non-unique famous set can be replaced. Both prefer covering different team-seasons.
 */
function chooseLinks(byMate: Map<string, Link[]>, count: number, rng: Rng, famousFirst: boolean): Link[] {
  const mates = rng.shuffle([...byMate.keys()]);
  if (famousFirst) {
    // Array.prototype.sort is stable, so the shuffle above breaks fameTier ties.
    mates.sort((a, b) => (byMate.get(a)?.[0]?.mate.fameTier ?? 3) - (byMate.get(b)?.[0]?.mate.fameTier ?? 3));
  }

  const chosen: Link[] = [];
  const usedTeamSeasons = new Set<string>();
  const chosenMates = new Set<string>();
  for (const mateId of mates) {
    if (chosen.length >= count) break;
    const fresh = (byMate.get(mateId) ?? []).filter((l) => !usedTeamSeasons.has(`${l.teamId}:${l.season}`));
    if (fresh.length === 0) continue;
    const link = rng.pick(fresh);
    chosen.push(link);
    chosenMates.add(mateId);
    usedTeamSeasons.add(`${link.teamId}:${link.season}`);
  }
  for (const mateId of mates) {
    if (chosen.length >= count) break;
    if (chosenMates.has(mateId)) continue;
    const links = byMate.get(mateId) ?? [];
    if (links.length === 0) continue;
    chosen.push(rng.pick(links));
    chosenMates.add(mateId);
  }
  return chosen;
}

/**
 * True when the target is the only player (besides the clues) who played with every shown
 * teammate. Era-independent on purpose: it considers every player in the data.
 */
export function identifiesUniquely(
  ds: NbaDataSource,
  targetId: string,
  links: readonly { mate: { id: string } }[],
  cache: Map<string, Set<string>> = teammateSets(ds),
): boolean {
  const shownIds = new Set(links.map((l) => l.mate.id));
  if (shownIds.size === 0) return false;
  let common: string[] | null = null;
  for (const id of shownIds) {
    const mates = allTeammates(ds, id, cache);
    common = common === null ? [...mates] : common.filter((x: string) => mates.has(x));
  }
  const others = (common ?? []).filter((id) => !shownIds.has(id));
  return others.length === 1 && others[0] === targetId;
}

function allTeammates(ds: NbaDataSource, playerId: string, cache: Map<string, Set<string>>): Set<string> {
  const cached = cache.get(playerId);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const entry of ds.getRosterEntries(playerId)) {
    for (const mate of ds.getTeammates(playerId, entry.teamId, entry.season)) ids.add(mate.id);
  }
  cache.set(playerId, ids);
  return ids;
}
