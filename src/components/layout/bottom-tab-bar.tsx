"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Mobile (<768 px) navigation; slides away while a game is being played (body[data-immersive]). */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="bottom-tab-bar" data-component="BottomTabBar" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          className="bottom-tab-bar__item"
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          <Icon name={item.icon} size="lg" />
          {item.tabLabel}
        </Link>
      ))}
    </nav>
  );
}
