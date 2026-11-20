import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-oswald",
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
  themeColor: "#0b0b0d",
};

// The locale comes from the ng_lang cookie / Accept-Language (F18), so every page renders per request.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${oswald.variable}`}>
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
