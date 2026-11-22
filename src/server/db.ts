import "server-only";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
// The web build reaches Turso over HTTP in plain JavaScript, so nothing native loads on Vercel.
import { PrismaLibSql } from "@prisma/adapter-libsql/web";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

export interface DbConnection {
  url: string;
  authToken?: string;
}

/**
 * Turso when TURSO_DATABASE_URL is set: on Vercel the disk is read-only and every instance has its
 * own, so a local SQLite file can't hold user data there. Otherwise the local file in DATABASE_URL.
 */
export function dbConnectionFromEnv(env: Record<string, string | undefined>): DbConnection {
  const turso = env.TURSO_DATABASE_URL?.trim();
  if (turso) return { url: turso, authToken: env.TURSO_AUTH_TOKEN?.trim() || undefined };
  return { url: env.DATABASE_URL ?? "file:./dev.db" };
}

/**
 * `file:./dev.db` is resolved against the project root (cwd), matching the Prisma CLI,
 * so the app and `prisma migrate` always open the same file.
 */
export function localFilePath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (raw === ":memory:" || path.isAbsolute(raw)) return raw;
  // A local database is never part of a deployment: keep the bundler from tracing the whole project.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), raw);
}

/**
 * Local files (dev, tests, e2e) use better-sqlite3; remote libSQL URLs (Turso) the libSQL adapter.
 * libSQL's own local mode isn't used: it keeps every finished transaction's connection open until
 * garbage collection, which leaks file handles and locks the file on Windows.
 */
export function createDriverAdapter(databaseUrl: string, authToken?: string) {
  return databaseUrl.startsWith("file:")
    ? new PrismaBetterSqlite3({ url: localFilePath(databaseUrl) })
    : new PrismaLibSql({ url: databaseUrl, authToken });
}

export function createPrismaClient(databaseUrl: string, authToken?: string): PrismaClient {
  return new PrismaClient({ adapter: createDriverAdapter(databaseUrl, authToken) });
}

// Survives Next dev hot reloads so we keep one client (one connection) per process.
const globalForPrisma = globalThis as unknown as { __ngPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.__ngPrisma) {
    const { url, authToken } = dbConnectionFromEnv(process.env);
    globalForPrisma.__ngPrisma = createPrismaClient(url, authToken);
  }
  return globalForPrisma.__ngPrisma;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
