"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { Locale } from "./locales";

// Each language's provider (and dictionary) is its own lazy chunk, so a visitor's browser loads
// only the dictionary of the language the server rendered (first-load JS budget, ISKELET §5).
const EnI18nProvider = dynamic(() => import("./providers/en").then((m) => m.EnI18nProvider));
const TrI18nProvider = dynamic(() => import("./providers/tr").then((m) => m.TrI18nProvider));

/** Root layout entry: picks the provider for the server-resolved locale. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const Provider = locale === "tr" ? TrI18nProvider : EnI18nProvider;
  return <Provider>{children}</Provider>;
}
