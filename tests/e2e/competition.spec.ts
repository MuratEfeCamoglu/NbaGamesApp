import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  answerCurrent,
  currentIndex,
  playToResult,
  solveTop10,
  startGame,
  uniqueNick,
  waitForNextOrResult,
  waitForQuestion,
} from "./helpers";

async function freshPage(browser: Browser, project: Page) {
  // Same device settings as the project, but an isolated context = fresh guest cookie.
  const vp = project.viewportSize();
  const ctx = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport: vp ?? undefined,
  });
  return { ctx, page: await ctx.newPage() };
}

async function setNicknameViaProfile(page: Page, nick: string) {
  await page.goto("/profile");
  await page.getByRole("button", { name: /^(Set|Edit) nickname$/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nickname").fill(nick);
  await dialog.getByRole("button", { name: "Save nickname" }).click();
  return dialog;
}

interface DailyQ {
  mode: string;
  labels: string[];
  correct: string;
}

/** Plays today's Daily; with `answers`, picks the known right option for each question. */
async function playDaily(page: Page, answers?: DailyQ[]): Promise<DailyQ[]> {
  await page.goto("/daily");
  await page.getByRole("button", { name: "Start daily challenge" }).click();
  await waitForQuestion(page);
  const seen: DailyQ[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = await currentIndex(page);
    expect(idx).toBe(i + 1);
    await expect(page.locator(".question-progress__count")).toHaveAttribute("aria-label", `Question ${i + 1} of 5`);
    // Daily = Medium rules → 6 options.
    const options = page.locator(".answer-option");
    await expect(options).toHaveCount(6);
    const labels = (await options.locator(".answer-option__label").allInnerTexts()).map((s) => s.trim());
    const mode = (await page.locator("#daily-title").innerText()).trim();
    const known = answers?.[i];
    if (known) {
      expect(mode).toBe(known.mode);
      expect([...labels].sort()).toEqual([...known.labels].sort());
      await options.filter({ has: page.locator(".answer-option__label", { hasText: known.correct }) }).first().click();
      await expect(page.locator(".feedback-banner")).toHaveAttribute("data-state", "correct");
    } else {
      await answerCurrent(page, "click");
    }
    const correct = (await page.locator('.answer-option[data-state="correct"] .answer-option__label').innerText()).trim();
    seen.push({ mode, labels, correct });
    expect(await waitForNextOrResult(page, idx)).toBe(i === 4 ? "result" : "next");
  }
  await expect(page.locator('[data-component="ResultSummary"]')).toContainText("Session complete");
  return seen;
}

test("Daily: same 5 questions for two users, one attempt per day, Today leaderboard", async ({ page, browser }) => {
  test.setTimeout(150_000);
  // User A plays first; the reveal tells us the right answers.
  const first = await playDaily(page);

  // User B (fresh cookie) gets the identical questions (F7 / §1) and answers them all right.
  const { ctx, page: b } = await freshPage(browser, page);
  try {
    await playDaily(b, first);
    await expect(b.locator('[data-component="ResultSummary"] .stat-tile', { hasText: "Correct" })).toContainText("5/5");

    // Second attempt → "Already played today" (409 path in UI).
    await b.goto("/daily");
    await expect(b.getByText("Already played today")).toBeVisible();
    await expect(b.getByRole("button", { name: "Start daily challenge" })).toHaveCount(0);
    const status = await b.request.post("/api/daily/sessions");
    expect(status.status()).toBe(409);

    // After setting a nickname the result is on the Today leaderboard with the "You" highlight.
    const nick = uniqueNick("day");
    await setNicknameViaProfile(b, nick);
    await expect(b.getByRole("status").filter({ hasText: "Nickname saved" })).toBeVisible();
    await b.goto("/leaderboard");
    await b.getByRole("tab", { name: "Today" }).click();
    const you = b.locator('.leaderboard__body [data-component="LeaderboardRow"][data-variant="you"]');
    await expect(you).toContainText(nick);
    await expect(you).toContainText("You");
  } finally {
    await ctx.close();
  }
});

test("Nickname: invalid → message, valid → toast + leaderboard 'You', duplicate → already taken", async ({ page, browser }) => {
  test.setTimeout(120_000);
  // Earn some points first (only users with points > 0 are listed): solve one Top 10 list.
  await startGame(page, "top-10", "easy");
  await solveTop10(page);
  await expect(page.locator(".feedback-banner")).toHaveAttribute("data-state", "correct");

  await page.goto("/profile");
  await page.getByRole("button", { name: "Set nickname" }).click();
  const dialog = page.getByRole("dialog");
  const field = dialog.getByLabel("Nickname");
  const msg = dialog.locator("#nickname-msg");

  await field.fill("ab");
  await expect(msg).toContainText("Too short");
  await field.fill("bad name!");
  await expect(msg).toContainText("Only letters, numbers and underscores.");
  await dialog.getByRole("button", { name: "Save nickname" }).click();
  await expect(dialog).toBeVisible(); // nothing submitted
  // Passes the client rule, rejected by the server blocklist.
  await field.fill("admin");
  await dialog.getByRole("button", { name: "Save nickname" }).click();
  await expect(msg).toContainText("not allowed");

  const nick = uniqueNick("Nick");
  await field.fill(nick);
  await dialog.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Nickname saved" })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#profile-title")).toHaveText(nick);

  await page.goto("/leaderboard");
  await expect(page.getByRole("tab", { name: "All time" })).toHaveAttribute("aria-selected", "true");
  const you = page.locator('.leaderboard__body [data-component="LeaderboardRow"][data-variant="you"]');
  await expect(you).toContainText(nick);

  // Another guest tries the same name in different case → 409 "already taken".
  const { ctx, page: other } = await freshPage(browser, page);
  try {
    const d2 = await setNicknameViaProfile(other, nick.toUpperCase());
    await expect(d2.locator("#nickname-msg")).toContainText("already taken");
    const api = await other.request.patch("/api/me", { data: { nickname: nick.toLowerCase() } });
    expect(api.status()).toBe(409);
    expect((await api.json()).error.code).toBe("CONFLICT");
  } finally {
    await ctx.close();
  }
});

