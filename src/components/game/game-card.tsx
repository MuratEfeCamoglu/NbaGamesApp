"use client";

import type { Era } from "@/games/core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spotlight } from "@/components/ui/spotlight";
import { DEFAULT_ERA, ERA_INFO, gameHref } from "@/lib/era";
import { useT } from "@/lib/i18n/provider";
import type { ModeInfo } from "@/lib/modes";
import { GameCover } from "./game-cover";

interface GameCardProps {
  mode: ModeInfo;
  /** Home "Featured games" uses the shorter description and no rule list. */
  variant?: "full" | "featured";
  headingLevel?: "h2" | "h3";
  /** Era the Play link opens (F16); also picks the era tag, flavour line and cover star (F17). */
  era?: Era;
}

export function GameCard({
  mode,
  variant = "full",
  headingLevel: Heading = "h2",
  era = DEFAULT_ERA,
}: GameCardProps) {
  const t = useT();
  const copy = t.modes[mode.slug];
  const eraLabel = t.era[era].label;
  return (
    <article
      className="card game-card"
      data-component="GameCard"
      data-variant="interactive"
      data-mode={mode.slug}
      data-era={era}
    >
      <Spotlight />
      <div className="game-card__visual">
        <span className="game-card__orb" aria-hidden="true" />
        <span className="game-card__index">{mode.n}</span>
        <span className="game-card__era-tag" aria-hidden="true">
          {eraLabel}
        </span>
        <span className="game-card__glyph">
          <Icon name={mode.icon} size="lg" />
        </span>
        <GameCover mode={mode.slug} era={era} />
      </div>
      <div className="game-card__body">
        <Heading className="game-card__title" lang="en">
          {mode.title}
        </Heading>
        <p className="game-card__desc">
          {variant === "featured" ? copy.featuredDesc : copy.cardDesc}
        </p>
        <p className="game-card__era">
          <Icon name={ERA_INFO[era].icon} size="sm" />
          <span>
            <span className="sr-only">{t.era.srPrefix(eraLabel)}</span>
            {copy.eraDesc[era]}
          </span>
        </p>
        {variant === "full" ? (
          <ul className="game-card__rules">
            {copy.rules.map((r) => (
              <li key={r}>
                <Icon name="check" size="sm" />
                {r}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="game-card__foot">
          <Badge variant="outline">{copy.lengthLabel}</Badge>
          <Button
            href={gameHref(mode.slug, era)}
            size="sm"
            icon="play"
            aria-label={t.gameCard.playLabel(mode.title)}
          >
            {t.gameCard.play}
          </Button>
        </div>
      </div>
    </article>
  );
}
