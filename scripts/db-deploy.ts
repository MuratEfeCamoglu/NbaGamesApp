// Applies pending Prisma migrations to the Turso (libSQL) database: `npm run db:deploy`.
// Prisma Migrate can't connect to libSQL, so this runs the same migration.sql files that
// `prisma migrate dev` writes locally and records them in Prisma's own _prisma_migrations table
// (same columns, same checksums), so the migration history reads the same everywhere.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";

export const MIGRATIONS_DIR = path.resolve("prisma/migrations");

// Prisma's own DDL for its history table.
const CREATE_HISTORY_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

/**
 * Prisma's checksum (SHA-256, hex) of a migration file. CRLF is folded to LF first: a Windows
 * checkout (core.autocrlf) and a Linux build must agree, and Prisma's recorded values match LF.
 */
export function migrationChecksum(sql: string): string {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

export interface DeployResult {
  applied: string[];
  warnings: string[];
}

/**
 * Applies, in name order, every migration folder not yet finished in the database. A failed
 * migration stays recorded without `finished_at` (as with Prisma) and blocks later runs until
 * someone repairs the database by hand: half-applied SQL must not be run again blindly.
 */
export async function deployMigrations(
  client: Client,
  dir: string = MIGRATIONS_DIR,
  now: () => number = Date.now,
): Promise<DeployResult> {
  if (!existsSync(dir)) throw new Error(`Migration klasörü bulunamadı: ${dir}`);
  await client.execute(CREATE_HISTORY_TABLE);
  const { rows } = await client.execute(
    `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`,
  );

  const failed = rows.filter((r) => r.finished_at === null && r.rolled_back_at === null);
  if (failed.length > 0) {
    const names = failed.map((r) => String(r.migration_name)).join(", ");
    throw new Error(
      `Yarım kalmış migration var: ${names}. Veritabanını elle düzeltip _prisma_migrations ` +
        `tablosundaki satırına rolled_back_at yazın (ya da satırı silin), sonra tekrar çalıştırın.`,
    );
  }

  const done = new Map(
    rows
      .filter((r) => r.finished_at !== null && r.rolled_back_at === null)
      .map((r) => [String(r.migration_name), String(r.checksum)]),
  );
  const local = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const warnings = [...done.keys()]
    .filter((name) => !local.includes(name))
    .map((name) => `${name} veritabanında uygulanmış ama yerelde yok`);
  const applied: string[] = [];

  for (const name of local) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    const checksum = migrationChecksum(sql);
    const recorded = done.get(name);
    if (recorded !== undefined) {
      if (recorded !== checksum) warnings.push(`${name} uygulandıktan sonra değiştirilmiş`);
      continue;
    }

    const id = randomUUID();
    await client.execute({
      sql: `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, 0)`,
      args: [id, checksum, name, now()],
    });
    try {
      await client.executeMultiple(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await client.execute({
        sql: `UPDATE "_prisma_migrations" SET logs = ? WHERE id = ?`,
        args: [message, id],
      });
      throw new Error(`${name} uygulanamadı: ${message}`);
    }
    await client.execute({
      sql: `UPDATE "_prisma_migrations" SET finished_at = ?, applied_steps_count = 1 WHERE id = ?`,
      args: [now(), id],
    });
    applied.push(name);
  }
  return { applied, warnings };
}

/** Host only: a libSQL URL may carry `?authToken=…`, which must not reach build logs. */
export function targetName(url: string): string {
  if (url.startsWith("file:")) return "Yerel dosya";
  try {
    return new URL(url).host || url.split("?")[0]!;
  } catch {
    return "Veritabanı";
  }
}

async function main(): Promise<number> {
  // Locally the values may sit in .env; on Vercel they come from the project's environment.
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "TURSO_DATABASE_URL tanımlı değil — migration uygulanmadı. " +
        "Yerel SQLite veritabanı için npm run db:migrate kullanın.",
    );
    return 1;
  }
  // Remote URLs use the HTTP client (plain JavaScript); only a local file needs the native build.
  const { createClient } = url.startsWith("file:")
    ? await import("@libsql/client")
    : await import("@libsql/client/web");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  const target = targetName(url);
  try {
    const { applied, warnings } = await deployMigrations(client);
    for (const warning of warnings) console.warn(`Uyarı: ${warning}`);
    console.log(
      applied.length > 0
        ? `${target}: ${applied.length} migration uygulandı: ${applied.join(", ")}`
        : `${target}: veritabanı güncel, uygulanacak migration yok.`,
    );
    return 0;
  } catch (err) {
    console.error(`${target}: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
