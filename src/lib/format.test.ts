import { describe, expect, it } from "vitest";
import {
  accuracyPct,
  fmtCountdown,
  fmtGameDate,
  fmtNumber,
  fmtRelativeDay,
  initials,
  teamKey,
} from "./format";
import { en } from "./i18n";
import { difficultyMeta, isGameModeSlug } from "./modes";

describe("format", () => {
  it("formats numbers, dates and countdowns", () => {
    expect(fmtNumber(12480)).toBe("12,480");
    expect(fmtGameDate("2006-01-22")).toBe("Jan 22, 2006");
    expect(fmtCountdown(5 * 3600_000 + 12 * 60_000 + 33_000)).toBe("05:12:33");
    expect(fmtCountdown(-5)).toBe("00:00:00");
  });

  it("builds initials and team keys", () => {
    expect(initials("Shai Gilgeous-Alexander")).toBe("SG");
    expect(initials("Splash_Bro")).toBe("SB");
    expect(teamKey("GSW")).toBe("gsw");
    expect(teamKey(null)).toBeUndefined();
  });

  it("gives relative days for history", () => {
    const now = new Date(2026, 10, 19, 15, 0);
    expect(fmtRelativeDay(new Date(2026, 10, 19, 1, 0).toISOString(), now)).toBe("Today");
    expect(fmtRelativeDay(new Date(2026, 10, 18, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(fmtRelativeDay(new Date(2026, 10, 16, 12, 0).toISOString(), now)).toBe("Nov 16");
  });

  it("computes accuracy safely", () => {
    expect(accuracyPct(8, 10)).toBe(80);
    expect(accuracyPct(0, 0)).toBe(0);
  });
});

describe("modes", () => {
  it("validates slugs", () => {
    expect(isGameModeSlug("top-10")).toBe(true);
    expect(isGameModeSlug("dunk-contest")).toBe(false);
  });

  it("derives difficulty meta from the real rules", () => {
    expect(difficultyMeta("starting-five", "easy", en)).toBe("4 options · 30s");
    expect(difficultyMeta("starting-five", "medium", en)).toBe("6 options · 25s");
    expect(difficultyMeta("box-score", "hard", en)).toBe("Search · 20s");
    expect(difficultyMeta("box-score", "expert", en)).toBe("Search · 20s · fewer hints");
    expect(difficultyMeta("top-10", "expert", en)).toBe("5 blanks · 60s");
  });
});