test("Profile: points, games played, First Game badge, history; Home → GameCard → first question in 3 clicks", async ({ page }) => {
  test.setTimeout(120_000);
  // Empty profile first.
  await page.goto("/profile");
  await expect(page.getByText("No games played yet")).toBeVisible();
  await expect(page.getByText("Your progress is saved in this browser.")).toBeVisible();

  await startGame(page, "top-10", "easy");
  await playToResult(page, "solve");
  const score = (await page.getByTestId("result-score").innerText()).trim();

  await page.goto("/profile");
  const tile = (label: string) => page.locator('[data-component="StatTile"]', { hasText: label });
  await expect(tile("Total points")).toContainText(score);
  await expect(tile("Games played")).toContainText("1");
  await expect(tile("Accuracy")).toContainText("100%");
  await expect(page.locator('[data-component="AchievementBadge"][data-state="earned"]', { hasText: "First Game" })).toBeVisible();
  // A flawless Top 10 run (6/6 rows, 6 in a row) also unlocks Perfect 10 and Streak 5.
  for (const name of ["Perfect 10", "Streak 5"]) {
    await expect(page.locator('[data-component="AchievementBadge"][data-state="earned"]', { hasText: name })).toBeVisible();
  }
  await expect(page.locator('[data-component="AchievementBadge"]')).toHaveCount(8);
  await expect(page.locator('[data-component="AchievementBadge"][data-state="locked"]')).toHaveCount(5);
  const history = page.locator('[data-component="GameHistoryList"] .history__item');
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText("Top 10");
  await expect(history.first()).toContainText(score);

  // §1: returning user, Home → GameCard → difficulty & start ≤ 3 clicks.
  await page.goto("/");
  let clicks = 0;
  await page.locator('[data-component="GameCard"]').first().getByRole("link", { name: /^Play / }).click();
  clicks++;
  await page.locator('.difficulty-option[data-variant="medium"]').click();
  clicks++;
  await page.getByRole("button", { name: "Start", exact: true }).click();
  clicks++;
  await waitForQuestion(page);
  expect(clicks).toBeLessThanOrEqual(3);
});
