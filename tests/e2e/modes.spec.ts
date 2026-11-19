import { expect, test } from "@playwright/test";
import {
  answerCurrent,
  currentIndex,
  DIFFICULTIES,
  MODES,
  noHorizontalScroll,
  playToResult,
  startGame,
  waitForNextOrResult,
} from "./helpers";

// F1–F6 + F9: every mode × difficulty starts and the first question can be answered via the real UI.
test.describe("all 24 mode × difficulty combinations", () => {
  test.describe.configure({ mode: "parallel" });

  for (const mode of MODES) {
    for (const difficulty of DIFFICULTIES) {
      test(`${mode} / ${difficulty}: first question answered, next one shown`, async ({ page }) => {
        await startGame(page, mode, difficulty);
        await noHorizontalScroll(page);

        const input = await page.locator(".answer-area").getAttribute("data-input");
        const expected =
          mode === "top-10" ? "top10" : difficulty === "easy" || difficulty === "medium" ? "choices" : "search";
        expect(input).toBe(expected);
        if (expected === "choices") {
          await expect(page.locator(".answer-option")).toHaveCount(difficulty === "easy" ? 4 : 6);
        }
        if (mode === "top-10") {
          const hidden = { easy: 2, medium: 3, hard: 4, expert: 5 }[difficulty];
          await expect(page.locator('.top10__row[data-state="hidden"]')).toHaveCount(hidden);
          await expect(page.locator(".top10__row")).toHaveCount(10);
        }

        const idx = await currentIndex(page);
        expect(idx).toBe(1);
        // Alternate click / keyboard to cover both input paths.
        const state = await answerCurrent(page, difficulty === "medium" ? "keys" : "click");
        expect(["correct", "wrong"]).toContain(state);
        expect(await waitForNextOrResult(page, idx)).toBe("next");
        expect(await currentIndex(page)).toBe(2);
      });
    }
  }
});

test.describe("full sessions to ResultSummary", () => {
  test.describe.configure({ mode: "parallel" });

  test("career-stats / easy: 10 questions with keys 1 + Enter", async ({ page }) => {
    test.setTimeout(120_000);
    await startGame(page, "career-stats", "easy");
    await expect(page.locator(".question-progress__count")).toHaveAttribute("aria-label", "Question 1 of 10");
    await playToResult(page, "keys");
    const summary = page.locator('[data-component="ResultSummary"]');
    await expect(summary).toContainText("Session complete");
    await expect(summary).toContainText("/10");
    await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose another game" })).toBeVisible();
    // Guest without nickname gets the nudge; first finished session unlocks "First Game".
    await expect(summary).toContainText("Set a nickname to appear on the leaderboard.");
    await expect(summary.locator('[data-component="AchievementBadge"]', { hasText: "First Game" })).toBeVisible();
  });

  test("top-10 / easy: 3 lists solved correctly → full score", async ({ page }) => {
    test.setTimeout(120_000);
    await startGame(page, "top-10", "easy");
    await expect(page.locator(".question-progress__count")).toHaveAttribute("aria-label", "Question 1 of 3");
    await playToResult(page, "solve");
    const summary = page.locator('[data-component="ResultSummary"]');
    await expect(summary).toContainText("Session complete");
    // 3 lists × 2 hidden rows, all right.
    await expect(summary.locator(".stat-tile", { hasText: "Correct" })).toContainText("6/6");
    const score = Number((await page.getByTestId("result-score").innerText()).replace(/\D/g, ""));
    expect(score).toBeGreaterThan(0);
  });

  test("hard / box-score: search answers until the end", async ({ page }) => {
    test.setTimeout(150_000);
    await startGame(page, "box-score", "hard");
    await playToResult(page, "click");
    await expect(page.locator('[data-component="ResultSummary"]')).toContainText("Session complete");
  });
});
