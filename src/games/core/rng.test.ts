import { describe, expect, it } from "vitest";
import { createRng, dailySeed } from "./rng";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it("produces values in [0,1) and ints in range", () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it("shuffle keeps all elements", () => {
    const r = createRng(7);
    expect([...r.shuffle([1, 2, 3, 4, 5])].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("daily seed depends only on the date", () => {
    expect(dailySeed("2026-11-19")).toBe(dailySeed("2026-11-19"));
    expect(dailySeed("2026-11-19")).not.toBe(dailySeed("2026-11-20"));
  });
});
