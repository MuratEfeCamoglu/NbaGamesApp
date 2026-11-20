"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { LogoMark } from "@/components/layout/logo-mark";
import { Icon } from "@/components/ui/icon";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { meData, useMe } from "@/lib/me-context";
import { LanguageSwitch } from "./language-switch";
import { isActive, NAV_ITEMS, navLabel } from "./nav-items";

export function TopNav() {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const me = meData(useMe().state);
  const displayName = me?.nickname ?? t.nav.guest;

  return (
    <header className="top-nav" data-component="TopNav">
      <div className="top-nav__inner container">
        <Link className="logo" href="/" aria-label={t.nav.homeLabel}>
          <LogoMark className="logo__mark" />
          <span>
            NBA <span className="logo__accent">Games</span>
          </span>
        </Link>
        <nav className="top-nav__links" aria-label={t.nav.mainLabel}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              className="top-nav__link"
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {navLabel(t, item.key)}
            </Link>
          ))}
        </nav>
        <div className="top-nav__user">
          {/* Desktop only; below 1024 px the switch sits in the footer (no room in the bar). */}
          <LanguageSwitch className="lang-switch--nav" />
          {me ? (
            <span
              className="points-pill"
              aria-label={t.nav.totalPointsLabel(fmtNumber(me.totalPoints, locale))}
            >
              <Icon name="star" size="sm" />
              <span className="num">{fmtNumber(me.totalPoints, locale)}</span>
            </span>
          ) : null}
          <Link className="user-chip" href="/profile" aria-label={t.nav.profileLabel}>
            <PlayerAvatar name={displayName} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
