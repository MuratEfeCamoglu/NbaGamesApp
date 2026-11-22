import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql/web";
import { describe, expect, it } from "vitest";
import { createDriverAdapter, dbConnectionFromEnv, localFilePath } from "./db";

describe("dbConnectionFromEnv", () => {
  it("uses Turso when TURSO_DATABASE_URL is set, with its token", () => {
    expect(
      dbConnectionFromEnv({
        TURSO_DATABASE_URL: "libsql://nba-games-acme.turso.io",
        TURSO_AUTH_TOKEN: "token-123",
        DATABASE_URL: "file:./dev.db",
      }),
    ).toEqual({ url: "libsql://nba-games-acme.turso.io", authToken: "token-123" });
  });

  it("falls back to DATABASE_URL, then to the default dev file", () => {
    expect(dbConnectionFromEnv({ DATABASE_URL: "file:./other.db" })).toEqual({
      url: "file:./other.db",
    });
    expect(dbConnectionFromEnv({})).toEqual({ url: "file:./dev.db" });
  });

  it("ignores blank Turso values (empty lines copied from .env.example)", () => {
    expect(
      dbConnectionFromEnv({
        TURSO_DATABASE_URL: "  ",
        TURSO_AUTH_TOKEN: "",
        DATABASE_URL: "file:./x.db",
      }),
    ).toEqual({ url: "file:./x.db" });
    expect(
      dbConnectionFromEnv({ TURSO_DATABASE_URL: "http://127.0.0.1:8080", TURSO_AUTH_TOKEN: " " }),
    ).toEqual({ url: "http://127.0.0.1:8080", authToken: undefined });
  });
});

describe("createDriverAdapter", () => {
  it("opens local files with better-sqlite3", () => {
    expect(createDriverAdapter("file:./dev.db")).toBeInstanceOf(PrismaBetterSqlite3);
  });

  it("reaches remote libSQL (Turso) with the libSQL adapter", () => {
    expect(createDriverAdapter("libsql://nba-games-acme.turso.io", "token")).toBeInstanceOf(
      PrismaLibSql,
    );
    expect(createDriverAdapter("https://nba-games-acme.turso.io")).toBeInstanceOf(PrismaLibSql);
  });
});

describe("localFilePath", () => {
  it("resolves a relative file against the project root like the Prisma CLI", () => {
    expect(localFilePath("file:./dev.db")).toBe(path.resolve(process.cwd(), "dev.db"));
  });

  it("keeps absolute paths and :memory:", () => {
    const abs = path.resolve("/tmp/nba-games-test.db");
    expect(localFilePath(`file:${abs}`)).toBe(abs);
    expect(localFilePath("file::memory:")).toBe(":memory:");
  });
});
