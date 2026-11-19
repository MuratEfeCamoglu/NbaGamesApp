"use client";

import { useEffect, useRef, useState } from "react";

/** Design demo: 3-2-1, 700 ms per step. */
export const COUNTDOWN_FROM = 3;
export const COUNTDOWN_STEP_MS = 700;

/** "Get ready… 3-2-1" overlay shown while a session starts. */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(COUNTDOWN_FROM);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const id = setTimeout(() => {
      if (n <= 1) onDoneRef.current();
      else setN(n - 1);
    }, COUNTDOWN_STEP_MS);
    return () => clearTimeout(id);
  }, [n]);

  return (
    <div className="countdown" data-component="Countdown" data-state="open" aria-live="assertive">
      <span className="t-label">Get ready…</span>
      <span key={n} className="countdown__num">
        {n}
      </span>
    </div>
  );
}
