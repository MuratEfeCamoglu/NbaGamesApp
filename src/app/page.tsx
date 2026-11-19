import type { Metadata } from "next";
import { HomeView } from "./home-view";

export const metadata: Metadata = {
  title: { absolute: "NBA Games — Know the game? Prove it." },
};

export default function HomePage() {
  return (
    <section className="screen" aria-labelledby="home-title">
      <div className="container">
        <HomeView />
      </div>
    </section>
  );
}
