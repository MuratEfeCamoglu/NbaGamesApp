import "server-only";
import { randomInt } from "node:crypto";
import type { NbaDataSource } from "@/data/source";
import { getNbaDataSource } from "@/data/static-source";
import { getDb, type Db } from "./db";

/** Everything services depend on, injectable so tests use a temp DB, fixture data and a fake clock. */
export interface ServiceContext {
  db: Db;
  ds: NbaDataSource;
  now: () => Date;
  /** Seed for non-daily sessions. */
  randomSeed: () => number;
}

const globalForCtx = globalThis as unknown as { __ngCtxOverride?: ServiceContext };

export function getServiceContext(): ServiceContext {
  if (globalForCtx.__ngCtxOverride) return globalForCtx.__ngCtxOverride;
  return {
    db: getDb(),
    ds: getNbaDataSource(),
    now: () => new Date(),
    randomSeed: () => randomInt(0, 2 ** 31 - 1),
  };
}

/** Tests only: route handlers will use this context instead of the real DB/seed. */
export function setServiceContextOverride(ctx: ServiceContext | undefined): void {
  globalForCtx.__ngCtxOverride = ctx;
}
