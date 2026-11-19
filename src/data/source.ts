// NbaDataSource — oyun motorlarının NBA verisine eriştiği TEK arayüz (ISKELET §3.1).
// Motorlar bu arayüze bağlıdır; JSON dosyalarını veya API'yi bilmez.
import type {
  BoxScoreLine,
  CareerStats,
  CareerStint,
  Meta,
  Player,
  RosterEntry,
  StartingFive,
  StatLeaderboard,
  Team,
} from "./schema";

export interface PlayerFilter {
  /** Include only players whose fameTier <= maxFameTier. */
  maxFameTier?: 1 | 2 | 3;
}

export interface NbaDataSource {
  readonly meta: Meta;

  getTeams(): readonly Team[];
  getTeam(id: string): Team | undefined;

  getPlayers(filter?: PlayerFilter): readonly Player[];
  getPlayer(id: string): Player | undefined;
  /**
   * Accent- and case-insensitive substring search on player name over the WHOLE pool
   * (never only answer candidates — see ISKELET §7 autocomplete risk). Max `limit` results.
   */
  searchPlayers(query: string, limit?: number): readonly Player[];

  getStartingFives(): readonly StartingFive[];

  /** Chronological stints (ordered by `order`). Empty if unknown. */
  getCareerStints(playerId: string): readonly CareerStint[];
  /** Players having ≥ minTeams distinct teams in their stints. */
  getPlayersWithStints(minTeams: number): readonly Player[];

  getCareerStats(playerId: string): CareerStats | undefined;
  getPlayersWithCareerStats(): readonly Player[];

  getRosterEntries(playerId: string): readonly RosterEntry[];
  /** Players on the same team in the same season, excluding the player. */
  getTeammates(playerId: string, teamId: string, season: string): readonly Player[];

  getBoxScores(): readonly BoxScoreLine[];
  getLeaderboards(): readonly StatLeaderboard[];
}
