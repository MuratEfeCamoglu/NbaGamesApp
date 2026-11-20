// Display formatting shared by components. Pure functions (unit-tested in format.test.ts).
// Every formatter takes the UI locale (F18); "en" is the default so English output never changes.
import { INTL_LOCALE, type Locale } from "./i18n/locales";

export function fmtNumber(n: number, locale: Locale = "en"): string {
  return n.toLocaleString(INTL_LOCALE[locale]);
}

/** One decimal, for per-game averages and FG% ("27.1" / "27,1"). */
export function fmtDecimal(n: number, locale: Locale = "en"): string {
  if (locale === "en") return n.toFixed(1);
  return n.toLocaleString(INTL_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  });
}

/** Whole percent: "80%" in English, "%80" in Turkish. */
export function fmtPercent(pct: number, locale: Locale = "en"): string {
  return locale === "tr" ? `%${pct}` : `${pct}%`;
}

export function initials(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

/** Team ids arrive uppercase ("GSW"); CSS team hooks are lowercase (`data-team="gsw"`). */
export function teamKey(teamId: string | null | undefined): string | undefined {
  return teamId ? teamId.toLowerCase() : undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "05:12:33" from milliseconds (clamped at 0). */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "Jan 22, 2006" / "22 Oca 2006" from "2006-01-22" (UTC, so the calendar date never shifts). */
export function fmtGameDate(isoDate: string, locale: Locale = "en"): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(INTL_LOCALE[locale], {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Thursday, Nov 19" / "19 Kas Perşembe" from "2026-11-19". */
export function fmtDailyDate(isoDate: string, locale: Locale = "en"): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(INTL_LOCALE[locale], {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const RELATIVE_DAY: Record<Locale, { today: string; yesterday: string }> = {
  en: { today: "Today", yesterday: "Yesterday" },
  tr: { today: "Bugün", yesterday: "Dün" },
};

/** History list: "Today" / "Yesterday" / "Nov 16" relative to `now`. */
export function fmtRelativeDay(iso: string, now: Date, locale: Locale = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return RELATIVE_DAY[locale].today;
  if (days === 1) return RELATIVE_DAY[locale].yesterday;
  return d.toLocaleDateString(INTL_LOCALE[locale], { month: "short", day: "numeric" });
}

export function accuracyPct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

const GUEST: Record<Locale, string> = { en: "Guest", tr: "Misafir" };

/** Display name for a guest without nickname: "Guest 4F2A" / "Misafir 4F2A". */
export function guestName(id: string, locale: Locale = "en"): string {
  return `${GUEST[locale]} ${id.slice(-4).toUpperCase()}`;
}
