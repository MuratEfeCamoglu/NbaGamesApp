// Shared sample content for component tests (realistic, shaped like the API contract).
import type { PlayerRef, QuestionContent } from "@/games/core/types";

export const player = (id: string, name: string, teamId = "GSW", position = "G"): PlayerRef => ({
  id,
  name,
  position,
  teamId,
  headshotId: null,
});

export const STARTING_FIVE: Extract<QuestionContent, { mode: "starting-five" }> = {
  mode: "starting-five",
  teamId: "GSW",
  teamName: "Golden State Warriors",
  season: "2015-16",
  players: [
    player("201939", "Stephen Curry", "GSW", "PG"),
    player("202691", "Klay Thompson", "GSW", "SG"),
    player("203084", "Harrison Barnes", "GSW", "SF"),
    player("203110", "Draymond Green", "GSW", "PF"),
  ],
  missingPosition: "C",
};

export const TEAM_JOURNEY: Extract<QuestionContent, { mode: "team-journey" }> = {
  mode: "team-journey",
  stints: [
    { teamId: "DEN", years: "2003–11" },
    { teamId: "NYK", years: "2011–17" },
    { teamId: "OKC", years: "2017–18" },
  ],
  seasons: 19,
  allStarCount: 10,
};

export const TEAMMATES: Extract<QuestionContent, { mode: "teammate-challenge" }> = {
  mode: "teammate-challenge",
  teammates: [
    { player: player("2548", "Dwyane Wade", "MIA"), teamId: "MIA", season: "2012-13" },
    { player: player("202681", "Kyrie Irving", "CLE"), teamId: "CLE", season: "2015-16" },
  ],
};

export const CAREER: Extract<QuestionContent, { mode: "career-stats" }> = {
  mode: "career-stats",
  stats: {
    ppg: 19,
    rpg: 10.8,
    apg: 3,
    spg: 0.7,
    bpg: 2.2,
    fgPct: 50.6,
    games: 1392,
    seasons: 19,
    position: "F-C",
  },
};

export const BOX_SCORE: Extract<QuestionContent, { mode: "box-score" }> = {
  mode: "box-score",
  line: { min: 42, pts: 81, reb: 6, ast: 2, stl: 3, blk: 1, fgm: 28, fga: 46, tpm: 7, tpa: 13 },
  game: {
    date: "2006-01-22",
    teamId: "LAL",
    opponentId: "TOR",
    teamScore: 122,
    opponentScore: 104,
  },
};

export const TOP10: Extract<QuestionContent, { mode: "top-10" }> = {
  mode: "top-10",
  title: "Career 3-Pointers Made",
  statLabel: "3PM",
  listIndex: 1,
  listTotal: 3,
  rows: [
    { rank: 1, value: 4058, player: player("201939", "Stephen Curry") },
    { rank: 2, value: 3123, player: player("201935", "James Harden", "LAC") },
    { rank: 3, value: 2973, player: null },
    { rank: 4, value: 2804, player: player("203081", "Damian Lillard", "MIL") },
    { rank: 5, value: 2697, player: null },
  ],
};
