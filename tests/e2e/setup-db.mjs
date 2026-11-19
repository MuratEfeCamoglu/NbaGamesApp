// Creates a fresh, isolated SQLite database for the e2e run (never touches the developer's dev.db).
// Applies every Prisma migration's SQL in order. Run from the project root by playwright.config.ts.
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const file = path.resolve(process.argv[2] ?? "test-e2e.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  if (existsSync(file + suffix)) rmSync(file + suffix);
}

const dir = path.resolve("prisma/migrations");
const migrations = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const db = new Database(file);
for (const name of migrations) {
  db.exec(readFileSync(path.join(dir, name, "migration.sql"), "utf8"));
}
db.close();
console.log(`[e2e] created ${path.basename(file)} from ${migrations.length} migration(s)`);
