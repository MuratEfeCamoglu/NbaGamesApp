import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Runs only in the "libsql" project, whose global setup clears the files libSQL leaves open. */
const LIBSQL_ONLY = "scripts/db-deploy.test.ts";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside the Next bundler; tests run server code directly.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**"],
    setupFiles: ["src/test/setup.ts"],
    // `include` lives in each project: `extends: true` concatenates arrays with the root config.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: [LIBSQL_ONLY],
        },
      },
      {
        // The DB-backed suites again, on the libSQL adapter production uses with Turso (local
        // dev and the default run use better-sqlite3), plus the Turso migration script.
        extends: true,
        test: {
          name: "libsql",
          include: ["src/server/services/**/*.test.ts", "src/app/api/**/*.test.ts", LIBSQL_ONLY],
          env: { TEST_DB: "libsql" },
          globalSetup: ["src/test/libsql-global-setup.ts"],
        },
      },
    ],
  },
});
