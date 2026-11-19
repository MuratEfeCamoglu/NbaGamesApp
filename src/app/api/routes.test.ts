import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnswerResponse,
  ApiErrorDTO,
  MeDTO,
  PlayerSearchDTO,
  StartSessionResponse,
} from "@/lib/api-types";
import { SESSION_COOKIE, signUserId } from "@/server/auth/session";
import { setServiceContextOverride } from "@/server/context";
import { RATE_LIMITS, resetRateLimits } from "@/server/rate-limit";
import {
  answerKeyOf,
  correctAnswerFor,
  createTestEnv,
  TEST_SECRET,
  type TestEnv,
} from "@/server/test-helpers";
import { POST as dailyStart } from "./daily/sessions/route";
import { POST as answerRoute } from "./games/sessions/[id]/answer/route";
import { POST as startRoute } from "./games/sessions/route";
import { GET as dailyStatusRoute } from "./daily/route";
import { GET as leaderboardRoute } from "./leaderboard/route";
import { GET as historyRoute } from "./me/history/route";
import { GET as meGet, PATCH as mePatch } from "./me/route";
import { GET as searchRoute } from "./players/search/route";

// Route handlers read/write the guest cookie through next/headers; emulate one browser's jar.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
  }),
}));

let env: TestEnv;
const originalSecret = process.env.SESSION_SECRET;
beforeAll(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});
afterAll(() => {
  process.env.SESSION_SECRET = originalSecret;
});
beforeEach(async () => {
  env = await createTestEnv();
  setServiceContextOverride(env.ctx);
  resetRateLimits();
  jar.clear();
});
afterEach(async () => {
  setServiceContextOverride(undefined);
  await env.cleanup();
});

