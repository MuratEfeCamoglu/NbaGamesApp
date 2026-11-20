"use client";

import type { ReactNode } from "react";
import { I18nContext, type I18nValue } from "../provider";
import { tr } from "../tr";

const VALUE: I18nValue = { locale: "tr", t: tr };

/** Turkish UI: the only module that puts the Turkish dictionary into the client bundle. */
export function TrI18nProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={VALUE}>{children}</I18nContext.Provider>;
}
