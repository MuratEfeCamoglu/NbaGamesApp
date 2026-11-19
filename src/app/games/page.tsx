import type { Metadata } from "next";
import { GameCard } from "@/components/game/game-card";
import { PageHeader } from "@/components/layout/page-header";
import { MODE_LIST } from "@/lib/modes";

export const metadata: Metadata = {
  title: "Games",
  description: "Six ways to test your NBA knowledge. Every mode has four difficulty levels.",
};

export default function GamesPage() {
  return (
    <section className="screen" aria-labelledby="games-title">
      <div className="container">
        <PageHeader
          titleId="games-title"
          eyebrow="Pick a mode"
          title="Games"
          description="Six ways to test your NBA knowledge. Every mode has four difficulty levels."
        />
        <div className="block">
          <div className="grid--3 grid">
            {MODE_LIST.map((m) => (
              <GameCard key={m.slug} mode={m} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
