import "server-only";
import { AppError } from "./errors";

/** Swap point for a shared store (e.g. Redis) when running more than one instance (ISKELET V6). */
export interface RateLimiter {
  /** Returns true when the request may proceed (and consumes a token). */
  consume(key: string): boolean;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Hard cap on tracked keys per limiter; beyond it the least recently used key is evicted. */
export const MAX_KEYS = 10_000;

export class TokenBucketLimiter implements RateLimiter {
  // Map iteration order = insertion order. Every consume re-inserts its key, so the map is
  // always ordered from least to most recently used: eviction and pruning start at the front.
  private readonly buckets = new Map<string, Bucket>();
  private lastPruneAt: number;

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    private readonly nowMs: () => number = Date.now,
    private readonly maxKeys: number = MAX_KEYS,
  ) {
    this.lastPruneAt = nowMs();
  }

  consume(key: string): boolean {
    const now = this.nowMs();
    const refillPerMs = this.capacity / this.windowMs;
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    // Amortised: at most one age sweep per window, and each sweep stops at the first fresh key.
    if (now - this.lastPruneAt >= this.windowMs) this.pruneIdle(now);
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
    return allowed;
  }

  /** Number of tracked keys (tests / diagnostics). */
  get size(): number {
    return this.buckets.size;
  }

  private pruneIdle(now: number) {
    this.lastPruneAt = now;
    // A bucket untouched for a full window has refilled completely and carries no state.
    for (const [key, b] of this.buckets) {
      if (now - b.updatedAt < this.windowMs) break;
      this.buckets.delete(key);
    }
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_GUESTS_PER_HOUR = 10;

/**
 * New guest accounts per client key per hour. Overridable with `GUEST_LIMIT_PER_HOUR` because
 * without a trusted proxy all cookieless clients share one key (see `clientKey`), and the e2e
 * suite creates a fresh guest per browser context.
 */
function guestsPerHour(): number {
  const raw = Number(process.env.GUEST_LIMIT_PER_HOUR);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_GUESTS_PER_HOUR;
}

/**
 * ISKELET §5: answer 30/10 s, search 20/10 s, other writes 10/min. Additionally: reads 120/min
 * and guest creation (keyed by client, checked before the User row is inserted).
 */
export const RATE_LIMITS = {
  answer: { capacity: 30, windowMs: 10_000 },
  search: { capacity: 20, windowMs: 10_000 },
  write: { capacity: 10, windowMs: 60_000 },
  read: { capacity: 120, windowMs: 60_000 },
  guest: { capacity: DEFAULT_GUESTS_PER_HOUR, windowMs: HOUR_MS },
} as const;
export type RateLimitKind = keyof typeof RATE_LIMITS;

function createLimiters(): Record<RateLimitKind, RateLimiter> {
  const make = (kind: RateLimitKind, capacity: number = RATE_LIMITS[kind].capacity) =>
    new TokenBucketLimiter(capacity, RATE_LIMITS[kind].windowMs);
  return {
    answer: make("answer"),
    search: make("search"),
    write: make("write"),
    read: make("read"),
    guest: make("guest", guestsPerHour()),
  };
}

const globalForLimits = globalThis as unknown as {
  __ngLimiters?: Record<RateLimitKind, RateLimiter>;
};

function limiters(): Record<RateLimitKind, RateLimiter> {
  const fresh = createLimiters();
  const cached = globalForLimits.__ngLimiters;
  // A dev hot reload can leave a cache built before a new limiter kind existed: rebuild it then.
  if (!cached || Object.keys(fresh).some((k) => !(k in cached))) {
    globalForLimits.__ngLimiters = fresh;
  }
  return globalForLimits.__ngLimiters as Record<RateLimitKind, RateLimiter>;
}

export function enforceRateLimit(kind: RateLimitKind, key: string): void {
  if (!limiters()[kind].consume(`${kind}:${key}`)) {
    throw new AppError("RATE_LIMITED", "Too many requests. Slow down and try again in a moment.");
  }
}

export function resetRateLimits(): void {
  globalForLimits.__ngLimiters = createLimiters();
}

/** Shared key used when the client address can't be trusted. */
export const UNKNOWN_CLIENT = "unknown";

/**
 * Rate-limit key for a request without a (valid) guest cookie.
 *
 * `X-Forwarded-For` / `X-Real-IP` are client-controlled unless a reverse proxy we trust sets
 * them, so they're only read with `TRUST_PROXY=true`. Then the rightmost XFF entry is used:
 * that's the one appended by the (single) trusted proxy; anything left of it may be forged.
 * Route Handlers get a web `Request` without the socket address, so otherwise every such
 * client shares one key — strict, but never bypassable by sending a different header.
 */
export function clientKey(req: Request): string {
  if (process.env.TRUST_PROXY !== "true") return UNKNOWN_CLIENT;
  const hops = req.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const ip = hops?.[hops.length - 1] ?? req.headers.get("x-real-ip")?.trim();
  return ip ? `ip:${ip}` : UNKNOWN_CLIENT;
}
