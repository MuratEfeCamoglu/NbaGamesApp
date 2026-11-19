// Integration test: every engine × difficulty generates full sessions from the REAL seed, fast and leak-free.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStaticDataSource } from "@/data/build-source";
import { seedFileSchemas, type SeedFileName } from "@/data/schema";
import { DIFFICULTIES, GAME_MODES } from "@/games/core/types";
import { getEngine } from "@/games/core/registry";
import { createRng } from "@/games/core/rng";
import { toPublicQuestion } from "@/games/shared/public";

const root = path.join(process.cwd(), "src/data/seed");
const files = Object.fromEntries(
  (Object.keys(seedFileSchemas) as SeedFileName[]).map((n) => [n, JSON.parse(readFileSync(path.join(root, n), "utf8"))]),
) as Record<SeedFileName, unknown>;
const ds = createStaticDataSource(files);

describe("engines on real seed", () => {
  for (const mode of GAME_MODES) {
    for (const d of DIFFICULTIES) {
      it(`${mode}/${d}: full session x 20 seeds, timing`, () => {
        const engine = getEngine(mode);
        let worst = 0;
        for (let s = 0; s < 20; s++) {
          const rng = createRng(`probe:${mode}:${d}:${s}`);
          const ex = new Set<string>();
          const t0 = performance.now();
          for (let i = 0; i < engine.questionsPerSession; i++) {
            const q = engine.generateQuestion(ds, d, rng, ex);
            expect(q, `null at q${i}`).not.toBeNull();
            ex.add(q!.key);
            const pub = JSON.stringify(toPublicQuestion(q!, i, engine.questionsPerSession, new Date()));
            expect(pub).not.toContain("answerKey");
            if (q!.answerKey.kind === "player") {
              expect(JSON.stringify(q!.content)).not.toContain(`"${q!.answerKey.playerId}"`);
            }
          }
          worst = Math.max(worst, performance.now() - t0);
        }
        console.log(`${mode}/${d} worst session gen ms: ${worst.toFixed(1)}`);
        expect(worst).toBeLessThan(2000);
      });
    }
  }
});
