"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/provider";

/** Design states: 0, 1, 2–4 "hot", 5+ "on fire". */
export const STREAK_FIRE_AT = 5;

export function streakState(n: number): "0" | "1" | "hot" | "fire" {
  if (n >= STREAK_FIRE_AT) return "fire";
  if (n >= 2) return "hot";
  return n === 1 ? "1" : "0";
}

/** One tally group: four strokes and the fifth across them, a little crooked like real chalk. */
const TALLY_STROKES = [
  "M4.5 4.5 L4 19.5",
  "M9.5 4 L9.8 19.8",
  "M14.6 4.6 L14.2 19.4",
  "M19.4 4.2 L19.9 19.6",
  "M1.5 16.5 L22.5 7",
];

/** Tally marks for the current streak (a full group of five once it reaches 5). */
function Tally({ count }: { count: number }) {
  const shown = Math.min(count, TALLY_STROKES.length);
  return (
    <svg className="streak-meter__tally" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TALLY_STROKES.slice(0, shown).map((d, i) => (
        <path key={d} d={d} pathLength={1} data-new={i === shown - 1 ? "true" : undefined} />
      ))}
    </svg>
  );
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
      <Tally count={streak} />
      <span className="streak-meter__count">{streak}</span>
      {streak >= STREAK_FIRE_AT ? (
        <span className="streak-meter__label">{t.hud.onFire}</span>
      ) : null}
    </span>
  );
}
