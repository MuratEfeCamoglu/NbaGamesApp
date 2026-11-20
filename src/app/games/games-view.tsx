"use client";

import { EraSwitch } from "@/components/game/era-switch";
import { GameCard } from "@/components/game/game-card";
import { PageHeader } from "@/components/layout/page-header";
import { useT } from "@/lib/i18n/provider";
import { MODE_LIST } from "@/lib/modes";
import { useEraPreference } from "@/lib/use-era-preference";

/** /games: the era switch on top decides which side every card's Play link opens (F16). */
export function GamesView({ description }: { description: string }) {
  const [era, setEra] = useEraPreference();
  const t = useT();
  return (
    <div className="era-scope era-scope--page" data-era={era}>
      <PageHeader
        titleId="games-title"
        eyebrow={t.games.eyebrow}
        title={t.meta.gamesTitle}
        description={description}
      />
      <div className="block--tight block">
        <EraSwitch legend={t.era.pick} value={era} onChange={setEra} />
      </div>
      <div className="block">
        <div className="grid--3 grid">
          {MODE_LIST.map((m) => (
            <GameCard key={m.slug} mode={m} era={era} />
          ))}
        </div>
      </div>
    </div>
  );
}
