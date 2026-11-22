// Global setup of the "libsql" Vitest project (the DB-backed suites rerun on the libSQL adapter
// that production uses with Turso). libSQL's local mode keeps each finished transaction's
// connection open until garbage collection, so a test can't always delete its database file
// (Windows locks open files). They all live in one folder, cleared before and after the run.
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const LIBSQL_TEST_DIR = path.join(tmpdir(), "nba-games-test-libsql");

function clear(): void {
  try {
    rmSync(LIBSQL_TEST_DIR, { recursive: true, force: true });
  } catch {
    // Still locked (another run in progress): files have unique names, the next run clears them.
  }
}

export default function setup(): () => void {
  clear();
  return clear;
}
