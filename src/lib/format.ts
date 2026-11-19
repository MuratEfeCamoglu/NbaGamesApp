// Display formatting shared by components. Pure functions (unit-tested in format.test.ts).

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** One decimal, for per-game averages and FG%. */
export function fmtDecimal(n: number): string {
  return n.toFixed(1);
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

/** "Jan 22, 2006" from "2006-01-22" (UTC, so the calendar date never shifts). */
export function fmtGameDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Thursday, Nov 19" from "2026-11-19". */
export function fmtDailyDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** History list: "Today" / "Yesterday" / "Nov 16" relative to `now`. */
export function fmtRelativeDay(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function accuracyPct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/** Display name for a guest without nickname: "Guest 4F2A". */
export function guestName(id: string): string {
  return `Guest ${id.slice(-4).toUpperCase()}`;
}
