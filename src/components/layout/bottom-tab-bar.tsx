"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/provider";
import { isActive, NAV_ITEMS, tabLabel } from "./nav-items";

/** Mobile (<768 px) navigation; slides away while a game is being played (body[data-immersive]). */
export function BottomTabBar() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="bottom-tab-bar" data-component="BottomTabBar" aria-label={t.nav.mainLabel}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          className="bottom-tab-bar__item"
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          <Icon name={item.icon} size="lg" />
          {tabLabel(t, item.key)}
        </Link>
      ))}
    </nav>
  );
}
