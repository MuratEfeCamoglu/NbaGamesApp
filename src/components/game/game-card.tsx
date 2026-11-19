import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spotlight } from "@/components/ui/spotlight";
import type { ModeInfo } from "@/lib/modes";

interface GameCardProps {
  mode: ModeInfo;
  /** Home "Featured games" uses the shorter description and no rule list. */
  variant?: "full" | "featured";
  headingLevel?: "h2" | "h3";
}

export function GameCard({ mode, variant = "full", headingLevel: Heading = "h2" }: GameCardProps) {
  return (
    <article
      className="card game-card"
      data-component="GameCard"
      data-variant="interactive"
      data-mode={mode.slug}
    >
      <Spotlight />
      <div className="game-card__visual">
        <span className="game-card__orb" aria-hidden="true" />
        <span className="game-card__index">{mode.n}</span>
        <span className="game-card__glyph">
          <Icon name={mode.icon} size="lg" />
        </span>
      </div>
      <div className="game-card__body">
        <Heading className="game-card__title">{mode.title}</Heading>
        <p className="game-card__desc">
          {variant === "featured" ? mode.featuredDesc : mode.cardDesc}
        </p>
        {variant === "full" ? (
          <ul className="game-card__rules">
            {mode.rules.map((r) => (
              <li key={r}>
                <Icon name="check" size="sm" />
                {r}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="game-card__foot">
          <Badge variant="outline">{mode.lengthLabel}</Badge>
          <Button
            href={`/games/${mode.slug}`}
            size="sm"
            icon="play"
            aria-label={`Play ${mode.title}`}
          >
            Play
          </Button>
        </div>
      </div>
    </article>
  );
}
