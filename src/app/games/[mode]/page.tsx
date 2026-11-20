import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameFlow } from "@/components/game/game-flow";
import { parseEra } from "@/lib/era";
import { getT } from "@/lib/i18n/server";
import { isGameModeSlug, MODES } from "@/lib/modes";

interface Props {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params;
  const { t } = await getT();
  if (!isGameModeSlug(mode)) return { title: t.meta.notFoundTitle };
  return { title: MODES[mode].title, description: t.modes[mode].introDesc };
}

// Reading `?era=` here (not with useSearchParams in the client) renders the requested era
// straight away; it makes the route dynamic, which this per-visitor page is anyway.
export default async function GameDetailPage({ params, searchParams }: Props) {
  const { mode } = await params;
  if (!isGameModeSlug(mode)) notFound();
  const { era } = await searchParams;
  return (
    <section className="screen" aria-labelledby="game-title" data-mode-theme={mode}>
      <div className="container">
        <GameFlow mode={mode} initialEra={parseEra(Array.isArray(era) ? era[0] : era)} />
      </div>
    </section>
  );
}
