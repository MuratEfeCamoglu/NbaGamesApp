import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const MODES = [
  "starting-five",
  "team-journey",
  "teammate-challenge",
  "career-stats",
  "box-score",
  "top-10",
] as const;
export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Mode = (typeof MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Nicknames: 3–20 chars [A-Za-z0-9_], unique per test run. */
export function uniqueNick(prefix = "e2e"): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36).slice(-5)}${rnd}`.slice(0, 20);
}

// ---------- seed lookups (read-only; used only to answer Top 10 rows correctly) ----------
interface SeedBoard {
  title: string;
  rows: { rank: number; playerId: string }[];
}
let cache: { boards: SeedBoard[]; names: Map<string, string> } | null = null;
function seed() {
  if (!cache) {
    const dir = path.resolve("src/data/seed");
    const boards = (
      JSON.parse(readFileSync(path.join(dir, "leaderboards.json"), "utf8")) as {
        items: SeedBoard[];
      }
    ).items;
    const players = (
      JSON.parse(readFileSync(path.join(dir, "players.json"), "utf8")) as {
        items: { id: string; name: string }[];
      }
    ).items;
    cache = { boards, names: new Map(players.map((p) => [p.id, p.name])) };
  }
  return cache;
}
export function top10Answer(title: string, rank: number): string {
  const s = seed();
  const board = s.boards.find((b) => b.title.toLowerCase() === title.toLowerCase());
  const id = board?.rows.find((r) => r.rank === rank)?.playerId;
  const name = id ? s.names.get(id) : undefined;
  if (!name) throw new Error(`No seed answer for "${title}" #${rank}`);
  return name;
}
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------- game flow ----------
export async function startGame(page: Page, mode: Mode, difficulty: Difficulty) {
  await page.goto(`/games/${mode}`);
  await page.locator(`.difficulty-option[data-variant="${difficulty}"]`).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await waitForQuestion(page);
}

/** Countdown (3×700 ms) done and a question is on screen. */
export async function waitForQuestion(page: Page) {
  await expect(page.locator('.game-stage[data-phase="play"]')).toBeVisible({ timeout: 15_000 });
}

export async function currentIndex(page: Page): Promise<number> {
  const label = await page.locator(".question-progress__count").getAttribute("aria-label");
  const m = /Question (\d+) of (\d+)/.exec(label ?? "");
  if (!m) throw new Error(`Bad progress label: ${label}`);
  return Number(m[1]);
}

/** Type in a PlayerSearch (scoped to `root`) and pick the first result (or the one matching `name`). */
export async function searchAndPick(page: Page, rootSelector: string, query: string, name?: string) {
  const root = page.locator(rootSelector);
  const input = root.locator("input.player-search__input");
  await input.fill(query);
  const options = root.locator(".player-search__option");
  const option = name ? options.filter({ hasText: name }).first() : options.first();
  await expect(option).toBeVisible();
  await option.click();
}

/** Fill every hidden Top 10 row with the right player (from the seed); the last pick auto-submits. */
export async function solveTop10(page: Page) {
  // textContent, not innerText: the prompt is uppercased by CSS.
  const title = ((await page.locator(".question-card__prompt").textContent()) ?? "").trim();
  const ranks = await page
    .locator('.top10__row[data-state="hidden"]')
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank"))));
  for (const rank of ranks) {
    const name = top10Answer(title, rank);
    await searchAndPick(page, `.top10__row[data-rank="${rank}"]`, fold(name), name);
  }
}

export type AnswerHow = "click" | "keys" | "solve";

/**
 * Answers the current question through the real UI and waits for the feedback banner.
 * choices: click option 1 or press 1 + Enter · search: type 2+ letters, pick a result ·
 * top10: fill one hidden row then "Give up & reveal" (or solve every row correctly).
 */
export async function answerCurrent(page: Page, how: AnswerHow = "click"): Promise<string> {
  const input = await page.locator(".answer-area").getAttribute("data-input");
  if (input === "choices") {
    if (how === "keys") {
      await page.keyboard.press("1");
      await expect(page.locator('.answer-option[data-state="selected"]')).toBeVisible();
      await page.keyboard.press("Enter");
    } else {
      await page.locator(".answer-option").first().click();
    }
  } else if (input === "search") {
    await searchAndPick(page, '[data-input-view="search"]', "jo");
  } else if (input === "top10") {
    if (how === "solve") {
      await solveTop10(page);
    } else {
      const row = page.locator('.top10__row[data-state="hidden"]').first();
      const rank = await row.getAttribute("data-rank");
      await searchAndPick(page, `.top10__row[data-rank="${rank}"]`, "ja");
      await page.getByRole("button", { name: /Give up/ }).click();
    }
  } else {
    throw new Error(`Unknown input type: ${input}`);
  }
  const banner = page.locator(".feedback-banner");
  await expect(banner).not.toHaveAttribute("data-state", "none");
  return (await banner.getAttribute("data-state")) ?? "";
}

/** After feedback (1.5 s reveal) either the next question or the result screen appears. */
export async function waitForNextOrResult(page: Page, prevIndex: number) {
  const result = page.locator('[data-component="ResultSummary"]');
  await expect
    .poll(
      async () => {
        if (await result.isVisible()) return "result";
        const label = await page
          .locator(".question-progress__count")
          .getAttribute("aria-label", { timeout: 500 })
          .catch(() => null);
        const n = Number(/Question (\d+)/.exec(label ?? "")?.[1] ?? 0);
        return n > prevIndex ? "next" : "waiting";
      },
      { timeout: 10_000 },
    )
    .not.toBe("waiting");
  return (await result.isVisible()) ? "result" : "next";
}

export async function playToResult(page: Page, how: AnswerHow) {
  for (let guard = 0; guard < 12; guard++) {
    const idx = await currentIndex(page);
    await answerCurrent(page, how);
    if ((await waitForNextOrResult(page, idx)) === "result") return;
    // The feedback banner of the next question must have reset.
    await expect(page.locator(".feedback-banner")).toHaveAttribute("data-state", "none");
  }
  throw new Error("Session did not finish");
}

export async function noHorizontalScroll(page: Page) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dims.scrollWidth, JSON.stringify(dims)).toBeLessThanOrEqual(dims.innerWidth);
}
