import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/layout/top-nav";
import { IconSprite } from "@/components/ui/icon";
import { ToastProvider } from "@/components/ui/toast";
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

export const metadata: Metadata = {
  title: { default: "NBA Games", template: "%s · NBA Games" },
  description:
    "Test your NBA knowledge across six trivia games, a daily challenge and a leaderboard.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <body data-immersive="false">
        <IconSprite />
        <MeProvider>
          <ToastProvider>
            <TopNav />
            <main id="main">{children}</main>
            <Footer />
            <BottomTabBar />
          </ToastProvider>
        </MeProvider>
      </body>
    </html>
  );
}
