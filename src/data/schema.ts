// NBA veri seti şemaları — src/data/seed/*.json bu şemalara uymak zorundadır.
// Seed dosyaları NBA API'den `npm run data:sync` ile üretilir (ISKELET §3.6).
// Bu dosya hem sunucu hem betik (validate-data) tarafından kullanılır; server-only değildir
// çünkü yalnızca şema/tip içerir, veri içermez.
import { z } from "zod";

/** Season label as used by stats.nba.com, e.g. "2015-16". */
export const seasonSchema = z.string().regex(/^\d{4}-\d{2}$/, "season must look like 2015-16");
/** Team abbreviation, uppercase, e.g. "LAL", historical ones allowed ("SEA"). */
export const teamIdSchema = z.string().regex(/^[A-Z]{3}$/);
/** NBA PERSON_ID as string. */
export const playerIdSchema = z.string().regex(/^\d+$/);

export const metaSchema = z.object({
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().min(1),
  endpoints: z.array(z.string().min(1)).min(1),
});

export const teamSchema = z.object({
  id: teamIdSchema,
  name: z.string().min(1),
  city: z.string().min(1),
  /** Current franchise abbreviation (e.g. SEA → OKC). Equals id for current teams. */
  franchiseId: teamIdSchema,
  conference: z.enum(["East", "West"]),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const playerSchema = z.object({
  id: playerIdSchema,
  name: z.string().min(1),
  /** Normalised position label: "G", "F", "C", "G-F", "F-C", "PG", "SG", "SF", "PF" … */
  position: z.string(),
  fameTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  allStarCount: z.number().int().min(0),
  /** On an NBA roster in the snapshot's current season → era "current"; otherwise "retired". */
  active: z.boolean(),
  /** NBA CDN headshot id (= PERSON_ID); null if unknown. */
  headshotId: z.string().nullable(),
});

export const rosterEntrySchema = z.object({
  playerId: playerIdSchema,
  teamId: teamIdSchema,
  season: seasonSchema,
});

export const startingFiveSchema = z.object({
  id: z.string().min(1),
  teamId: teamIdSchema,
  season: seasonSchema,
  /**
   * Exactly 5 distinct players. 2007-08+: the five-man unit with the most minutes that season
   * (leaguedashlineups). 1996-97…2006-07: opening-night starters (boxscoretraditionalv3, minutes 0).
   */
  playerIds: z
    .array(playerIdSchema)
    .length(5)
    .refine((ids) => new Set(ids).size === 5, "starting five must have 5 distinct players"),
  minutes: z.number().min(0),
  source: z.string().min(1),
});

export const careerStintSchema = z.object({
  playerId: playerIdSchema,
  teamId: teamIdSchema,
  fromSeason: seasonSchema,
  toSeason: seasonSchema,
  /** 1-based chronological order within the player's career. */
  order: z.number().int().min(1),
});

export const careerStatsSchema = z.object({
  playerId: playerIdSchema,
  games: z.number().int().min(1),
  seasons: z.number().int().min(1),
  ppg: z.number().min(0),
  rpg: z.number().min(0),
  apg: z.number().min(0),
  spg: z.number().min(0),
  bpg: z.number().min(0),
  /** 0–100 (percentage, one decimal). */
  fgPct: z.number().min(0).max(100),
  source: z.string().min(1),
});

export const boxScoreLineSchema = z
  .object({
    id: z.string().min(1),
    playerId: playerIdSchema,
    gameId: z.string().min(1),
    gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    season: seasonSchema,
    teamId: teamIdSchema,
    opponentId: teamIdSchema,
    teamScore: z.number().int().min(0),
    opponentScore: z.number().int().min(0),
    min: z.number().int().min(0),
    pts: z.number().int().min(0),
    reb: z.number().int().min(0),
    ast: z.number().int().min(0),
    stl: z.number().int().min(0),
    blk: z.number().int().min(0),
    fgm: z.number().int().min(0),
    fga: z.number().int().min(0),
    tpm: z.number().int().min(0),
    tpa: z.number().int().min(0),
    source: z.string().min(1),
  })
  .refine((l) => l.fgm <= l.fga && l.tpm <= l.tpa && l.tpm <= l.fgm, "made shots cannot exceed attempts");

export const statLeaderboardSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    statLabel: z.string().min(1),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rows: z
      .array(z.object({ rank: z.number().int().min(1).max(10), playerId: playerIdSchema, value: z.number() }))
      .length(10),
    source: z.string().min(1),
    /**
     * "all-time" = official all-time leaders (alltimeleadersgrids);
     * "active" = career leaders among currently active players, computed by the sync
     * from playercareerstats totals (used by Top 10 in the Current era).
     */
    scope: z.enum(["all-time", "active"]).default("all-time"),
  })
  .refine(
    (lb) => lb.rows.every((r, i) => i === 0 || (lb.rows[i - 1]?.value ?? Infinity) >= r.value),
    "leaderboard rows must be sorted by value desc",
  );

const file = <T extends z.ZodType>(item: T) => z.object({ meta: metaSchema, items: z.array(item) });

export const seedFileSchemas = {
  "teams.json": file(teamSchema),
  "players.json": file(playerSchema),
  "rosters.json": file(rosterEntrySchema),
  "starting-fives.json": file(startingFiveSchema),
  "career-stints.json": file(careerStintSchema),
  "career-stats.json": file(careerStatsSchema),
  "box-scores.json": file(boxScoreLineSchema),
  "leaderboards.json": file(statLeaderboardSchema),
} as const;

export type SeedFileName = keyof typeof seedFileSchemas;

/** Minimum record counts (ISKELET §2.2 acceptance criteria). */
export const seedMinimums: Record<SeedFileName, number> = {
  "teams.json": 30,
  "players.json": 150,
  "rosters.json": 1000,
  "starting-fives.json": 40,
  "career-stints.json": 150,
  "career-stats.json": 120,
  "box-scores.json": 40,
  "leaderboards.json": 8,
};

export type Meta = z.infer<typeof metaSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Player = z.infer<typeof playerSchema>;
export type RosterEntry = z.infer<typeof rosterEntrySchema>;
export type StartingFive = z.infer<typeof startingFiveSchema>;
export type CareerStint = z.infer<typeof careerStintSchema>;
export type CareerStats = z.infer<typeof careerStatsSchema>;
export type BoxScoreLine = z.infer<typeof boxScoreLineSchema>;
export type StatLeaderboard = z.infer<typeof statLeaderboardSchema>;
