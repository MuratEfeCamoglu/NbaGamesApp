import "server-only";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;

/**
 * `file:./dev.db` is resolved against the project root (cwd), matching the Prisma CLI,
 * so the app and `prisma migrate` always open the same file.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const raw = databaseUrl.replace(/^file:/, "");
  const file = raw === ":memory:" || path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: file }) });
}

// Survives Next dev hot reloads so we keep one client (one SQLite handle) per process.
const globalForPrisma = globalThis as unknown as { __ngPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.__ngPrisma) {
    globalForPrisma.__ngPrisma = createPrismaClient(process.env.DATABASE_URL ?? "file:./dev.db");
  }
  return globalForPrisma.__ngPrisma;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
