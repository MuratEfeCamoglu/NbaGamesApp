// Integration test: every engine × difficulty × era generates full sessions from the REAL seed, fast
// and leak-free, and every answer matches the era (ISKELET F16: 6 modes × 4 difficulties × 2 eras,
// plus "all" — the pre-split behaviour used by the Daily Challenge).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStaticDataSource } from "@/data/build-source";
import { seedFileSchemas, type SeedFileName } from "@/data/schema";
import { CURRENT_ERA_LINEUP_SEASONS, DIFFICULTY_RULES } from "@/games/core/difficulty";
import { getEngine } from "@/games/core/registry";
import { createRng } from "@/games/core/rng";
import { DIFFICULTIES, ERAS, GAME_MODES, type EraFilter, type GeneratedQuestion } from "@/games/core/types";
import { matchesEra } from "@/games/shared/era";
import { toPublicQuestion } from "@/games/shared/public";

const root = path.join(process.cwd(), "src/data/seed");
const files = Object.fromEntries(
  (Object.keys(seedFileSchemas) as SeedFileName[]).map((n) => [n, JSON.parse(readFileSync(path.join(root, n), "utf8"))]),
) as Record<SeedFileName, unknown>;
const ds = createStaticDataSource(files);

const ERA_FILTERS: readonly EraFilter[] = ["all", ...ERAS];
// Computed independently of the engine: the newest lineup seasons form the current era.
const currentSeasons = new Set(
  [...new Set(ds.getStartingFives().map((l) => l.season))].sort().slice(-CURRENT_ERA_LINEUP_SEASONS),
);

function expectEraRules(q: GeneratedQuestion, era: EraFilter, label: string): void {
  const answers = q.answerKey.kind === "player" ? [q.answerKey.playerId] : Object.values(q.answerKey.slots);
  for (const id of answers) {
    const p = ds.getPlayer(id);
    expect(p && matchesEra(p, era), `${label}: answer ${p?.name ?? id} (active: ${p?.active})`).toBe(true);
  }
  const maxTier = DIFFICULTY_RULES[q.difficulty].maxFameTier;
  for (const o of q.options ?? []) {
    const p = ds.getPlayer(o.id);
    expect(p !== undefined && matchesEra(p, era) && p.fameTier <= maxTier, `${label}: option ${o.label}`).toBe(true);
  }
  if (era === "all") return;
  if (q.mode === "starting-five") {
    const lineup = ds.getStartingFives().find((l) => l.id === q.key.split(":")[1]);
    expect(lineup && currentSeasons.has(lineup.season), `${label}: lineup ${lineup?.id}`).toBe(era === "current");
  }
  if (q.mode === "top-10") {
    const board = ds.getLeaderboards().find((b) => `t10:${b.id}` === q.key);
    expect(board?.scope, `${label}: list ${board?.id}`).toBe(era === "current" ? "active" : "all-time");
  }
}

describe("engines on real seed", () => {
  for (const era of ERA_FILTERS) {
    for (const mode of GAME_MODES) {
      for (const d of DIFFICULTIES) {
        it(`${mode}/${d}/${era}: full session x 20 seeds, era-matched answers, timing`, () => {
          const engine = getEngine(mode);
          let worst = 0;
          for (let s = 0; s < 20; s++) {
            // "all" keeps the pre-F16 probe seeds.
            const rng = createRng(era === "all" ? `probe:${mode}:${d}:${s}` : `probe:${mode}:${d}:${era}:${s}`);
            const ex = new Set<string>();
            const t0 = performance.now();
            for (let i = 0; i < engine.questionsPerSession; i++) {
              const q = engine.generateQuestion(ds, d, rng, ex, era);
              expect(q, `${mode}/${d}/${era} seed ${s}: null at q${i}`).not.toBeNull();
              if (!q) break;
              ex.add(q.key);
              const pub = JSON.stringify(toPublicQuestion(q, i, engine.questionsPerSession, new Date()));
              expect(pub).not.toContain("answerKey");
              if (q.answerKey.kind === "player") {
                expect(JSON.stringify(q.content)).not.toContain(`"${q.answerKey.playerId}"`);
              }
              expectEraRules(q, era, `${mode}/${d}/${era} seed ${s} q${i}`);
            }
            worst = Math.max(worst, performance.now() - t0);
          }
          console.log(`${mode}/${d}/${era} worst session gen ms: ${worst.toFixed(1)}`);
          expect(worst).toBeLessThan(2000);
        });
      }
    }
  }
});
