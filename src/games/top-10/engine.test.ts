import { describe, expect, it } from "vitest";
import type { StatLeaderboard } from "@/data/schema";
import type { NbaDataSource } from "@/data/source";
import { TOP10_HIDDEN_ROWS, TOP10_LISTS_PER_SESSION, TOP10_TIME_LIMIT_SEC } from "../core/difficulty";
import { createRng } from "../core/rng";
import { DIFFICULTIES, type Difficulty, type EraFilter, type GeneratedQuestion } from "../core/types";
import { ds, ERA_FILTERS, generate, runEngineContract, SEEDS } from "../shared/engine-contract.testutil";
import { engine } from "./engine";

runEngineContract(engine);

function boardOf(q: GeneratedQuestion, source: NbaDataSource = ds): StatLeaderboard {
  const board = source.getLeaderboards().find((b) => `t10:${b.id}` === q.key);
  if (!board) throw new Error(`no list for ${q.key}`);
  return board;
}

function slotsOf(q: GeneratedQuestion | null): Record<string, string> {
  if (!q || q.answerKey.kind !== "slots") throw new Error("shape");
  return q.answerKey.slots;
}

/** Every list one RNG stream yields until the engine runs dry. */
function exhaust(source: NbaDataSource, difficulty: Difficulty, era: EraFilter): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  const keys = new Set<string>();
  const rng = createRng(1);
  for (let q = engine.generateQuestion(source, difficulty, rng, keys, era); q; q = engine.generateQuestion(source, difficulty, rng, keys, era)) {
    out.push(q);
    keys.add(q.key);
  }
  return out;
}

function list(id: string, scope: StatLeaderboard["scope"], playerIds: string[]): StatLeaderboard {
  return {
    id,
    title: id,
    statLabel: "X",
    asOf: "2026-11-19",
    source: "test-fixture",
    scope,
    rows: playerIds.map((playerId, i) => ({ rank: i + 1, playerId, value: 100 - i })),
  };
}

describe("top-10 specifics", () => {
  it("uses the list timing and session length", () => {
    expect(engine.questionsPerSession).toBe(TOP10_LISTS_PER_SESSION);
    const q = generate(engine, "easy", 1);
    expect(q.timeLimitSec).toBe(TOP10_TIME_LIMIT_SEC);
    expect(q.input).toBe("top10");
    expect(q.options).toBeNull();
    if (q.content.mode !== "top-10") throw new Error("shape");
    expect(q.content.listIndex).toBe(1);
    expect(q.content.listTotal).toBe(TOP10_LISTS_PER_SESSION);
  });

  for (const era of ERA_FILTERS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${era}/${difficulty}: hides exactly ${TOP10_HIDDEN_ROWS[difficulty]} rows and keys only those`, () => {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed, new Set(), era);
          if (q.content.mode !== "top-10" || q.answerKey.kind !== "slots") throw new Error("shape");
          const slots = q.answerKey.slots;
          const content = q.content;
          const board = boardOf(q);
          const hidden = content.rows.filter((r) => r.player === null);
          expect(content.rows).toHaveLength(10);
          expect(content.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
          expect(hidden).toHaveLength(TOP10_HIDDEN_ROWS[difficulty]);
          expect(Object.keys(slots).sort()).toEqual(hidden.map((r) => String(r.rank)).sort());
          for (const row of board.rows) {
            const shown = content.rows.find((r) => r.rank === row.rank);
            expect(shown?.value).toBe(row.value);
            if (shown?.player) expect(shown.player.id).toBe(row.playerId);
            else expect(slots[String(row.rank)]).toBe(row.playerId);
          }
        }
      });
    }
  }
});

describe("top-10 eras (ISKELET F16)", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`current/${difficulty}: plays only the active-player lists`, () => {
      const lists = new Set<string>();
      for (const seed of SEEDS) {
        const q = generate(engine, difficulty, seed, new Set(), "current");
        expect(boardOf(q).scope).toBe("active");
        for (const id of Object.values(slotsOf(q))) expect(ds.getPlayer(id)?.active).toBe(true);
        lists.add(q.key);
      }
      expect(lists.size).toBeGreaterThanOrEqual(TOP10_LISTS_PER_SESSION);
    });

    it(`retired/${difficulty}: plays all-time lists and hides only retired players' rows`, () => {
      for (const seed of SEEDS) {
        const q = generate(engine, difficulty, seed, new Set(), "retired");
        if (q.content.mode !== "top-10") throw new Error("shape");
        const board = boardOf(q);
        expect(board.scope).toBe("all-time");
        for (const id of Object.values(slotsOf(q))) expect(ds.getPlayer(id)?.active).toBe(false);
        for (const row of board.rows) {
          // Active players (e.g. LeBron James in Career Points) always stay visible.
          if (ds.getPlayer(row.playerId)?.active) {
            expect(q.content.rows.find((r) => r.rank === row.rank)?.player?.id).toBe(row.playerId);
          }
        }
      }
    });

    it(`all/${difficulty}: plays only the all-time lists, as before the era split`, () => {
      for (const seed of SEEDS) expect(boardOf(generate(engine, difficulty, seed)).scope).toBe("all-time");
    });
  }

  it("retired: skips a list at difficulties that hide more rows than it has retired players", () => {
    // 7 active + 3 retired players: usable at Easy (2 hidden) and Medium (3), not at Hard (4) or Expert (5).
    const mixed = list("mixed", "all-time", [
      "2544", "201939", "201142", "201935", "201566", "202681", "203507", "977", "1717", "2546",
    ]);
    const source: NbaDataSource = { ...ds, getLeaderboards: () => [mixed, ...ds.getLeaderboards()] };
    for (const difficulty of DIFFICULTIES) {
      const used = exhaust(source, difficulty, "retired").map((q) => q.key);
      expect(used.includes("t10:mixed"), difficulty).toBe(TOP10_HIDDEN_ROWS[difficulty] <= 3);
    }
    expect(exhaust(source, "easy", "current").some((q) => q.key === "t10:mixed")).toBe(false);
  });

  it("current: never hides a non-active player that slipped into an active list", () => {
    // Chris Paul (retired in the snapshot) inside an "active" list stays a visible row.
    const stale = list("stale", "active", [
      "2544", "201939", "201142", "201935", "201566", "202681", "203507", "101108", "202331", "203081",
    ]);
    const source: NbaDataSource = { ...ds, getLeaderboards: () => [stale] };
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const q = engine.generateQuestion(source, difficulty, createRng(seed), new Set(), "current");
        expect(Object.values(slotsOf(q))).not.toContain("101108");
      }
    }
  });
});
