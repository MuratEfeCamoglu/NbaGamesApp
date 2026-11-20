// NBA CDN headshots: one URL rule and one on/off switch for every photo in the UI.

// 260x190 (~17 KB) is plenty for every avatar and cover size; 1040x760 is ~200 KB.
const HEADSHOT_BASE = "https://cdn.nba.com/headshots/nba/latest/260x190";
export const HEADSHOT_WIDTH = 260;
export const HEADSHOT_HEIGHT = 190;

export function headshotUrl(headshotId: string): string {
  return `${HEADSHOT_BASE}/${headshotId}.png`;
}

/** NEXT_PUBLIC_REMOTE_MEDIA=true allows NBA CDN photos; anything else → initials fallback. */
export function remoteMediaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REMOTE_MEDIA === "true";
}
