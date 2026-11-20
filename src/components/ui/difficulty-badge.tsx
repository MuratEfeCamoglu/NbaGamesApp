"use client";

import type { Difficulty } from "@/games/core/types";
import { useT } from "@/lib/i18n/provider";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const t = useT();
  return (
    <span className="diff-badge" data-component="DifficultyBadge" data-variant={difficulty}>
      {t.difficulty.label[difficulty]}
    </span>
  );
}
