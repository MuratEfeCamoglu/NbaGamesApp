// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "@/games/core/types";
import { ERA_STORAGE_KEY, resetEraMemory } from "@/lib/use-era-preference";
import { GamesView } from "./games-view";

const playHrefs = () =>
  screen.getAllByRole("link", { name: /^Play / }).map((a) => a.getAttribute("href"));

beforeEach(() => {
  window.localStorage.clear();
  resetEraMemory();
});
afterEach(cleanup);

describe("GamesView", () => {
  it("opens every mode in the era picked at the top", () => {
    render(<GamesView description="Six ways to test your NBA knowledge." />);
    expect(screen.getByRole("heading", { level: 1, name: "Games" })).toHaveAttribute(
      "id",
      "games-title",
    );
    expect(playHrefs()).toEqual(GAME_MODES.map((m) => `/games/${m}`));

    fireEvent.click(screen.getByRole("radio", { name: "Retired" }));
    expect(playHrefs()).toEqual(GAME_MODES.map((m) => `/games/${m}?era=retired`));
    expect(window.localStorage.getItem(ERA_STORAGE_KEY)).toBe("retired");
    expect(document.querySelector(".era-scope")).toHaveAttribute("data-era", "retired");
  });

  it("starts on the era remembered by this browser", () => {
    window.localStorage.setItem(ERA_STORAGE_KEY, "retired");
    render(<GamesView description="d" />);
    expect(screen.getByRole("radio", { name: "Retired" })).toBeChecked();
    expect(playHrefs().every((h) => h?.endsWith("?era=retired"))).toBe(true);
  });
});
