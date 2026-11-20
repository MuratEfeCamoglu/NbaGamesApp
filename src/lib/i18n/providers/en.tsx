"use client";

import type { ReactNode } from "react";
import { en } from "../en";
import { I18nContext, type I18nValue } from "../provider";

const VALUE: I18nValue = { locale: "en", t: en };

/** English UI: the only module that puts the English dictionary into the client bundle. */
export function EnI18nProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={VALUE}>{children}</I18nContext.Provider>;
}
