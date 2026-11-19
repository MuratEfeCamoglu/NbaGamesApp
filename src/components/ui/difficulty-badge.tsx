import type { Difficulty } from "@/games/core/types";
import { DIFFICULTY_LABEL } from "@/lib/modes";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="diff-badge" data-component="DifficultyBadge" data-variant={difficulty}>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
