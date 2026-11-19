import { describe, expect, it } from "vitest";
import { createFixtureDataSource } from "../test-fixtures";
import { toPlayerRef } from "./player-ref";

const ds = createFixtureDataSource();

describe("toPlayerRef", () => {
  it("uses the given team", () => {
    expect(toPlayerRef(ds, "2544", "MIA")).toEqual({
      id: "2544",
      name: "LeBron James",
      position: "F",
      teamId: "MIA",
      headshotId: "2544",
    });
  });

  it("falls back to the latest roster team, else null", () => {
    expect(toPlayerRef(ds, "202691").teamId).toBe("DAL");
    // Final season 2018-19 only with MIA.
    expect(toPlayerRef(ds, "2548").teamId).toBe("MIA");
    // No roster rows for Michael Jordan in the fixture (leaderboard-only player).
    expect(toPlayerRef(ds, "893").teamId).toBeNull();
  });

  it("throws on unknown players", () => {
    expect(() => toPlayerRef(ds, "999999999")).toThrow();
  });
});
