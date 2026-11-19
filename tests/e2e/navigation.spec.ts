import { expect, test } from "@playwright/test";
import { MODES, noHorizontalScroll, waitForQuestion } from "./helpers";

test("§1: new visitor reaches the first question from Home in 3 clicks", async ({ page }) => {
  await page.goto("/");
  let clicks = 0;
  await page.getByRole("link", { name: "Play your first game" }).click();
  clicks++;
  await expect(page).toHaveURL(/\/games\/starting-five$/);
  await page.locator('.difficulty-option[data-variant="medium"]').click();
  clicks++;
  await page.getByRole("button", { name: "Start", exact: true }).click();
  clicks++;
  await waitForQuestion(page);
  await expect(page.locator(".answer-option")).toHaveCount(6);
  expect(clicks).toBeLessThanOrEqual(3);
});

test("Games page lists 6 mode cards, each opens its mode", async ({ page }) => {
  await page.goto("/games");
  const cards = page.locator('[data-component="GameCard"]');
  await expect(cards).toHaveCount(6);
  for (const mode of MODES) {
    await expect(page.locator(`[data-component="GameCard"][data-mode="${mode}"]`)).toBeVisible();
  }
  await page.locator('[data-component="GameCard"][data-mode="box-score"]').getByRole("link", { name: /^Play / }).click();
  await expect(page).toHaveURL(/\/games\/box-score$/);
  await expect(page.locator('[data-component="DifficultySelector"] input[type="radio"]')).toHaveCount(4);
});

test("404 for an unknown mode slug and an unknown route", async ({ page }) => {
  const res = await page.goto("/games/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Air ball." })).toBeVisible();
  const res2 = await page.goto("/does-not-exist");
  expect(res2?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

const ROUTES = ["/", "/games", ...MODES.map((m) => `/games/${m}`), "/daily", "/leaderboard", "/profile", "/games/nope"];

test("no horizontal scroll on any route", async ({ page }, info) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await noHorizontalScroll(page);
  }
  if (info.project.name === "mobile") {
    expect(page.viewportSize()?.width).toBe(360);
    await expect(page.locator('[data-component="BottomTabBar"]')).toBeVisible();
  } else {
    await expect(page.locator(".top-nav__links")).toBeVisible();
  }
});
