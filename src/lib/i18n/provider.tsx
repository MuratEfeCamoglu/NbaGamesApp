"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./locales";
import type { Messages } from "./types";

// Shared context and hooks. Deliberately imports no dictionary: the root layout renders exactly
// one of ./providers/en or ./providers/tr, so a visitor's browser loads only their language.

export interface I18nValue {
  locale: Locale;
  t: Messages;
}

export const I18nContext = createContext<I18nValue | null>(null);

// No English fallback in production (it would ship the dictionary to every page). Isolated
// component tests register one in src/test/setup.ts.
let fallback: I18nValue | null = null;

/** Tests only: the value used when a component renders outside a locale provider. */
export function setI18nFallback(value: I18nValue | null): void {
  fallback = value;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext) ?? fallback;
  if (!value) throw new Error("useI18n: render inside the root layout's locale provider");
  return value;
}

export function useT(): Messages {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
