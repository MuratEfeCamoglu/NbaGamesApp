import { expect, test } from "@playwright/test";
import { startGame, waitForNextOrResult } from "./helpers";

// §2.1 "Süre dolması": unanswered question → warning in the last 5 s → "Time's up" (counted wrong).
test("unanswered question times out (hard, 20 s)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Timing test runs once (desktop).");
  test.setTimeout(90_000);
  await startGame(page, "starting-five", "hard");

  const timer = page.locator('[data-component="TimerBar"]');
  await expect(timer).toHaveAttribute("data-state", "normal");
  await expect(timer).toHaveAttribute("data-state", "warning", { timeout: 20_000 });

  const banner = page.locator(".feedback-banner");
  await expect(banner).toHaveAttribute("data-state", "timeout", { timeout: 15_000 });
  await expect(banner).toContainText("Time's up — it was");
  await expect(page.locator('.question-progress__seg[data-state="wrong"]')).toHaveCount(1);
  expect(await waitForNextOrResult(page, 1)).toBe("next");
});
