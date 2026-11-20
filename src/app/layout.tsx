import type { Metadata, Viewport } from "next";
import { Barlow, Big_Shoulders, Doto, Kalam } from "next/font/google";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/layout/top-nav";
import { IconSprite } from "@/components/ui/icon";
import { ToastProvider } from "@/components/ui/toast";
import { getMessages } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { getLocale } from "@/lib/i18n/server";
import { MeProvider } from "@/lib/me-context";
import "./globals.css";

// latin-ext carries Turkish ğ ş ı İ (F18). Doto only ever renders scoreboard digits, so latin is enough.
const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});
// Variable with the optical-size axis: big headings get the condensed "Display" cut automatically.
const bigShoulders = Big_Shoulders({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
});
const kalam = Kalam({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-kalam",
  display: "swap",
});
const doto = Doto({
  subsets: ["latin"],
  weight: "variable",
  axes: ["ROND"],
  variable: "--font-doto",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getMessages(await getLocale());
  return {
    title: { default: "NBA Games", template: "%s · NBA Games" },
    description: t.meta.siteDescription,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e2b26",
};

// The locale comes from the ng_lang cookie / Accept-Language (F18), so every page renders per request.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${barlow.variable} ${bigShoulders.variable} ${kalam.variable} ${doto.variable}`}
    >
      <body data-immersive="false">
        <IconSprite />
        <LocaleProvider locale={locale}>
          <MeProvider>
            <ToastProvider>
              <TopNav />
              <main id="main">{children}</main>
              <Footer locale={locale} />
              <BottomTabBar />
            </ToastProvider>
          </MeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
