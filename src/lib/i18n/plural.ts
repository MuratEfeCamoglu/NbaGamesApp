import { INTL_LOCALE, type Locale } from "./locales";

const rules = new Map<Locale, Intl.PluralRules>();

/** CLDR plural pick ("1 season" / "2 seasons"); Turkish nouns after a number stay singular. */
export function plural(locale: Locale, n: number, forms: { one: string; other: string }): string {
  let r = rules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(INTL_LOCALE[locale]);
    rules.set(locale, r);
  }
  return r.select(n) === "one" ? forms.one : forms.other;
}
