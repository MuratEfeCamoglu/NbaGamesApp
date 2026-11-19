import { TeamBadge } from "./team-badge";

export function CareerTimeline({ stints }: { stints: { teamId: string; years: string | null }[] }) {
  return (
    <ol
      className="career-timeline"
      data-component="CareerTimeline"
      aria-label="Career stops in order"
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
