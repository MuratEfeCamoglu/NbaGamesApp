import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { DailyView } from "./daily-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.dailyTitle, description: t.meta.dailyDescription };
}

export default function DailyPage() {
  return (
    <section className="screen" aria-labelledby="daily-title">
      <div className="container">
        <DailyView />
      </div>
    </section>
  );
}
