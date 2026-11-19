// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickedPlayer } from "./player-search";
import { TOP10 } from "./test-fixtures";
import { slotsPayload, Top10Table, type Top10Picks } from "./top10-table";

const RAY = { id: "951", name: "Ray Allen", position: "SG", teamId: "BOS", headshotId: null };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ results: [RAY] }), { status: 200 }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({ onPicks }: { onPicks: (p: Top10Picks) => void }) {
  const [picks, setPicks] = useState<Top10Picks>({});
  return (
    <Top10Table
      rows={TOP10.rows}
      picks={picks}
      reveal={null}
      onPick={(rank, p: PickedPlayer | null) => {
        const next = { ...picks };
        if (p) next[rank] = p;
        else delete next[rank];
        setPicks(next);
        onPicks(next);
      }}
    />
  );
}

const row = (rank: number) =>
  document.querySelector(`.top10__row[data-rank="${rank}"]`) as HTMLElement;

describe("Top10Table", () => {
  it("shows visible rows and a search input only in hidden rows", () => {
    render(<Harness onPicks={() => {}} />);
    expect(row(1)).toHaveAttribute("data-state", "shown");
    expect(row(1)).toHaveTextContent("Stephen Curry");
    expect(row(1)).toHaveTextContent("4,058");
    expect(row(3)).toHaveAttribute("data-state", "hidden");
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Rank 5 player" })).toBeInTheDocument();
  });

  it("turns picks for hidden rows into the { slots } payload (rank → playerId)", async () => {
    const onPicks = vi.fn();
    render(<Harness onPicks={onPicks} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Rank 3 player" }), {
      target: { value: "ray" },
    });
    const option = await screen.findByRole("option", { name: /Ray Allen/ });
    fireEvent.mouseDown(option);

    const last = onPicks.mock.calls.at(-1)?.[0] as Top10Picks;
    expect(slotsPayload(last)).toEqual({ "3": "951" });
    expect(within(row(3)).getByText("Ray Allen")).toBeInTheDocument();

    // Clearing the pick removes the slot again.
    fireEvent.click(within(row(3)).getByRole("button", { name: "Clear Ray Allen" }));
    expect(slotsPayload(onPicks.mock.calls.at(-1)?.[0] as Top10Picks)).toEqual({});
  });

  it("reveals filled (correct) and missed rows after submitting", () => {
    render(
      <Top10Table
        rows={TOP10.rows}
        picks={{}}
        onPick={() => {}}
        reveal={{
          kind: "slots",
          rows: [
            { rank: 3, player: { ...RAY, headshotId: null }, correct: true },
            {
              rank: 5,
              player: {
                id: "202691",
                name: "Klay Thompson",
                position: "SG",
                teamId: "DAL",
                headshotId: null,
              },
              correct: false,
            },
          ],
        }}
      />,
    );
    expect(row(3)).toHaveAttribute("data-state", "filled");
    expect(row(3)).toHaveTextContent("Ray Allen");
    expect(row(5)).toHaveAttribute("data-state", "missed");
    expect(row(5)).toHaveTextContent("Klay Thompson");
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });
});
