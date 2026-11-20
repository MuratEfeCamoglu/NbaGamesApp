// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnswerResult, SessionSummary } from "@/games/core/types";
import { feedbackFor } from "./game-play";
import { en } from "@/lib/i18n";
import { ResultSummary } from "./result-summary";
import { player } from "./test-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const SUMMARY: SessionSummary = {
  sessionId: "s1",
  mode: "career-stats",
  difficulty: "hard",
  era: "retired",
  score: 2140,
  correct: 8,
  total: 10,
  bestStreak: 6,
};

describe("ResultSummary", () => {
  it("shows score, correct/total, best streak, accuracy and new badges", () => {
    render(
      <ResultSummary
        summary={SUMMARY}
        newAchievements={[{ id: "streak-5", name: "Streak 5", description: "5 correct in a row" }]}
        showNicknameNudge={false}
        onSetNickname={() => {}}
        actions={<button type="button">Play again</button>}
      />,
    );
    expect(screen.getByTestId("result-score")).toHaveTextContent("2,140");
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("/10")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(
      screen.getByText("Streak 5").closest("[data-component='AchievementBadge']"),
    ).toHaveAttribute("data-state", "unlocking");
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
    expect(screen.queryByText(/Set a nickname/)).not.toBeInTheDocument();
  });

  it("shows the session's era next to 'Session complete' (Daily → Mixed)", () => {
    const { rerender, container } = render(
      <ResultSummary
        summary={SUMMARY}
        newAchievements={[]}
        showNicknameNudge={false}
        onSetNickname={() => {}}
        actions={null}
      />,
    );
    const badge = () => container.querySelector("[data-component='EraBadge']");
    expect(badge()).toHaveAttribute("data-variant", "retired");
    expect(badge()).toHaveTextContent("Retired");
    rerender(
      <ResultSummary
        summary={{ ...SUMMARY, mode: "daily", difficulty: "medium", era: "all" }}
        newAchievements={[]}
        showNicknameNudge={false}
        onSetNickname={() => {}}
        actions={null}
      />,
    );
    expect(badge()).toHaveAttribute("data-variant", "mixed");
    expect(badge()).toHaveTextContent("Mixed");
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("hides the badge block without new badges and offers the nickname nudge", () => {
    const onSet = vi.fn();
    render(
      <ResultSummary
        summary={{ ...SUMMARY, correct: 0, bestStreak: 0 }}
        newAchievements={[]}
        showNicknameNudge
        onSetNickname={onSet}
        actions={null}
      />,
    );
    expect(screen.queryByText("New badges")).not.toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set nickname" }));
    expect(onSet).toHaveBeenCalled();
  });
});

describe("feedbackFor", () => {
  const base: AnswerResult = {
    correct: false,
    correctUnits: 0,
    totalUnits: 1,
    correctAnswer: { kind: "player", player: player("101106", "Andrew Bogut") },
    points: 0,
    streak: 0,
    totalScore: 0,
    next: null,
    summary: null,
    newAchievements: [],
  };
  const answered = (result: AnswerResult, timedOut = false) => ({
    result,
    chosen: null,
    chosenOptionId: null,
    timedOut,
  });

  it("builds design messages for single answers", () => {
    expect(feedbackFor(answered({ ...base, correct: true }), en)).toEqual({
      kind: "correct",
      message: "Correct!",
    });
    expect(feedbackFor(answered(base), en)).toEqual({
      kind: "wrong",
      message: "Not quite — it was Andrew Bogut.",
    });
    expect(feedbackFor(answered(base, true), en)).toEqual({
      kind: "timeout",
      message: "Time's up — it was Andrew Bogut.",
    });
  });

  it("builds messages for Top 10 lists", () => {
    const slots: AnswerResult = {
      ...base,
      correctAnswer: { kind: "slots", rows: [] },
      totalUnits: 4,
    };
    expect(feedbackFor(answered({ ...slots, correctUnits: 4 }), en)).toEqual({
      kind: "correct",
      message: "List complete!",
    });
    expect(feedbackFor(answered({ ...slots, correctUnits: 2 }), en)).toEqual({
      kind: "wrong",
      message: "2 of 4 found.",
    });
    expect(feedbackFor(answered({ ...slots, correctUnits: 1 }, true), en).message).toBe(
      "Time's up — 1 of 4 found.",
    );
  });
});
