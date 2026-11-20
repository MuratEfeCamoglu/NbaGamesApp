import "server-only";
import { cookies, headers } from "next/headers";
import { getMessages, type Messages } from "./index";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";

/** Request locale for Server Components and metadata: ng_lang cookie → Accept-Language → en. */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}

export async function getT(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: getMessages(locale) };
}
