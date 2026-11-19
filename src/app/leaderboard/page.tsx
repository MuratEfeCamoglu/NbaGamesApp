import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { LeaderboardView } from "./leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top 100 players: all time, this week and today.",
};

export default function LeaderboardPage() {
  return (
    <section className="screen" aria-labelledby="lb-title">
      <div className="container">
        <PageHeader titleId="lb-title" eyebrow="Top 100" title="Leaderboard" />
        <LeaderboardView />
      </div>
    </section>
  );
}
