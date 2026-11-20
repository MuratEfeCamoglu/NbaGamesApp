"use client";

import { useId } from "react";
import { ERAS, type Era, type EraFilter } from "@/games/core/types";
import { Icon } from "@/components/ui/icon";
import { ERA_INFO, eraBadgeVariant, MIXED_ERA } from "@/lib/era";
import { useT } from "@/lib/i18n/provider";

interface EraSwitchProps {
  value: Era;
  onChange: (era: Era) => void;
  /** Visible group label (fieldset legend). */
  legend?: string;
  className?: string;
}

/**
 * Current | Retired segmented control (ISKELET F16). Not in design.html: built from the Tabs /
 * DifficultySelector language. Native radios, so arrow keys move the choice and Tab enters and
 * leaves the group as one stop; the label is the 44 px+ hit area.
 */
export function EraSwitch({ value, onChange, legend, className }: EraSwitchProps) {
  const id = useId();
  const t = useT();
  return (
    <fieldset
      className={["era-switch", className ?? ""].filter(Boolean).join(" ")}
      data-component="EraSwitch"
      data-value={value}
    >
      <legend className="t-label era-switch__legend">{legend ?? t.era.legend}</legend>
      <div className="era-switch__track">
        {ERAS.map((era) => {
          const info = { ...ERA_INFO[era], ...t.era[era] };
          return (
            <label key={era} className="era-option" data-era={era}>
              <input
                type="radio"
                name={id}
                value={era}
                checked={value === era}
                onChange={() => onChange(era)}
                aria-labelledby={`${id}-${era}`}
                aria-describedby={`${id}-${era}-desc`}
              />
              <span className="era-option__icon" aria-hidden="true">
                <Icon name={info.icon} size="sm" />
              </span>
              <span className="era-option__label" id={`${id}-${era}`}>
                {info.label}
                {era === "current" ? (
                  <span className="era-option__live" aria-hidden="true" />
                ) : null}
              </span>
              <span className="era-option__desc" id={`${id}-${era}-desc`}>
                {info.tagline}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A session's era: Current / Retired, or "Mixed" for Daily and sessions without an era. */
export function EraBadge({ era, className }: { era: EraFilter | undefined; className?: string }) {
  // Sessions recorded before the era split may not carry one yet.
  const t = useT();
  if (!era) return null;
  const variant = eraBadgeVariant(era);
  const { icon } = variant === "mixed" ? MIXED_ERA : ERA_INFO[variant];
  const label = variant === "mixed" ? t.era.mixed : t.era[variant].label;
  return (
    <span
      className={["badge era-badge", className ?? ""].filter(Boolean).join(" ")}
      data-component="EraBadge"
      data-variant={variant}
    >
      <Icon name={icon} size="sm" />
      <span className="sr-only">{t.era.badgeSr}</span>
      {label}
    </span>
  );
}
