// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerSearch, SEARCH_DEBOUNCE_MS, type PickedPlayer } from "./player-search";

const RESULTS = [
  { id: "951", name: "Ray Allen", position: "SG", teamId: "BOS", headshotId: "951" },
  { id: "1495", name: "Rajon Rondo", position: "PG", teamId: "BOS", headshotId: "200765" },
  { id: "2548", name: "Dwyane Wade", position: "SG", teamId: "MIA", headshotId: "2548" },
];

let fetchMock: ReturnType<typeof vi.fn>;

function respond(results: typeof RESULTS) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ results }), { status: 200 })),
  );
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function Harness({ onPick }: { onPick: (p: PickedPlayer | null) => void }) {
  const [value, setValue] = useState<PickedPlayer | null>(null);
  return (
    <PlayerSearch
      value={value}
      onChange={(p) => {
        setValue(p);
        onPick(p);
      }}
    />
  );
}

const input = () => screen.getByRole("combobox", { name: "Search players" });
const root = () => input().closest("[data-component='PlayerSearch']");

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PlayerSearch", () => {
  it("needs 2 characters and debounces the request", async () => {
    respond(RESULTS);
    render(<Harness onPick={() => {}} />);
    expect(root()).toHaveAttribute("data-state", "empty");

    fireEvent.change(input(), { target: { value: "r" } });
    expect(root()).toHaveAttribute("data-state", "typing");
    await flush(SEARCH_DEBOUNCE_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input(), { target: { value: "ra" } });
    fireEvent.change(input(), { target: { value: "ray" } });
    expect(root()).toHaveAttribute("data-state", "loading");
    await flush(SEARCH_DEBOUNCE_MS - 50);
    expect(fetchMock).not.toHaveBeenCalled();
    await flush(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/players/search?q=ray");
    await flush();
    expect(root()).toHaveAttribute("data-state", "results");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("moves with arrow keys and picks with Enter", async () => {
    respond(RESULTS);
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.change(input(), { target: { value: "ra" } });
    await flush(SEARCH_DEBOUNCE_MS);
    await flush();

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input()).toHaveAttribute("aria-activedescendant", options[1]?.id);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2548", name: "Dwyane Wade" }),
    );
    expect(root()).toHaveAttribute("data-state", "selected");
    expect(root()).toHaveTextContent("Dwyane Wade");
  });

  it("shows 'No players found' for an empty result and the error message on failure", async () => {
    respond([]);
    render(<Harness onPick={() => {}} />);
    fireEvent.change(input(), { target: { value: "zzz" } });
    await flush(SEARCH_DEBOUNCE_MS);
    await flush();
    expect(root()).toHaveAttribute("data-state", "no-results");
    expect(screen.getByText("No players found")).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");

    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
    fireEvent.change(input(), { target: { value: "kawhi" } });
    await flush(SEARCH_DEBOUNCE_MS);
    await flush();
    expect(root()).toHaveAttribute("data-state", "error");
  });

  it("marks the chip correct/wrong after answering", () => {
    render(
      <PlayerSearch
        value={{ id: "951", name: "Ray Allen", teamId: "BOS", headshotId: null }}
        onChange={() => {}}
        result="wrong"
        disabled
      />,
    );
    const el = document.querySelector("[data-component='PlayerSearch']");
    expect(el).toHaveAttribute("data-state", "selected");
    expect(el).toHaveAttribute("data-result", "wrong");
  });
});
