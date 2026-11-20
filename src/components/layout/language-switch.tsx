"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { storeLocaleCookie, type Locale } from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/provider";

const SHORT: Record<Locale, string> = { en: "EN", tr: "TR" };
// TR first: the switch reads "TR | EN" in both languages.
const ORDER: readonly Locale[] = ["tr", "en"];

/**
 * TR | EN language switch (ISKELET F18). Not in design.html: built from the Tabs pill language.
 * Stores the choice in the ng_lang cookie and re-renders the server tree with router.refresh(),
 * so page titles, <html lang> and every component switch together.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    storeLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={["lang-switch", className ?? ""].filter(Boolean).join(" ")}
      data-component="LanguageSwitch"
      role="group"
      aria-label={t.language.label}
      aria-busy={pending || undefined}
    >
      {ORDER.map((l) => (
        <button
          key={l}
          type="button"
          className="lang-switch__option"
          lang={l}
          aria-pressed={l === locale}
          aria-label={t.language.names[l]}
          onClick={() => choose(l)}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