const url = (path: string) => `http://localhost${path}`;
const post = (path: string, body: unknown) =>
  new Request(url(path), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const get = (path: string) => new Request(url(path));

async function read<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("API route handlers", () => {
  it("GET /api/me creates a signed guest cookie and reuses it", async () => {
    const res = await meGet(get("/api/me"));
    expect(res.status).toBe(200);
    const me = await read<MeDTO>(res);
    expect(jar.get(SESSION_COOKIE)).toBe(signUserId(me.id));
    const again = await read<MeDTO>(await meGet(get("/api/me")));
    expect(again.id).toBe(me.id);
    expect(await env.ctx.db.user.count()).toBe(1);

    // A tampered cookie is ignored and a new guest is issued.
    jar.set(SESSION_COOKIE, `${me.id}.forged`);
    const other = await read<MeDTO>(await meGet(get("/api/me")));
    expect(other.id).not.toBe(me.id);
  });

  it("PATCH /api/me validates and enforces unique nicknames", async () => {
    const ok = await mePatch(
      new Request(url("/api/me"), {
        method: "PATCH",
        body: JSON.stringify({ nickname: "Dame_Time" }),
      }),
    );
    expect(ok.status).toBe(200);
    expect((await read<MeDTO>(ok)).nickname).toBe("Dame_Time");

    const bad = await mePatch(
      new Request(url("/api/me"), { method: "PATCH", body: JSON.stringify({ nickname: "no" }) }),
    );
    expect(bad.status).toBe(400);
    expect((await read<ApiErrorDTO>(bad)).error.code).toBe("VALIDATION");

    const notJson = await mePatch(new Request(url("/api/me"), { method: "PATCH", body: "{" }));
    expect(notJson.status).toBe(400);

    jar.clear(); // a second browser
    const taken = await mePatch(
      new Request(url("/api/me"), {
        method: "PATCH",
        body: JSON.stringify({ nickname: "dame_time" }),
      }),
    );
    expect(taken.status).toBe(409);
    expect((await read<ApiErrorDTO>(taken)).error.code).toBe("CONFLICT");
  });

  it("starts a session and answers through the API without leaking the key", async () => {
    const bad = await startRoute(post("/api/games/sessions", { mode: "nope", difficulty: "easy" }));
    expect(bad.status).toBe(400);

    const res = await startRoute(
      post("/api/games/sessions", { mode: "starting-five", difficulty: "hard" }),
    );
    expect(res.status).toBe(201);
    const start = await read<StartSessionResponse>(res);
    const key = await answerKeyOf(env.ctx, start.sessionId, 0);
    if (key.kind !== "player") throw new Error("expected player key");
    expect(JSON.stringify(start)).not.toContain(`"${key.playerId}"`);
    expect(JSON.stringify(start)).not.toContain("answerKey");

    const params = { params: Promise.resolve({ id: start.sessionId }) };
    const invalid = await answerRoute(
      post("/x", { questionIndex: 0, answer: { nope: 1 } }),
      params,
    );
    expect(invalid.status).toBe(400);

    const answered = await answerRoute(
      post("/x", { questionIndex: 0, answer: correctAnswerFor(key) }),
      params,
    );
    expect(answered.status).toBe(200);
    const body = await read<AnswerResponse>(answered);
    expect(body.correct).toBe(true);
    expect(body.points).toBeGreaterThan(0);
    expect(body.next?.index).toBe(1);

    const again = await answerRoute(
      post("/x", { questionIndex: 0, answer: { timeout: true } }),
      params,
    );
    expect(again.status).toBe(409);

    env.clock.advanceSec(31 * 60);
    const expired = await answerRoute(
      post("/x", { questionIndex: 1, answer: { timeout: true } }),
      params,
    );
    expect(expired.status).toBe(410);
    expect((await read<ApiErrorDTO>(expired)).error.code).toBe("EXPIRED");

    const missing = await answerRoute(post("/x", { questionIndex: 0, answer: { timeout: true } }), {
      params: Promise.resolve({ id: "doesnotexist" }),
    });
    expect(missing.status).toBe(404);
  });

  it("POST /api/daily/sessions returns 409 after today's daily is finished", async () => {
    const start = await read<StartSessionResponse>(
      await dailyStart(post("/api/daily/sessions", {})),
    );
    const params = { params: Promise.resolve({ id: start.sessionId }) };
    for (let i = 0; i < start.total; i++) {
      await answerRoute(post("/x", { questionIndex: i, answer: { timeout: true } }), params);
    }
    const second = await dailyStart(post("/api/daily/sessions", {}));
    expect(second.status).toBe(409);
  });

  it("GET /api/players/search validates q, returns ≤10 results and rate-limits", async () => {
    const short = await searchRoute(new Request(url("/api/players/search?q=a")));
    expect(short.status).toBe(400);
    const res = await searchRoute(new Request(url("/api/players/search?q=an")));
    expect(res.status).toBe(200);
    const body = await read<PlayerSearchDTO>(res);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(10);
    expect(Object.keys(body.results[0] ?? {}).sort()).toEqual([
      "headshotId",
      "id",
      "name",
      "position",
      "teamId",
    ]);

    // 2 requests used above (the 400 is rejected before the limiter); 20 per 10 s allowed.
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      statuses.push((await searchRoute(new Request(url("/api/players/search?q=le")))).status);
    }
    expect(statuses.slice(0, 19).every((s) => s === 200)).toBe(true);
    expect(statuses[19]).toBe(429);
  });

  it("limits guest creation per client before any DB write (cookieless flood)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= RATE_LIMITS.guest.capacity; i++) {
      jar.clear(); // a client that never keeps the cookie
      statuses.push((await meGet(get("/api/me"))).status);
    }
    expect(statuses.slice(0, -1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    expect(await env.ctx.db.user.count()).toBe(RATE_LIMITS.guest.capacity);

    // Other guest-creating endpoints share the limit: no user, session or question rows.
    jar.clear();
    const start = await startRoute(
      post("/api/games/sessions", { mode: "career-stats", difficulty: "easy" }),
    );
    expect(start.status).toBe(429);
    jar.clear();
    expect((await dailyStart(post("/api/daily/sessions", {}))).status).toBe(429);
    jar.clear();
    expect((await historyRoute(get("/api/me/history"))).status).toBe(429);
    expect(await env.ctx.db.user.count()).toBe(RATE_LIMITS.guest.capacity);
    expect(await env.ctx.db.gameSession.count()).toBe(0);
    expect(await env.ctx.db.question.count()).toBe(0);
  });

  it("ignores a spoofed X-Forwarded-For unless TRUST_PROXY=true", async () => {
    const original = process.env.TRUST_PROXY;
    try {
      delete process.env.TRUST_PROXY;
      const spoofed = (n: number) =>
        new Request(url("/api/me"), { headers: { "x-forwarded-for": `10.0.0.${n}` } });
      const statuses: number[] = [];
      for (let i = 0; i <= RATE_LIMITS.guest.capacity; i++) {
        jar.clear();
        statuses.push((await meGet(spoofed(i))).status);
      }
      expect(statuses.at(-1)).toBe(429);

      // Behind a trusted proxy each client address gets its own budget.
      process.env.TRUST_PROXY = "true";
      resetRateLimits();
      jar.clear();
      expect((await meGet(spoofed(1))).status).toBe(200);
    } finally {
      process.env.TRUST_PROXY = original;
    }
  });

  it("rate-limits reads of /api/me, /api/me/history, /api/leaderboard and /api/daily", async () => {
    expect((await meGet(get("/api/me"))).status).toBe(200); // creates the guest cookie
    const reads = [
      () => meGet(get("/api/me")),
      () => historyRoute(get("/api/me/history")),
      () => leaderboardRoute(get("/api/leaderboard")),
      () => dailyStatusRoute(get("/api/daily")),
    ];
    const statuses: number[] = [];
    // The bucket refills continuously (capacity per window), so on a slow/loaded machine a
    // few tokens may come back mid-loop. Assert the shape instead of an exact index:
    // the first capacity-1 reads pass, and a 429 arrives shortly after.
    const maxTries = RATE_LIMITS.read.capacity + 20;
    for (let i = 0; i < maxTries; i++) {
      const status = (await (reads[i % reads.length] as () => Promise<Response>)()).status;
      statuses.push(status);
      if (status === 429) break;
    }
    expect(statuses.slice(0, RATE_LIMITS.read.capacity - 1).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("answers 404 to a cookieless answer request without creating a guest", async () => {
    const res = await answerRoute(post("/x", { questionIndex: 0, answer: { timeout: true } }), {
      params: Promise.resolve({ id: "whatever" }),
    });
    expect(res.status).toBe(404);
    expect(await env.ctx.db.user.count()).toBe(0);
  });

  it("returns the same response when an answer request is retried", async () => {
    const start = await read<StartSessionResponse>(
      await startRoute(post("/api/games/sessions", { mode: "career-stats", difficulty: "easy" })),
    );
    const params = { params: Promise.resolve({ id: start.sessionId }) };
    const key = await answerKeyOf(env.ctx, start.sessionId, 0);
    const body = { questionIndex: 0, answer: correctAnswerFor(key) };
    const first = await answerRoute(post("/x", body), params);
    const retry = await answerRoute(post("/x", body), params);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    const different = await answerRoute(
      post("/x", { questionIndex: 0, answer: { playerId: "someone_else" } }),
      params,
    );
    expect(different.status).toBe(409);
  });

  it("GET /api/leaderboard rejects unknown periods", async () => {
    expect((await leaderboardRoute(new Request(url("/api/leaderboard?period=year")))).status).toBe(
      400,
    );
    const ok = await leaderboardRoute(new Request(url("/api/leaderboard")));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ period: "all", rows: [], me: { rank: null } });
  });

  it("answers 50 questions with p95 < 150 ms", async () => {
    const latencies: number[] = [];
    for (let s = 0; s < 5; s++) {
      const start = await read<StartSessionResponse>(
        await startRoute(
          post("/api/games/sessions", { mode: "career-stats", difficulty: "medium" }),
        ),
      );
      const params = { params: Promise.resolve({ id: start.sessionId }) };
      for (let i = 0; i < start.total; i++) {
        resetRateLimits(); // measure handler latency, not the limiter
        const key = await answerKeyOf(env.ctx, start.sessionId, i);
        const t0 = performance.now();
        const res = await answerRoute(
          post("/x", { questionIndex: i, answer: correctAnswerFor(key) }),
          params,
        );
        latencies.push(performance.now() - t0);
        expect(res.status).toBe(200);
      }
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] ?? Infinity;
    console.log(
      `answer endpoint: n=${latencies.length} p50=${latencies[24]?.toFixed(1)} ms p95=${p95.toFixed(1)} ms`,
    );
    expect(latencies).toHaveLength(50);
    expect(p95).toBeLessThan(150);
  });
});
