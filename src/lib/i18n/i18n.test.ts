import { describe, expect, it } from "vitest";
import { GAME_MODES } from "@/games/core/types";
import {
  accuracyPct,
  fmtDecimal,
  fmtGameDate,
  fmtNumber,
  fmtPercent,
  fmtRelativeDay,
  guestName,
} from "@/lib/format";
import { difficultyMeta, modeTitle } from "@/lib/modes";
import { achievementCopy, en, getMessages, tr } from "./index";
import { localeCookie, localeFromAcceptLanguage, parseLocale, resolveLocale } from "./locales";
import { plural } from "./plural";

describe("locale resolution (F18)", () => {
  it("prefers the ng_lang cookie", () => {
    expect(resolveLocale({ cookie: "tr", acceptLanguage: "en-US,en;q=0.9" })).toBe("tr");
    expect(resolveLocale({ cookie: "en", acceptLanguage: "tr-TR,tr;q=0.9" })).toBe("en");
  });

  it("falls back to Accept-Language, then English", () => {
    expect(resolveLocale({ acceptLanguage: "tr-TR,tr;q=0.9,en;q=0.8" })).toBe("tr");
    expect(resolveLocale({ acceptLanguage: "de-DE,tr;q=0.7" })).toBe("tr");
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9,tr;q=0.8" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "de-DE,fr;q=0.8" })).toBe("en");
    expect(resolveLocale({})).toBe("en");
  });

  it("ignores an unknown cookie value and weights q-values", () => {
    expect(resolveLocale({ cookie: "de", acceptLanguage: "tr" })).toBe("tr");
    expect(localeFromAcceptLanguage("en;q=0.5, tr;q=0.9")).toBe("tr");
    expect(localeFromAcceptLanguage("tr;q=0")).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
    expect(parseLocale("TR")).toBeNull();
  });

  it("builds a year-long, site-wide cookie", () => {
    expect(localeCookie("tr")).toBe("ng_lang=tr; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});

/** Every leaf path → its value (strings and functions). */
function leaves(node: unknown, prefix = "", out = new Map<string, unknown>()) {
  if (typeof node === "string" || typeof node === "function") {
    out.set(prefix, node);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

describe("dictionaries", () => {
  const enLeaves = leaves(en);
  const trLeaves = leaves(tr);

  it("Turkish has exactly the English keys, with the same kinds", () => {
    expect([...trLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
    for (const [path, value] of enLeaves)
      expect(typeof trLeaves.get(path), path).toBe(typeof value);
    expect(enLeaves.size).toBeGreaterThan(250);
  });

  it("has no empty strings", () => {
    for (const map of [enLeaves, trLeaves]) {
      for (const [path, value] of map) {
        if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      }
    }
  });

  it("actually translates: most Turkish strings differ from English", () => {
    let same = 0;
    for (const [path, value] of enLeaves) if (trLeaves.get(path) === value) same++;
    // Allowed to match: stat abbreviation rules, "Air ball.", language names…
    expect(same).toBeLessThan(12);
  });

  it("keeps mode names English and translates the copy", () => {
    expect(modeTitle("box-score", tr)).toBe("Box Score");
    expect(modeTitle("daily", tr)).toBe("Günün Meydan Okuması");
    expect(modeTitle("daily", en)).toBe("Daily Challenge");
    for (const m of GAME_MODES) expect(tr.modes[m].cardDesc).not.toBe(en.modes[m].cardDesc);
  });

  it("interpolates and pluralizes", () => {
    expect(tr.play.timeUpWas("Kobe Bryant")).toBe("Süre doldu — cevap: Kobe Bryant.");
    expect(en.play.timeUpWas("Kobe Bryant")).toBe("Time's up — it was Kobe Bryant.");
    expect(en.question.seasons(1)).toBe("1 season");
    expect(en.question.seasons(14)).toBe("14 seasons");
    expect(tr.question.seasons(14)).toBe("14 sezon");
    expect(plural("tr", 1, { one: "a", other: "b" })).toBe("a");
    expect(plural("en", 2, { one: "a", other: "b" })).toBe("b");
    expect(difficultyMeta("starting-five", "easy", tr)).toBe("4 şık · 30 sn");
    expect(difficultyMeta("box-score", "expert", tr)).toBe("Arama · 20 sn · daha az ipucu");
    expect(difficultyMeta("top-10", "expert", tr)).toBe("5 boşluk · 60 sn");
  });

  it("maps Top 10 list titles and keeps unknown ones", () => {
    expect(tr.question.listTitle("Career 3-Pointers Made")).toBe("Kariyer Toplam Üçlük");
    expect(tr.question.listTitle("Career Points — Active Players")).toBe(
      "Kariyer Toplam Sayı — Aktif Oyuncular",
    );
    expect(tr.question.listTitle("Career Dunks")).toBe("Career Dunks");
    expect(en.question.listTitle("Career Points")).toBe("Career Points");
  });

  it("maps achievements by id, falling back to the API text", () => {
    expect(achievementCopy(tr, { id: "streak-5", name: "Streak 5" }).name).toBe("5'lik Seri");
    expect(achievementCopy(en, { id: "streak-5", name: "Streak 5" }).name).toBe("Streak 5");
    expect(achievementCopy(tr, { id: "new-one", name: "New One", description: "d" })).toEqual({
      name: "New One",
      description: "d",
    });
  });

  it("explains a server nickname rejection in Turkish, never in English", () => {
    expect(tr.nickname.rejected("This nickname is not allowed.")).toBe(
      "Bu takma ada izin verilmiyor.",
    );
    expect(tr.nickname.rejected("Use only letters, numbers and underscores.")).toBe(
      "Yalnız harf, rakam ve alt çizgi.",
    );
    expect(en.nickname.rejected("This nickname is not allowed.")).toBe(
      "This nickname is not allowed.",
    );
    expect(en.nickname.rejected("")).toBe("That nickname isn't allowed.");
  });

  it("getMessages defaults to English", () => {
    expect(getMessages()).toBe(en);
    expect(getMessages("tr")).toBe(tr);
  });
});

describe("locale formatting", () => {
  it("formats Turkish numbers, decimals and percents", () => {
    expect(fmtNumber(12480, "tr")).toBe("12.480");
    expect(fmtNumber(12480)).toBe("12,480");
    expect(fmtDecimal(27.14, "tr")).toBe("27,1");
    expect(fmtDecimal(27.14)).toBe("27.1");
    expect(fmtPercent(accuracyPct(8, 10), "tr")).toBe("%80");
    expect(fmtPercent(80)).toBe("80%");
  });

  it("formats Turkish dates and relative days", () => {
    expect(fmtGameDate("2026-11-19", "tr")).toBe("19 Kas 2026");
    const now = new Date(2026, 10, 19, 15, 0);
    expect(fmtRelativeDay(new Date(2026, 10, 19, 1, 0).toISOString(), now, "tr")).toBe("Bugün");
    expect(fmtRelativeDay(new Date(2026, 10, 18, 23, 0).toISOString(), now, "tr")).toBe("Dün");
    expect(guestName("cku4f2a", "tr")).toBe("Misafir 4F2A");
  });
});
