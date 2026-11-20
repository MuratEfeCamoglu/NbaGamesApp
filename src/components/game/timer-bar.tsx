"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/provider";

/** Design: "TimerBar (normal → last 5 s warning colour, pulse)". */
export const TIMER_WARNING_SEC = 5;
const TICK_MS = 100;

interface TimerBarProps {
  durationSec: number;
  /** false = paused/frozen (after answering). Remount (key) to restart for the next question. */
  running: boolean;
  onExpire: () => void;
}

/** Visual countdown only — the server measures the real time (CLAUDE.md). */
export function TimerBar({ durationSec, running, onExpire }: TimerBarProps) {
  const total = durationSec * 1000;
  const [leftMs, setLeftMs] = useState(total);
  const leftRef = useRef(total);
  const t = useT();
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!running || leftRef.current <= 0) return;
    const end = Date.now() + leftRef.current;
    const id = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      leftRef.current = left;
      setLeftMs(left);
      if (left <= 0) {
        clearInterval(id);
        onExpireRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const secs = Math.ceil(leftMs / 1000);
  const state = leftMs <= 0 ? "expired" : secs <= TIMER_WARNING_SEC ? "warning" : "normal";

  return (
    <div
      className="timer-bar"
      data-component="TimerBar"
      data-state={state}
      role="timer"
      aria-label={t.hud.timeLeft(secs)}
      style={{ "--timer-progress": String(total > 0 ? leftMs / total : 0) } as CSSProperties}
    >
      <div className="timer-bar__track">
        <div className="timer-bar__fill" />
      </div>
      <span className="timer-bar__label" aria-hidden="true">
        <Icon name="clock" size="sm" />
        <span>{secs}</span>
      </span>
    </div>
  );
}
