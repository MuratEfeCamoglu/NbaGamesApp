import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAME_MODES } from "@/games/core/types";
import { GameFlow } from "@/components/game/game-flow";
import { isGameModeSlug, MODES } from "@/lib/modes";

interface Props {
  params: Promise<{ mode: string }>;
}

export function generateStaticParams() {
  return GAME_MODES.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params;
  if (!isGameModeSlug(mode)) return { title: "Not found" };
  return { title: MODES[mode].title, description: MODES[mode].introDesc };
}

export default async function GameDetailPage({ params }: Props) {
  const { mode } = await params;
  if (!isGameModeSlug(mode)) notFound();
  return (
    <section className="screen" aria-labelledby="game-title" data-mode-theme={mode}>
      <div className="container">
        <GameFlow mode={mode} />
      </div>
    </section>
  );
}
