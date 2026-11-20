// Shared contract checks every mode engine must pass (ISKELET §6 Aşama 3 "Bitti Kriteri"),
// for every era filter (ISKELET F16): "all" (pre-split behaviour, Daily) plus each era.
import { describe, expect, it } from "vitest";
import { DIFFICULTY_RULES } from "../core/difficulty";
import { createRng } from "../core/rng";
import {
  DIFFICULTIES,
  ERAS,
  type Difficulty,
  type EraFilter,
  type GameEngine,
  type GeneratedQuestion,
} from "../core/types";
import { createFixtureDataSource } from "../test-fixtures";
import { matchesEra } from "./era";
import { toPublicQuestion } from "./public";

export const SEEDS = Array.from({ length: 100 }, (_, i) => i);
export const ds = createFixtureDataSource();
export const ERA_FILTERS: readonly EraFilter[] = ["all", ...ERAS];

export function generate(
  engine: GameEngine,
  difficulty: Difficulty,
  seed: number,
  exclude: ReadonlySet<string> = new Set(),
  era: EraFilter = "all",
): GeneratedQuestion {
  const q = engine.generateQuestion(ds, difficulty, createRng(seed), exclude, era);
  if (!q) throw new Error(`${engine.mode}/${difficulty}/${era}/seed ${seed}: no question`);
  return q;
}

/** Players the answer key names: the single answer, or every hidden Top 10 row. */
export function answerIds(q: GeneratedQuestion): string[] {
  return q.answerKey.kind === "player" ? [q.answerKey.playerId] : Object.values(q.answerKey.slots);
}

/** F16 rule 1: every answer player exists and matches the era. */
export function expectAnswersInEra(q: GeneratedQuestion, era: EraFilter): void {
  for (const id of answerIds(q)) {
    const player = ds.getPlayer(id);
    expect(player, `answer ${id}`).toBeDefined();
    if (player) expect(matchesEra(player, era), `${player.name} (active: ${player.active}) in era ${era}`).toBe(true);
  }
}

export function runEngineContract(engine: GameEngine): void {
  describe(`${engine.mode} engine contract`, () => {
    for (const era of ERA_FILTERS) {
      describe(`era ${era}`, () => {
        for (const difficulty of DIFFICULTIES) {
          const rule = DIFFICULTY_RULES[difficulty];

          it(`${difficulty}: 100 seeds produce valid, deterministic questions`, () => {
            for (const seed of SEEDS) {
              const q = generate(engine, difficulty, seed, new Set(), era);
              expect(q.mode).toBe(engine.mode);
              expect(q.difficulty).toBe(difficulty);
              expect(q.content.mode).toBe(engine.mode);
              expect(q.key.length).toBeGreaterThan(0);
              expect(generate(engine, difficulty, seed, new Set(), era)).toEqual(q);
              expectAnswersInEra(q, era);

              if (engine.mode === "top-10") continue;
              expect(q.timeLimitSec).toBe(rule.timeLimitSec);
              expect(q.input).toBe(rule.input);
              expect(q.answerKey.kind).toBe("player");
              if (q.answerKey.kind !== "player") continue;
              const answer = ds.getPlayer(q.answerKey.playerId);
              expect(answer).toBeDefined();
              expect(answer?.fameTier ?? 99).toBeLessThanOrEqual(rule.maxFameTier);

              if (rule.input === "choices") {
                const ids = (q.options ?? []).map((o) => o.id);
                expect(ids).toHaveLength(rule.optionCount ?? -1);
                expect(new Set(ids).size).toBe(ids.length);
                expect(ids).toContain(q.answerKey.playerId);
                for (const o of q.options ?? []) {
                  const p = ds.getPlayer(o.id);
                  expect(p?.name).toBe(o.label);
                  expect(p?.fameTier ?? 99).toBeLessThanOrEqual(rule.maxFameTier);
                  // F16 rule 2: distractors come from the same era pool.
                  if (p) expect(matchesEra(p, era), `option ${p.name} in era ${era}`).toBe(true);
                }
              } else {
                expect(q.options).toBeNull();
              }
            }
          });

          it(`${difficulty}: respects exclude and can fill a session`, () => {
            for (const seed of SEEDS.slice(0, 20)) {
              const first = generate(engine, difficulty, seed, new Set(), era);
              const second = engine.generateQuestion(ds, difficulty, createRng(seed), new Set([first.key]), era);
              expect(second?.key).not.toBe(first.key);

              const keys = new Set<string>();
              const rng = createRng(seed);
              for (let i = 0; i < engine.questionsPerSession; i++) {
                const q = engine.generateQuestion(ds, difficulty, rng, keys, era);
                expect(q, `question ${i + 1} of the session`).not.toBeNull();
                if (!q) break;
                expect(keys.has(q.key)).toBe(false);
                expectAnswersInEra(q, era);
                keys.add(q.key);
              }
            }
          });

          it(`${difficulty}: public question leaks neither key nor answer`, () => {
            for (const seed of SEEDS) {
              const q = generate(engine, difficulty, seed, new Set(), era);
              const pub = toPublicQuestion(q, 0, engine.questionsPerSession, new Date(0));
              expect(pub).not.toHaveProperty("answerKey");
              expect(pub).not.toHaveProperty("key");
              const contentJson = JSON.stringify(pub.content);
              for (const id of answerIds(q)) expect(contentJson).not.toContain(`"${id}"`);
            }
          });
        }

        it("returns null when everything is excluded", () => {
          // "Everything" is collected over several RNG streams: Teammate Challenge searches clue
          // sets randomly with a bounded number of attempts, so a single stream can run dry while
          // skipping a hard-to-clue target that another stream finds.
          const keys = new Set<string>();
          for (let stream = 0; stream < 25; stream++) {
            const rng = createRng(`exhaust:${stream}`);
            for (let i = 0; i < 1000; i++) {
              const q = engine.generateQuestion(ds, "hard", rng, keys, era);
              if (!q) break;
              keys.add(q.key);
            }
          }
          expect(keys.size).toBeGreaterThan(0);
          expect(engine.generateQuestion(ds, "hard", createRng(2), keys, era)).toBeNull();
        });
      });
    }

    it('era defaults to "all" (Daily and legacy sessions keep the pre-F16 behaviour)', () => {
      for (const difficulty of DIFFICULTIES) {
        for (const seed of SEEDS.slice(0, 20)) {
          expect(engine.generateQuestion(ds, difficulty, createRng(seed), new Set())).toEqual(
            engine.generateQuestion(ds, difficulty, createRng(seed), new Set(), "all"),
          );
        }
      }
    });
  });
}
