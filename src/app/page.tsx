import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { HomeView } from "./home-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: { absolute: t.meta.homeTitle } };
}

export default function HomePage() {
  return (
    <section className="screen" aria-labelledby="home-title">
      <div className="container">
        <HomeView />
      </div>
    </section>
  );
}
