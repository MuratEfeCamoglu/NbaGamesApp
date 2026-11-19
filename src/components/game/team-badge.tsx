import { teamKey } from "@/lib/format";

/** Team-colour pill with the 3-letter code (no official logos — ISKELET §2.4). */
export function TeamBadge({
  teamId,
  size,
  title,
}: {
  teamId: string;
  size?: "lg";
  title?: string;
}) {
  return (
    <span
      className="team-badge"
      data-component="TeamBadge"
      data-team={teamKey(teamId)}
      data-size={size}
      title={title}
    >
      {teamId.toUpperCase()}
    </span>
  );
}
