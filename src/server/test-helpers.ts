// Test-only helpers: a throwaway SQLite DB with the real migrations applied, the fixture data
// source and a controllable clock. Never imported by application code.
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { createFixtureDataSource } from "@/games/test-fixtures";
import type { AnswerKey, SubmittedAnswer } from "@/games/core/types";
import { LIBSQL_TEST_DIR } from "@/test/libsql-global-setup";
import type { ServiceContext } from "./context";
import { createPrismaClient, type Db } from "./db";

export const TEST_START = new Date("2026-03-10T12:00:00.000Z");
export const TEST_SECRET = "test-secret-0123456789-0123456789-abcdef";

export interface TestClock {
  now(): Date;
  set(date: Date): void;
  advanceSec(sec: number): void;
}

export function createClock(start: Date = TEST_START): TestClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    set: (d) => {
      current = d.getTime();
    },
    advanceSec: (sec) => {
      current += sec * 1000;
    },
  };
}

async function applyMigrations(db: Db): Promise<void> {
  const dir = path.resolve(process.cwd(), "prisma/migrations");
  const migrations = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of migrations) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
      const body = statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (body) await db.$executeRawUnsafe(body);
    }
  }
}

export interface TestEnv {
  ctx: ServiceContext;
  clock: TestClock;
  cleanup(): Promise<void>;
}

/**
 * A fresh database file. The "libsql" Vitest project (TEST_DB=libsql) opens it with the libSQL
 * adapter production uses with Turso (node build, which also reads local files); its files are
 * cleared by src/test/libsql-global-setup.ts because libSQL may still hold them open.
 */
function openTestDb(): { db: Db; file: string; removeFile: boolean } {
  if (process.env.TEST_DB === "libsql") {
    mkdirSync(LIBSQL_TEST_DIR, { recursive: true });
    const file = path.join(LIBSQL_TEST_DIR, `${randomUUID()}.db`);
    const adapter = new PrismaLibSql({ url: `file:${file.replaceAll("\\", "/")}` });
    return { db: new PrismaClient({ adapter }), file, removeFile: false };
  }
  const file = path.join(tmpdir(), `nba-games-test-${randomUUID()}.db`);
  return { db: createPrismaClient(`file:${file}`), file, removeFile: true };
}

export async function createTestEnv(seedStart = 1): Promise<TestEnv> {
  const { db, file, removeFile } = openTestDb();
  await applyMigrations(db);
  const clock = createClock();
  let seed = seedStart;
  const ctx: ServiceContext = {
    db,
    ds: createFixtureDataSource(),
    now: clock.now,
    randomSeed: () => seed++,
  };
  return {
    ctx,
    clock,
    cleanup: async () => {
      await db.$disconnect();
      if (!removeFile) return;
      for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(file + suffix, { force: true });
    },
  };
}

export async function createUser(ctx: ServiceContext, nickname?: string): Promise<string> {
  const user = await ctx.db.user.create({
    data: nickname ? { nickname, nicknameKey: nickname.toLowerCase() } : {},
  });
  return user.id;
}

/** Reads the stored key of a question (what only the server knows). */
export async function answerKeyOf(
  ctx: ServiceContext,
  sessionId: string,
  index: number,
): Promise<AnswerKey> {
  const q = await ctx.db.question.findUniqueOrThrow({
    where: { sessionId_index: { sessionId, index } },
  });
  return JSON.parse(q.answerKey) as AnswerKey;
}

export function correctAnswerFor(key: AnswerKey): SubmittedAnswer {
  return key.kind === "player" ? { playerId: key.playerId } : { slots: { ...key.slots } };
}

export function wrongAnswerFor(key: AnswerKey): SubmittedAnswer {
  if (key.kind === "player") return { playerId: "__wrong__" };
  return { slots: Object.fromEntries(Object.keys(key.slots).map((rank) => [rank, "__wrong__"])) };
}
