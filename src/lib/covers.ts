// Game cover stars (ISKELET F17): one well-known player per mode and era, shown on every GameCard
// and the game intro. Pure data + URL helpers; components decide how to render the fallback.
import type { Era, GameMode } from "@/games/core/types";

export interface CoverPlayer {
  /** NBA PERSON_ID = headshot id on the NBA CDN. */
  id: string;
  name: string;
}

export const COVER_PLAYERS: Record<GameMode, Record<Era, CoverPlayer>> = {
  "starting-five": {
    current: { id: "201939", name: "Stephen Curry" },
    retired: { id: "893", name: "Michael Jordan" },
  },
  "team-journey": {
    current: { id: "2544", name: "LeBron James" },
    retired: { id: "406", name: "Shaquille O'Neal" },
  },
  "teammate-challenge": {
    current: { id: "1629029", name: "Luka Dončić" },
    retired: { id: "77142", name: "Magic Johnson" },
  },
  "career-stats": {
    current: { id: "203999", name: "Nikola Jokić" },
    retired: { id: "76003", name: "Kareem Abdul-Jabbar" },
  },
  "box-score": {
    current: { id: "203507", name: "Giannis Antetokounmpo" },
    retired: { id: "977", name: "Kobe Bryant" },
  },
  "top-10": {
    current: { id: "201142", name: "Kevin Durant" },
    retired: { id: "1495", name: "Tim Duncan" },
  },
};

export function coverPlayer(mode: GameMode, era: Era): CoverPlayer {
  return COVER_PLAYERS[mode][era];
}
