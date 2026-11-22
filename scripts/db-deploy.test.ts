import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { LIBSQL_TEST_DIR } from "@/test/libsql-global-setup";
import { deployMigrations, migrationChecksum, MIGRATIONS_DIR, targetName } from "./db-deploy";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/**
 * A libSQL client on an empty file (the client API Turso is reached with). libSQL may hold the
 * file open after close(), so it isn't deleted here: the "libsql" project's global setup clears
 * the folder.
 */
function emptyDb(): Client {
  mkdirSync(LIBSQL_TEST_DIR, { recursive: true });
  const file = path.join(LIBSQL_TEST_DIR, `deploy-${randomUUID()}.db`);
  const client = createClient({ url: `file:${file.replaceAll("\\", "/")}` });
  cleanups.push(() => client.close());
  return client;
}

function migrationsDir(files: Record<string, string>): string {
  const dir = path.join(tmpdir(), `nba-games-migrations-${randomUUID()}`);
  for (const [name, sql] of Object.entries(files)) {
    mkdirSync(path.join(dir, name), { recursive: true });
    writeFileSync(path.join(dir, name, "migration.sql"), sql);
  }
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function history(client: Client) {
  const { rows } = await client.execute(
    `SELECT migration_name, checksum, finished_at, logs FROM "_prisma_migrations" ORDER BY migration_name`,
  );
  return rows.map((r) => ({ ...r }));
}

async function tables(client: Client): Promise<string[]> {
  const { rows } = await client.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  return rows.map((r) => String(r.name));
}

describe("migrationChecksum", () => {
  it("matches what `prisma migrate dev` recorded, whatever the line endings", () => {
    const init = readFileSync(
      path.join(MIGRATIONS_DIR, "20261119164813_init/migration.sql"),
      "utf8",
    );
    expect(migrationChecksum(init)).toBe(
      "158c637cd54d0619a4f34b986a597780e14846e3a99956a8479cf8a8fa680020",
    );
    expect(migrationChecksum("CREATE TABLE a (x);\r\n")).toBe(
      migrationChecksum("CREATE TABLE a (x);\n"),
    );
  });
});

describe("deployMigrations", () => {
  it("builds the app schema from the real migrations, then has nothing left to do", async () => {
    const client = emptyDb();
    let clock = 1_000;
    const first = await deployMigrations(client, MIGRATIONS_DIR, () => clock++);

    expect(first.applied).toEqual([
      "20261119164813_init",
      "20261119181200_answer_idempotency",
      "20261120082526_session_era",
    ]);
    expect(first.warnings).toEqual([]);
    expect(await tables(client)).toEqual(
      expect.arrayContaining(["GameSession", "Question", "User", "UserAchievement"]),
    );
    const rows = await history(client);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const sql = readFileSync(
        path.join(MIGRATIONS_DIR, String(row.migration_name), "migration.sql"),
        "utf8",
      );
      expect(row.checksum).toBe(migrationChecksum(sql));
      expect(row.finished_at).not.toBeNull();
    }
    // The era column comes from the last migration's table rebuild.
    const columns = await client.execute(`SELECT name FROM pragma_table_info('GameSession')`);
    expect(columns.rows.map((r) => r.name)).toContain("era");

    expect(await deployMigrations(client)).toEqual({ applied: [], warnings: [] });
  });

  it("applies only migrations added since the last run", async () => {
    const client = emptyDb();
    const one = { "001_a": "CREATE TABLE a (x INTEGER);\n" };
    expect((await deployMigrations(client, migrationsDir(one))).applied).toEqual(["001_a"]);

    const two = { ...one, "002_b": "CREATE TABLE b (y TEXT);\nINSERT INTO b VALUES ('ok');\n" };
    expect((await deployMigrations(client, migrationsDir(two))).applied).toEqual(["002_b"]);
    expect(await tables(client)).toEqual(["_prisma_migrations", "a", "b"]);
  });

  it("records a failed migration and refuses to continue until it is repaired", async () => {
    const client = emptyDb();
    const dir = migrationsDir({
      "001_ok": "CREATE TABLE a (x INTEGER);\n",
      "002_bad": "CREATE TABLE b (y TEXT);\nTHIS IS NOT SQL;\n",
      "003_later": "CREATE TABLE c (z TEXT);\n",
    });

    await expect(deployMigrations(client, dir)).rejects.toThrow(/002_bad uygulanamadı/);
    const rows = await history(client);
    expect(rows.map((r) => [r.migration_name, r.finished_at === null])).toEqual([
      ["001_ok", false],
      ["002_bad", true],
    ]);
    expect(rows[1]?.logs).toBeTruthy();
    expect(await tables(client)).not.toContain("c");

    await expect(deployMigrations(client, dir)).rejects.toThrow(
      /Yarım kalmış migration var: 002_bad/,
    );
  });

  it("warns about history that no longer matches the local folders", async () => {
    const client = emptyDb();
    await deployMigrations(
      client,
      migrationsDir({ "001_a": "CREATE TABLE a (x INTEGER);\n", "002_b": "CREATE TABLE b (y);\n" }),
    );

    const result = await deployMigrations(
      client,
      migrationsDir({ "001_a": "CREATE TABLE a (x INTEGER, extra TEXT);\n" }),
    );
    expect(result.applied).toEqual([]);
    expect(result.warnings).toEqual([
      "002_b veritabanında uygulanmış ama yerelde yok",
      "001_a uygulandıktan sonra değiştirilmiş",
    ]);
  });

  it("stops when the migrations folder is missing", async () => {
    await expect(
      deployMigrations(emptyDb(), path.join(tmpdir(), "no-such-folder")),
    ).rejects.toThrow(/Migration klasörü bulunamadı/);
  });
});

describe("targetName", () => {
  it("names the host without the query string, where a token may sit", () => {
    expect(targetName("libsql://nba-games-acme.turso.io?authToken=secret")).toBe(
      "nba-games-acme.turso.io",
    );
    expect(targetName("https://nba-games-acme.turso.io")).toBe("nba-games-acme.turso.io");
    expect(targetName("file:./dev.db")).toBe("Yerel dosya");
  });
});
