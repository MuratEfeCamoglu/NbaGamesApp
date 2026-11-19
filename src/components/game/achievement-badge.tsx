import { Icon, type IconName } from "@/components/ui/icon";

/** Medal icon per achievement id (ISKELET §3.4); locked badges always show the lock. */
const ACHIEVEMENT_ICONS: Record<string, IconName> = {
  "first-game": "play",
  "perfect-10": "target",
  "streak-5": "flame",
  "streak-10": "zap",
  "expert-win": "award",
  "all-modes": "grid",
  "daily-3": "calendar-check",
  "points-10k": "star",
};

export type AchievementState = "earned" | "locked" | "unlocking";

export function AchievementBadge({
  id,
  name,
  description,
  state,
}: {
  id: string;
  name: string;
  description?: string;
  state: AchievementState;
}) {
  const icon: IconName = state === "locked" ? "lock" : (ACHIEVEMENT_ICONS[id] ?? "medal");
  return (
    <div
      className="achievement"
      data-component="AchievementBadge"
      data-state={state}
      data-achievement={id}
    >
      <span className="achievement__medal">
        <Icon name={icon} size="lg" />
      </span>
      <span className="achievement__name">{name}</span>
      {description ? <span className="achievement__desc">{description}</span> : null}
      {state === "locked" ? <span className="sr-only">Locked</span> : null}
    </div>
  );
}
