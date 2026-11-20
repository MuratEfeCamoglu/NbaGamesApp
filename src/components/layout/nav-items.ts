import type { IconName } from "@/components/ui/icon";
import type { Messages } from "@/lib/i18n/types";

export type NavKey = "home" | "games" | "daily" | "leaderboard" | "profile";

export interface NavItem {
  key: NavKey;
  href: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/", icon: "home" },
  { key: "games", href: "/games", icon: "gamepad" },
  { key: "daily", href: "/daily", icon: "calendar" },
  { key: "leaderboard", href: "/leaderboard", icon: "trophy" },
  { key: "profile", href: "/profile", icon: "user" },
];

export function navLabel(t: Messages, key: NavKey): string {
  return t.nav[key];
}

/** BottomTabBar uses a shorter label for Leaderboard ("Ranks"). */
export function tabLabel(t: Messages, key: NavKey): string {
  return key === "leaderboard" ? t.nav.ranksTab : t.nav[key];
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
