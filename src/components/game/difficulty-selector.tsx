"use client";

import { DIFFICULTIES, type Difficulty, type GameMode } from "@/games/core/types";
import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { useT } from "@/lib/i18n/provider";
import { difficultyMeta } from "@/lib/modes";

export function DifficultySelector({
  mode,
  value,
  onChange,
}: {
  mode: GameMode;
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  const t = useT();
  return (
    <fieldset className="difficulty-selector" data-component="DifficultySelector">
      <legend className="t-label difficulty-selector__legend">{t.difficulty.legend}</legend>
      {DIFFICULTIES.map((d) => (
        <label key={d} className="difficulty-option" data-variant={d}>
          <input
            type="radio"
            name="difficulty"
            value={d}
            checked={value === d}
            onChange={() => onChange(d)}
          />
          <DifficultyBadge difficulty={d} />
          <span className="difficulty-option__meta">{difficultyMeta(mode, d, t)}</span>
        </label>
      ))}
    </fieldset>
  );
}
