// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HistoryItemDTO } from "@/lib/api-types";
import { GameHistoryList } from "./game-history-list";

afterEach(cleanup);

const item = (over: Partial<HistoryItemDTO>): HistoryItemDTO => ({
  sessionId: "s",
  mode: "box-score",
  difficulty: "medium",
  era: "current",
  score: 900,
  correct: 7,
  total: 10,
  bestStreak: 4,
  finishedAt: "2026-11-20T09:00:00Z",
  ...over,
});

describe("GameHistoryList", () => {
  it("shows each session's era; Daily reads Mixed", () => {
    render(
      <GameHistoryList
        now={new Date("2026-11-20T12:00:00Z")}
        items={[
          item({ sessionId: "a", mode: "top-10", era: "retired" }),
          item({ sessionId: "b", era: "current" }),
          item({ sessionId: "c", mode: "daily", era: "all" }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    const era = (i: number) =>
      rows[i]?.querySelector("[data-component='EraBadge']")?.getAttribute("data-variant");
    expect(rows[0]).toHaveTextContent("Top 10 Challenge");
    expect(era(0)).toBe("retired");
    expect(era(1)).toBe("current");
    expect(rows[2]).toHaveTextContent("Daily Challenge");
    expect(era(2)).toBe("mixed");
    expect(rows[2]).toHaveTextContent("Mixed");
  });
});
