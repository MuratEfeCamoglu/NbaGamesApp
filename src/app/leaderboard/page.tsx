import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";
import { LeaderboardView } from "./leaderboard-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.leaderboardTitle, description: t.meta.leaderboardDescription };
}

export default async function LeaderboardPage() {
  const { t } = await getT();
  return (
    <section className="screen" aria-labelledby="lb-title">
      <div className="container">
        <PageHeader
          titleId="lb-title"
          eyebrow={t.leaderboard.eyebrow}
          title={t.meta.leaderboardTitle}
        />
        <LeaderboardView />
      </div>
    </section>
  );
}
