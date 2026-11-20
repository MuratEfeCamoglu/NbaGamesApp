"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/provider";

/** Design states: 0, 1, 2–4 "hot", 5+ "on fire". */
export const STREAK_FIRE_AT = 5;

export function streakState(n: number): "0" | "1" | "hot" | "fire" {
  if (n >= STREAK_FIRE_AT) return "fire";
  if (n >= 2) return "hot";
  return n === 1 ? "1" : "0";
}

export function StreakMeter({ streak }: { streak: number }) {
  // Replay the bump animation whenever the streak grows (adjust-state-on-prop-change pattern).
  const [prev, setPrev] = useState(streak);
  const [bumpKey, setBumpKey] = useState(0);
  const t = useT();
  if (streak !== prev) {
    setPrev(streak);
    if (streak > prev) setBumpKey((k) => k + 1);
  }

  return (
    <span
      key={bumpKey}
      className="streak-meter"
      data-component="StreakMeter"
      data-state={streakState(streak)}
      data-bump={bumpKey > 0 ? "true" : undefined}
      aria-label={t.hud.streakLabel(streak)}
    >
      <Icon name="flame" size="sm" />
      <span>{streak}</span>
      {streak >= STREAK_FIRE_AT ? (
        <span className="streak-meter__label">{t.hud.onFire}</span>
      ) : null}
    </span>
  );
}
