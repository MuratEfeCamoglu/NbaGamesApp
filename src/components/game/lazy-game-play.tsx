"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// The play screen (HUD, question cards, answers, search, result) is not needed until Start, so
// it stays out of the first load of /games/[mode] and /daily (first-load JS budget, ISKELET §5).
// usePrefetchGamePlay() fetches it right after the intro renders, so Start is still instant.
const loadGamePlay = () => import("./game-play").then((m) => m.GamePlay);

export const LazyGamePlay = dynamic(loadGamePlay, {
  loading: () => (
    <div className="block" aria-busy="true">
      <Skeleton shape="block" />
    </div>
  ),
});

export function usePrefetchGamePlay(): void {
  useEffect(() => {
    void loadGamePlay();
  }, []);
}
