// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LeaderboardDTO } from "@/lib/api-types";
import { LeaderboardTable } from "./leaderboard-table";

afterEach(cleanup);

const rows = (meRank: number | null): LeaderboardDTO["rows"] =>
  [1, 2, 3].map((rank) => ({
    rank,
    nickname: `player${rank}`,
    points: 1000 - rank * 100,
    isMe: rank === meRank,
  }));

const sticky = (c: HTMLElement) => c.querySelector(".leaderboard__you");
const youRows = (c: HTMLElement) =>
  c.querySelectorAll('[data-component="LeaderboardRow"][data-variant="you"]');

describe("LeaderboardTable sticky You row", () => {
  it("is hidden when you are already in the listed rows", () => {
    const { container } = render(
      <LeaderboardTable
        variant="full"
        rows={rows(2)}
        me={{ rank: 2, points: 800, name: "player2" }}
      />,
    );
    expect(sticky(container)).toBeNull();
    expect(youRows(container)).toHaveLength(1);
  });

  it("is shown when you rank outside the listed rows", () => {
    const { container } = render(
      <LeaderboardTable
        variant="daily"
        rows={rows(null)}
        me={{ rank: 12, points: 120, name: "me_myself" }}
      />,
    );
    expect(sticky(container)).toHaveTextContent("12");
    expect(sticky(container)).toHaveTextContent("me_myself");
    expect(youRows(container)).toHaveLength(1);
  });

  it("is shown without a rank (no nickname yet) and never without `me`", () => {
    const { container, rerender } = render(
      <LeaderboardTable
        variant="full"
        rows={rows(null)}
        me={{ rank: null, points: 0, name: "Guest 4F2A · no nickname" }}
      />,
    );
    expect(sticky(container)).toHaveTextContent("—");
    rerender(<LeaderboardTable variant="full" rows={rows(null)} />);
    expect(sticky(container)).toBeNull();
  });
});
