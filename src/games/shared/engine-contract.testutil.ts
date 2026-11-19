// Shared contract checks every mode engine must pass (ISKELET §6 Aşama 3 "Bitti Kriteri").
import { describe, expect, it } from "vitest";
import { DIFFICULTY_RULES } from "../core/difficulty";
import { createRng } from "../core/rng";
import { DIFFICULTIES, type Difficulty, type GameEngine, type GeneratedQuestion } from "../core/types";
import { createFixtureDataSource } from "../test-fixtures";
import { toPublicQuestion } from "./public";

export const SEEDS = Array.from({ length: 100 }, (_, i) => i);
export const ds = createFixtureDataSource();

export function generate(
  engine: GameEngine,
  difficulty: Difficulty,
  seed: number,
  exclude: ReadonlySet<string> = new Set(),
): GeneratedQuestion {
  const q = engine.generateQuestion(ds, difficulty, createRng(seed), exclude);
  if (!q) throw new Error(`${engine.mode}/${difficulty}/seed ${seed}: no question`);
  return q;
}

export function runEngineContract(engine: GameEngine): void {
  describe(`${engine.mode} engine contract`, () => {
    for (const difficulty of DIFFICULTIES) {
      const rule = DIFFICULTY_RULES[difficulty];

      it(`${difficulty}: 100 seeds produce valid, deterministic questions`, () => {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed);
          expect(q.mode).toBe(engine.mode);
          expect(q.difficulty).toBe(difficulty);
          expect(q.content.mode).toBe(engine.mode);
          expect(q.key.length).toBeGreaterThan(0);
          expect(generate(engine, difficulty, seed)).toEqual(q);

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
            }
          } else {
            expect(q.options).toBeNull();
          }
        }
      });

      it(`${difficulty}: respects exclude and can fill a session`, () => {
        for (const seed of SEEDS.slice(0, 20)) {
          const first = generate(engine, difficulty, seed);
          const second = engine.generateQuestion(ds, difficulty, createRng(seed), new Set([first.key]));
          expect(second?.key).not.toBe(first.key);

          const keys = new Set<string>();
          const rng = createRng(seed);
          for (let i = 0; i < engine.questionsPerSession; i++) {
            const q = engine.generateQuestion(ds, difficulty, rng, keys);
            expect(q, `question ${i + 1} of the session`).not.toBeNull();
            if (!q) break;
            expect(keys.has(q.key)).toBe(false);
            keys.add(q.key);
          }
        }
      });

      it(`${difficulty}: public question leaks neither key nor answer`, () => {
        for (const seed of SEEDS) {
          const q = generate(engine, difficulty, seed);
          const pub = toPublicQuestion(q, 0, engine.questionsPerSession, new Date(0));
          expect(pub).not.toHaveProperty("answerKey");
          expect(pub).not.toHaveProperty("key");
          const contentJson = JSON.stringify(pub.content);
          const hiddenIds =
            q.answerKey.kind === "player" ? [q.answerKey.playerId] : Object.values(q.answerKey.slots);
          for (const id of hiddenIds) expect(contentJson).not.toContain(`"${id}"`);
        }
      });
    }

    it("returns null when everything is excluded", () => {
      const keys = new Set<string>();
      const rng = createRng(1);
      for (let i = 0; i < 1000; i++) {
        const q = engine.generateQuestion(ds, "hard", rng, keys);
        if (!q) break;
        keys.add(q.key);
      }
      expect(engine.generateQuestion(ds, "hard", createRng(2), keys)).toBeNull();
    });
  });
}
