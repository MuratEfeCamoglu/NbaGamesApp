"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { Icon } from "@/components/ui/icon";
import { fmtNumber } from "@/lib/format";
import { meData, useMe } from "@/lib/me-context";
import { isActive, NAV_ITEMS } from "./nav-items";

export function TopNav() {
  const pathname = usePathname();
  const me = meData(useMe().state);
  const displayName = me?.nickname ?? "Guest";

  return (
    <header className="top-nav" data-component="TopNav">
      <div className="top-nav__inner container">
        <Link className="logo" href="/" aria-label="NBA Games home">
          <Icon name="ball" className="logo__mark" />
          <span>
            NBA <span className="logo__accent">Games</span>
          </span>
        </Link>
        <nav className="top-nav__links" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              className="top-nav__link"
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="top-nav__user">
          {me ? (
            <span
              className="points-pill"
              aria-label={`Your total points: ${fmtNumber(me.totalPoints)}`}
            >
              <Icon name="star" size="sm" />
              <span className="num">{fmtNumber(me.totalPoints)}</span>
            </span>
          ) : null}
          <Link className="user-chip" href="/profile" aria-label="Your profile">
            <PlayerAvatar name={displayName} size="sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}
