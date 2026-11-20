// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/lib/i18n";
import { MODES } from "@/lib/modes";
import { GameCard } from "./game-card";

afterEach(cleanup);

const playLink = () => screen.getByRole("link", { name: /^Play / });

describe("GameCard era (F16)", () => {
  it("defaults to Current: bare /games/<mode> link (old links and e2e URLs stay valid)", () => {
    render(<GameCard mode={MODES["box-score"]} />);
    expect(playLink()).toHaveAttribute("href", "/games/box-score");
    expect(playLink()).toHaveAccessibleName("Play Box Score");
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("data-era", "current");
    expect(card).toHaveTextContent(en.modes["box-score"].eraDesc.current);
  });

  it("Retired: the Play link carries ?era=retired, with the retired tag and flavour line", () => {
    render(<GameCard mode={MODES["starting-five"]} era="retired" variant="featured" />);
    expect(playLink()).toHaveAttribute("href", "/games/starting-five?era=retired");
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("data-era", "retired");
    expect(card.querySelector(".game-card__era-tag")).toHaveTextContent("Retired");
    expect(card).toHaveTextContent("Classic lineups from earlier seasons.");
  });
});
