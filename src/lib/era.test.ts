import { describe, expect, it } from "vitest";
import { eraBadgeVariant, gameHref, parseEra, withEraParam } from "./era";

describe("era helpers (F16)", () => {
  it("parses only the two UI eras", () => {
    expect(parseEra("current")).toBe("current");
    expect(parseEra("retired")).toBe("retired");
    expect(parseEra("all")).toBeNull();
    expect(parseEra("Retired")).toBeNull();
    expect(parseEra(undefined)).toBeNull();
    expect(parseEra(["retired"])).toBeNull();
  });

  it("keeps the default era's game URL bare and adds ?era= for Retired", () => {
    expect(gameHref("box-score", "current")).toBe("/games/box-score");
    expect(gameHref("top-10", "retired")).toBe("/games/top-10?era=retired");
  });

  it("sets or removes the era param and keeps the others", () => {
    expect(withEraParam("", "retired")).toBe("?era=retired");
    expect(withEraParam("?era=retired", "current")).toBe("");
    expect(withEraParam("?era=current", "current")).toBe("");
    expect(withEraParam("?ref=home&era=current", "retired")).toBe("?ref=home&era=retired");
    expect(withEraParam("?ref=home&era=retired", "current")).toBe("?ref=home");
  });

  it("shows sessions without an era filter as mixed", () => {
    expect(eraBadgeVariant("current")).toBe("current");
    expect(eraBadgeVariant("retired")).toBe("retired");
    expect(eraBadgeVariant("all")).toBe("mixed");
  });
});
