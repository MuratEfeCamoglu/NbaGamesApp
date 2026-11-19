import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { waitForQuestion } from "./helpers";

// ISKELET §5 measurements without Lighthouse: Web Vitals via PerformanceObserver, first-load JS
// via the scripts each route's HTML actually loads (gzip), keyboard-only play and visible focus.

const FIRST_LOAD_BUDGET_KB = 200;
const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

for (const route of ["/", "/games"]) {
  test(`Web Vitals (LCP, CLS) on ${route}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Measured at the mobile viewport (360 px).");
    await page.goto(route, { waitUntil: "networkidle" });
    // Give layout-shifting client data (useApi) time to land.
    await page.waitForTimeout(2000);
    const vitals = await page.evaluate(
      () =>
        new Promise<{ lcp: number; cls: number; fcp: number }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
              if (!e.hadRecentInput) cls += e.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          setTimeout(() => resolve({ lcp, cls, fcp }), 300);
        }),
    );
    const line = `${route} LCP=${Math.round(vitals.lcp)}ms FCP=${Math.round(vitals.fcp)}ms CLS=${vitals.cls.toFixed(4)}`;
    console.log(`[vitals] ${line}`);
    info.annotations.push({ type: "vitals", description: line });
    expect(vitals.lcp).toBeGreaterThan(0);
    expect(vitals.lcp).toBeLessThan(LCP_BUDGET_MS);
    expect(vitals.cls).toBeLessThan(CLS_BUDGET);
  });
}

test("first-load JS per route (gzip) < 200 KB", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "Size is viewport-independent; measured once.");
  const routes = ["/", "/games", "/games/starting-five", "/daily", "/leaderboard", "/profile"];
  const gz = new Map<string, number>();
  const lines: string[] = [];
  for (const route of routes) {
    const html = await (await request.get(route)).text();
    const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]!))];
    let total = 0;
    for (const src of srcs) {
      if (!gz.has(src)) {
        const body = await (await request.get(src)).body();
        gz.set(src, gzipSync(body).length);
      }
      total += gz.get(src)!;
    }
    const kb = total / 1024;
    lines.push(`${route}: ${kb.toFixed(1)} KB gzip (${srcs.length} scripts)`);
    expect(kb, route).toBeLessThan(FIRST_LOAD_BUDGET_KB);
  }
  console.log(`[first-load-js]\n${lines.join("\n")}`);
  info.annotations.push({ type: "first-load-js", description: lines.join(" | ") });
});

test("keyboard only: start a game and answer with 1 + Enter; focus ring visible", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Keyboard flow is checked on desktop.");
  await page.goto("/games/career-stats");
  // Tab until the Start button has focus; every focused element must show a visible ring.
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40),
        tag: el.tagName,
        outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2,
        shadow: cs.boxShadow !== "none",
        focusVisible: el.matches(":focus-visible"),
      };
    });
    if (!f) continue;
    // Radios are visually hidden; their label shows the ring, so judge the label instead.
    if (f.tag === "INPUT") {
      const labelRing = await page.evaluate(() => {
        const lbl = (document.activeElement as HTMLElement).closest("label");
        if (!lbl) return false;
        const cs = getComputedStyle(lbl);
        return (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== "none";
      });
      expect(labelRing, `focus ring on difficulty option`).toBe(true);
    } else {
      expect(f.focusVisible, f.text).toBe(true);
      expect(f.outline || f.shadow, `visible focus ring on "${f.text}"`).toBe(true);
    }
    if (f.tag === "BUTTON" && f.text.toLowerCase() === "start") reached = true;
  }
  expect(reached).toBe(true);
  await page.keyboard.press("Enter");
  await waitForQuestion(page);
  await page.keyboard.press("2");
  await expect(page.locator(".answer-option").nth(1)).toHaveAttribute("data-state", "selected");
  await expect(page.locator(".answer-option").nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".feedback-banner")).not.toHaveAttribute("data-state", "none");
});
