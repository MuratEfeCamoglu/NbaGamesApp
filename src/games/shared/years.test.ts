import { describe, expect, it } from "vitest";
import { formatYears } from "./years";

describe("formatYears", () => {
  it("uses the first start year and the last end year with an en dash", () => {
    expect(formatYears("2003-04", "2010-11")).toBe("2003–11");
    expect(formatYears("2017-18", "2017-18")).toBe("2017–18");
    expect(formatYears("1999-00", "1999-00")).toBe("1999–00");
  });
});
