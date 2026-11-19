import type { IconName } from "@/components/ui/icon";

export interface NavItem {
  href: string;
  label: string;
  /** BottomTabBar uses a shorter label for Leaderboard ("Ranks"). */
  tabLabel: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", tabLabel: "Home", icon: "home" },
  { href: "/games", label: "Games", tabLabel: "Games", icon: "gamepad" },
  { href: "/daily", label: "Daily", tabLabel: "Daily", icon: "calendar" },
  { href: "/leaderboard", label: "Leaderboard", tabLabel: "Ranks", icon: "trophy" },
  { href: "/profile", label: "Profile", tabLabel: "Profile", icon: "user" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
