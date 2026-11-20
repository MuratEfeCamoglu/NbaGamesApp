import { describe, expect, it } from "vitest";
import { matchesEra } from "./era";

describe("matchesEra", () => {
  it.each([
    [true, "current", true],
    [true, "retired", false],
    [false, "current", false],
    [false, "retired", true],
    [true, "all", true],
    [false, "all", true],
  ] as const)("active=%s in era %s -> %s", (active, era, expected) => {
    expect(matchesEra({ active }, era)).toBe(expected);
  });
});
