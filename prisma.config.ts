// Prisma 7 CLI config (schema path, migrations, datasource URL for migrate).
// Prisma 7 no longer auto-loads .env, so load it with Node's built-in loader when present.
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
