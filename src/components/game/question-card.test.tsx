// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { QuestionContent } from "@/games/core/types";
import { PROMPTS, QuestionCard } from "./question-card";
import {
  BOX_SCORE,
  CAREER,
  STARTING_FIVE,
  TEAM_JOURNEY,
  TEAMMATES,
  TOP10,
  player,
} from "./test-fixtures";

afterEach(cleanup);

const card = () => document.querySelector("[data-component='QuestionCard']") as HTMLElement;

describe("QuestionCard", () => {
  it("renders Starting Five: team, season, 4 starters and the mystery slot", () => {
    render(<QuestionCard content={STARTING_FIVE} reveal={null} />);
    expect(card()).toHaveAttribute("data-mode", "starting-five");
    expect(screen.getByText(PROMPTS["starting-five"])).toBeInTheDocument();
    expect(screen.getByText("Golden State Warriors · 2015-16")).toBeInTheDocument();
    expect(screen.getByText("GSW")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Stephen Curry|Klay Thompson|Harrison Barnes|Draymond Green/),
    ).toHaveLength(4);
    expect(screen.getByText("Missing starter")).toBeInTheDocument();
  });

  it("reveals the missing starter after answering", () => {
    render(
      <QuestionCard
        content={STARTING_FIVE}
        reveal={{
          correct: false,
          answer: { kind: "player", player: player("101106", "Andrew Bogut") },
        }}
      />,
    );
    expect(screen.getByText("Andrew Bogut")).toBeInTheDocument();
    expect(document.querySelector("[data-variant='mystery']")).toHaveAttribute(
      "data-state",
      "wrong",
    );
  });

  it("renders Team Journey stints with years and badges", () => {
    render(<QuestionCard content={TEAM_JOURNEY} reveal={null} />);
    expect(screen.getByText("2003–11")).toBeInTheDocument();
    expect(screen.getByText("19 seasons")).toBeInTheDocument();
    expect(screen.getByText("10× All-Star")).toBeInTheDocument();
    expect(document.querySelectorAll(".career-timeline__stop")).toHaveLength(3);
  });

  it("renders Teammate Challenge cards with team and season", () => {
    render(<QuestionCard content={TEAMMATES} reveal={null} />);
    expect(screen.getByText("Dwyane Wade")).toBeInTheDocument();
    expect(screen.getByText("2015-16")).toBeInTheDocument();
    expect(screen.getByText("CLE")).toBeInTheDocument();
  });

  it("renders Career Stats with one decimal and grouped games", () => {
    render(<QuestionCard content={CAREER} reveal={null} />);
    expect(screen.getByText("19.0")).toBeInTheDocument();
    expect(screen.getByText("50.6")).toBeInTheDocument();
    expect(screen.getByText("1,392")).toBeInTheDocument();
    expect(screen.getByText("Seasons")).toBeInTheDocument();
    expect(screen.getByText("F-C")).toBeInTheDocument();
  });

  it("renders Box Score: matchup, date, stat line and ??? before the answer", () => {
    render(<QuestionCard content={BOX_SCORE} reveal={null} />);
    expect(screen.getByText("Jan 22, 2006")).toBeInTheDocument();
    expect(screen.getByText("122")).toBeInTheDocument();
    expect(screen.getByText("81")).toBeInTheDocument();
    expect(screen.getByText("28-46")).toBeInTheDocument();
    expect(screen.getByText("???")).toBeInTheDocument();
  });

  it("renders Top 10: list badge, title and hidden rows", () => {
    render(<QuestionCard content={TOP10} reveal={null} />);
    expect(screen.getByText("Career 3-Pointers Made")).toBeInTheDocument();
    expect(screen.getByText("List 1/3")).toBeInTheDocument();
    expect(document.querySelectorAll(".top10__row[data-state='hidden']")).toHaveLength(2);
  });

  describe("omits fields the server nulled (Expert)", () => {
    it("Starting Five without season", () => {
      render(<QuestionCard content={{ ...STARTING_FIVE, season: null }} reveal={null} />);
      expect(screen.getByText("Golden State Warriors")).toBeInTheDocument();
      expect(screen.queryByText(/2015-16/)).not.toBeInTheDocument();
    });

    it("Team Journey without years, seasons or All-Star count", () => {
      const content: QuestionContent = {
        ...TEAM_JOURNEY,
        stints: TEAM_JOURNEY.stints.map((s) => ({ ...s, years: null })),
        seasons: null,
        allStarCount: null,
      };
      render(<QuestionCard content={content} reveal={null} />);
      expect(screen.queryByText("2003–11")).not.toBeInTheDocument();
      expect(screen.queryByText(/seasons/)).not.toBeInTheDocument();
      expect(screen.queryByText(/All-Star/)).not.toBeInTheDocument();
      expect(document.querySelector(".career-timeline__years")).toBeNull();
    });

    it("Teammates without season", () => {
      render(
        <QuestionCard
          content={{
            ...TEAMMATES,
            teammates: TEAMMATES.teammates.map((t) => ({ ...t, season: null })),
          }}
          reveal={null}
        />,
      );
      expect(screen.queryByText("2015-16")).not.toBeInTheDocument();
      expect(screen.getByText("Kyrie Irving")).toBeInTheDocument();
    });

    it("Career Stats without seasons and position", () => {
      render(
        <QuestionCard
          content={{ ...CAREER, stats: { ...CAREER.stats, seasons: null, position: null } }}
          reveal={null}
        />,
      );
      expect(screen.queryByText("Seasons")).not.toBeInTheDocument();
      expect(screen.queryByText("Position")).not.toBeInTheDocument();
      expect(screen.getByText("PPG")).toBeInTheDocument();
    });

    it("Box Score without date, teams and score", () => {
      render(<QuestionCard content={{ ...BOX_SCORE, game: null }} reveal={null} />);
      expect(screen.queryByText("Jan 22, 2006")).not.toBeInTheDocument();
      expect(screen.queryByText("LAL")).not.toBeInTheDocument();
      expect(screen.queryByText("122")).not.toBeInTheDocument();
      expect(document.querySelector(".box-score__matchup")).toBeNull();
      expect(screen.getByText("81")).toBeInTheDocument();
    });
  });
});
