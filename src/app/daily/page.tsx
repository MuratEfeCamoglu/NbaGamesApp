import type { Metadata } from "next";
import { DailyView } from "./daily-view";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description: "Five mixed questions, the same for everyone. One attempt per day.",
};

export default function DailyPage() {
  return (
    <section className="screen" aria-labelledby="daily-title">
      <div className="container">
        <DailyView />
      </div>
    </section>
  );
}
