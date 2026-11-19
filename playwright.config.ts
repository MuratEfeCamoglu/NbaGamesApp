import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** e2e runs against its own SQLite file so the developer's dev.db is never touched. */
const E2E_DB = "test-e2e.db";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  // Every test makes its own browser context (fresh guest cookie); per-user rate limits stay real.
  workers: 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: `node tests/e2e/setup-db.mjs ${E2E_DB} && npm run build && npm start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Process env wins over .env in Next.js, so the server uses the e2e database.
    // Every test context is a new guest from the same local client key; lift the per-hour guest cap.
    env: { DATABASE_URL: `file:./${E2E_DB}`, GUEST_LIMIT_PER_HOUR: "100000" },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
