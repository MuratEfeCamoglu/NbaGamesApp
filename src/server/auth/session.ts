import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { ServiceContext } from "../context";
import { clientKey, enforceRateLimit } from "../rate-limit";

export const SESSION_COOKIE = "ng_uid";
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;
const MIN_SECRET_BYTES = 32;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < MIN_SECRET_BYTES) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 bytes (see .env.example).");
  }
  return value;
}

function mac(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("base64url");
}

/** Cookie value: `<userId>.<HMAC-SHA256(userId)>`. */
export function signUserId(userId: string): string {
  return `${userId}.${mac(userId)}`;
}

/** Returns the user id when the signature is valid, otherwise null. */
export function verifySignedUserId(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(mac(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}

/** Read-only: the signed-in guest id, or null (does not create a user). */
export async function getCurrentUserId(ctx: ServiceContext): Promise<string | null> {
  const store = await cookies();
  const userId = verifySignedUserId(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await ctx.db.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * Returns the guest id from the cookie, creating a new guest (and setting the cookie) when the
 * cookie is missing, tampered with, or points to a user that no longer exists.
 * Only callable from Route Handlers / Server Actions (cookies can't be set while rendering).
 *
 * Guest creation is rate-limited per client (not per user id, which a cookieless client would
 * get fresh on every request) and checked before the insert, so spamming cookieless requests
 * can neither bypass the per-user limits nor grow the User table without bound.
 */
export async function getOrCreateUserId(ctx: ServiceContext, req: Request): Promise<string> {
  const existing = await getCurrentUserId(ctx);
  if (existing) return existing;
  enforceRateLimit("guest", clientKey(req));
  const user = await ctx.db.user.create({ data: {}, select: { id: true } });
  const store = await cookies();
  store.set(SESSION_COOKIE, signUserId(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SEC,
  });
  return user.id;
}
