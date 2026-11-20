// Server/test entry: both dictionaries. Client components must not import this module (it would
// ship English and Turkish to every visitor); they use ./provider, ./helpers and ./types.
import { en } from "./en";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { tr } from "./tr";
import type { Messages } from "./types";

export { en } from "./en";
export { tr } from "./tr";
export type { Messages, ModeCopy } from "./types";
export * from "./locales";
export { plural } from "./plural";
export { achievementCopy } from "./helpers";

const DICTIONARIES: Record<Locale, Messages> = { en, tr };

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return DICTIONARIES[locale];
}
