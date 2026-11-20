import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { GamesView } from "./games-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.gamesTitle, description: t.meta.gamesDescription };
}

export default async function GamesPage() {
  const { t } = await getT();
  return (
    <section className="screen" aria-labelledby="games-title">
      <div className="container">
        <GamesView description={t.meta.gamesDescription} />
      </div>
    </section>
  );
}
