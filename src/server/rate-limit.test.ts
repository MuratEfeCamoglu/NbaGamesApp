import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, toErrorResponse } from "./errors";
import {
  clientKey,
  enforceRateLimit,
  RATE_LIMITS,
  resetRateLimits,
  TokenBucketLimiter,
  UNKNOWN_CLIENT,
} from "./rate-limit";

describe("TokenBucketLimiter", () => {
  it("allows `capacity` requests per window, then refills over time", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter(3, 3_000, () => now);
    expect([1, 2, 3, 4].map(() => limiter.consume("u"))).toEqual([true, true, true, false]);
    expect(limiter.consume("other")).toBe(true);
    now += 1_000; // one token back
    expect(limiter.consume("u")).toBe(true);
    expect(limiter.consume("u")).toBe(false);
  });
});

describe("TokenBucketLimiter memory", () => {
  it("caps the number of keys, evicting the least recently used first", () => {
    const now = 0;
    const limiter = new TokenBucketLimiter(2, 1_000, () => now, 3);
    limiter.consume("a");
    limiter.consume("a"); // a is now empty
    limiter.consume("b");
    limiter.consume("c");
    limiter.consume("a"); // touch a: b becomes the oldest
    expect(limiter.consume("a")).toBe(false);
    limiter.consume("d"); // over the cap: b is evicted, a keeps its (empty) state
    expect(limiter.size).toBe(3);
    expect(limiter.consume("a")).toBe(false);
  });

  it("drops buckets idle for a full window without scanning fresh ones", () => {
    let now = 0;
    const limiter = new TokenBucketLimiter(5, 1_000, () => now);
    for (let i = 0; i < 50; i++) limiter.consume(`k${i}`);
    expect(limiter.size).toBe(50);
    now += 1_000;
    limiter.consume("fresh");
    expect(limiter.size).toBe(1);
  });
});

describe("clientKey", () => {
  const original = process.env.TRUST_PROXY;
  afterEach(() => {
    process.env.TRUST_PROXY = original;
  });
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("ignores spoofable forwarding headers unless TRUST_PROXY=true", () => {
    delete process.env.TRUST_PROXY;
    expect(clientKey(req({ "x-forwarded-for": "1.1.1.1" }))).toBe(UNKNOWN_CLIENT);
    expect(clientKey(req({ "x-real-ip": "1.1.1.1" }))).toBe(UNKNOWN_CLIENT);
    process.env.TRUST_PROXY = "1";
    expect(clientKey(req({ "x-forwarded-for": "1.1.1.1" }))).toBe(UNKNOWN_CLIENT);
  });

  it("uses the hop appended by the trusted proxy (rightmost) with TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("ip:203.0.113.7");
    expect(clientKey(req({ "x-real-ip": "203.0.113.8" }))).toBe("ip:203.0.113.8");
    expect(clientKey(req({}))).toBe(UNKNOWN_CLIENT);
  });
});

describe("enforceRateLimit", () => {
  it("throws RATE_LIMITED (429) after the answer limit", () => {
    resetRateLimits();
    for (let i = 0; i < RATE_LIMITS.answer.capacity; i++) enforceRateLimit("answer", "user-1");
    let caught: unknown;
    try {
      enforceRateLimit("answer", "user-1");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).status).toBe(429);
  });
});

describe("toErrorResponse", () => {
  it("maps AppError codes and hides unexpected errors", async () => {
    const res = toErrorResponse(new AppError("EXPIRED", "Session expired."));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: { code: "EXPIRED", message: "Session expired." } });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const internal = toErrorResponse(new Error("db path C:\\secret"));
    expect(internal.status).toBe(500);
    const body = JSON.stringify(await internal.json());
    expect(body).toContain("INTERNAL");
    expect(body).not.toContain("secret");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
