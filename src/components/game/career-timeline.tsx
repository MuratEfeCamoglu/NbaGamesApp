"use client";

import { useT } from "@/lib/i18n/provider";
import { TeamBadge } from "./team-badge";

export function CareerTimeline({ stints }: { stints: { teamId: string; years: string | null }[] }) {
  const t = useT();
  return (
    <ol
      className="career-timeline"
      data-component="CareerTimeline"
      aria-label={t.question.careerStops}
    >
      {stints.map((s, i) => (
        <li className="career-timeline__stop" key={`${s.teamId}-${i}`}>
          <TeamBadge teamId={s.teamId} />
          {s.years ? <span className="career-timeline__years">{s.years}</span> : null}
        </li>
      ))}
    </ol>
  );
}
