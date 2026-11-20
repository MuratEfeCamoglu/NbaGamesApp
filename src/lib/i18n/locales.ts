// Locale ids and resolution (ISKELET F18). Pure: no Next or React imports, so the server helper,
// the client switch and the tests share one rule.

export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "ng_lang";
/** One year, like the guest cookie. */
export const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** BCP 47 tag for Intl (numbers, dates, plural rules). */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", tr: "tr-TR" };

export function parseLocale(value: unknown): Locale | null {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

/**
 * Locale from an Accept-Language header: the first supported language by q-value
 * ("tr-TR,tr;q=0.9,en;q=0.8" → tr). Unknown or missing → null.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0] ?? "", weight, i };
    })
    .filter((r) => r.lang && Number.isFinite(r.weight) && r.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const r of ranked) {
    const locale = parseLocale(r.lang);
    if (locale) return locale;
  }
  return null;
}

/** Cookie choice → browser language → English. */
export function resolveLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return (
    parseLocale(input.cookie) ?? localeFromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE
  );
}

/** `document.cookie` value that stores the choice for a year on every path. */
export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** Browser only: remember the choice for the next requests (read by getLocale on the server). */
export function storeLocaleCookie(locale: Locale): void {
  document.cookie = localeCookie(locale);
}
