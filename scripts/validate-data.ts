// Validates NBA seed snapshots: Zod schemas, ISKELET §2.2 minimum counts, referential
// integrity and design color tokens. Usage: tsx scripts/validate-data.ts [--dir <path>]
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { seedFileSchemas, seedMinimums, type SeedFileName } from "../src/data/schema";

export interface ValidationResult {
  errors: string[];
  counts: Partial<Record<SeedFileName, number>>;
}

const MAX_ERRORS_PER_CHECK = 20;

/** Lowercase team ids that have a `--color-team-<id>` token in globals.css. */
export function readTeamColorTokens(css: string): Set<string> {
  const ids = new Set<string>();
  for (const m of css.matchAll(/--color-team-([a-z]{3}):/g)) {
    if (m[1]) ids.add(m[1]);
  }
  return ids;
}

export function validateSeedFiles(
  raw: Partial<Record<SeedFileName, unknown>>,
  colorTokens: Set<string>,
): ValidationResult {
  const errors: string[] = [];
  const counts: ValidationResult["counts"] = {};
  const parsed: { [K in SeedFileName]?: { items: unknown[] } } = {};

  for (const name of Object.keys(seedFileSchemas) as SeedFileName[]) {
    const data = raw[name];
    if (data === undefined) {
      errors.push(`${name}: file missing`);
      continue;
    }
    const result = seedFileSchemas[name].safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues.slice(0, MAX_ERRORS_PER_CHECK)) {
        errors.push(`${name}: ${issue.path.join(".")}: ${issue.message}`);
      }
      continue;
    }
    parsed[name] = result.data as { items: unknown[] };
    counts[name] = result.data.items.length;
    if (result.data.items.length < seedMinimums[name]) {
      errors.push(`${name}: ${result.data.items.length} items, minimum is ${seedMinimums[name]}`);
    }
  }

  // Integrity checks need the typed data; skip them if any file failed its schema.
  const teams = seedFileSchemas["teams.json"].safeParse(raw["teams.json"]);
  const players = seedFileSchemas["players.json"].safeParse(raw["players.json"]);
  if (!teams.success || !players.success) return { errors, counts };

  const teamIds = new Set(teams.data.items.map((t) => t.id));
  const playerIds = new Set(players.data.items.map((p) => p.id));
  const add = (check: string, list: string[]) => {
    for (const e of list.slice(0, MAX_ERRORS_PER_CHECK)) errors.push(`${check}: ${e}`);
    if (list.length > MAX_ERRORS_PER_CHECK)
      errors.push(`${check}: … ${list.length - MAX_ERRORS_PER_CHECK} more`);
  };
  const dup = <T>(items: T[], key: (t: T) => string) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of items) {
      const k = key(it);
      if (seen.has(k)) out.push(`duplicate ${k}`);
      seen.add(k);
    }
    return out;
  };

  add(
    "teams.json",
    dup(teams.data.items, (t) => t.id),
  );
  add(
    "players.json",
    dup(players.data.items, (p) => p.id),
  );
  add(
    "teams.json",
    teams.data.items
      .filter((t) => !teamIds.has(t.franchiseId))
      .map((t) => `${t.id}: franchiseId ${t.franchiseId} not a team`),
  );
  add(
    "teams.json",
    teams.data.items
      .filter((t) => !colorTokens.has(t.id.toLowerCase()))
      .map((t) => `${t.id}: no --color-team-${t.id.toLowerCase()} token in src/app/globals.css`),
  );

  const refErrors = (file: string, refs: { player?: string; team?: string; where: string }[]) => {
    const list: string[] = [];
    for (const r of refs) {
      if (r.player !== undefined && !playerIds.has(r.player))
        list.push(`${r.where}: unknown playerId ${r.player}`);
      if (r.team !== undefined && !teamIds.has(r.team))
        list.push(`${r.where}: unknown teamId ${r.team}`);
    }
    add(file, list);
  };

  const rosters = seedFileSchemas["rosters.json"].safeParse(raw["rosters.json"]);
  if (rosters.success) {
    refErrors(
      "rosters.json",
      rosters.data.items.map((r) => ({
        player: r.playerId,
        team: r.teamId,
        where: `${r.playerId}/${r.teamId}/${r.season}`,
      })),
    );
    add(
      "rosters.json",
      dup(rosters.data.items, (r) => `${r.playerId}/${r.teamId}/${r.season}`),
    );
  }

  const fives = seedFileSchemas["starting-fives.json"].safeParse(raw["starting-fives.json"]);
  if (fives.success) {
    refErrors(
      "starting-fives.json",
      fives.data.items.flatMap((f) => [
        { team: f.teamId, where: f.id },
        ...f.playerIds.map((p) => ({ player: p, where: f.id })),
      ]),
    );
    add(
      "starting-fives.json",
      dup(fives.data.items, (f) => f.id),
    );
  }

  const stints = seedFileSchemas["career-stints.json"].safeParse(raw["career-stints.json"]);
  if (stints.success) {
    refErrors(
      "career-stints.json",
      stints.data.items.map((s) => ({
        player: s.playerId,
        team: s.teamId,
        where: `${s.playerId}#${s.order}`,
      })),
    );
    const byPlayer = new Map<string, typeof stints.data.items>();
    for (const s of stints.data.items)
      byPlayer.set(s.playerId, [...(byPlayer.get(s.playerId) ?? []), s]);
    const orderErrors: string[] = [];
    for (const [pid, list] of byPlayer) {
      const sorted = [...list].sort((a, b) => a.order - b.order);
      sorted.forEach((s, i) => {
        if (s.order !== i + 1) orderErrors.push(`${pid}: stint orders are not contiguous from 1`);
        if (s.fromSeason > s.toSeason)
          orderErrors.push(`${pid}#${s.order}: fromSeason after toSeason`);
        const prev = sorted[i - 1];
        if (prev && prev.toSeason > s.fromSeason)
          orderErrors.push(`${pid}#${s.order}: overlaps previous stint`);
      });
    }
    add("career-stints.json", [...new Set(orderErrors)]);
  }

  const stats = seedFileSchemas["career-stats.json"].safeParse(raw["career-stats.json"]);
  if (stats.success) {
    refErrors(
      "career-stats.json",
      stats.data.items.map((s) => ({ player: s.playerId, where: s.playerId })),
    );
    add(
      "career-stats.json",
      dup(stats.data.items, (s) => s.playerId),
    );
  }

  const box = seedFileSchemas["box-scores.json"].safeParse(raw["box-scores.json"]);
  if (box.success) {
    refErrors(
      "box-scores.json",
      box.data.items.flatMap((b) => [
        { player: b.playerId, team: b.teamId, where: b.id },
        { team: b.opponentId, where: b.id },
      ]),
    );
    add(
      "box-scores.json",
      dup(box.data.items, (b) => b.id),
    );
  }

  const lbs = seedFileSchemas["leaderboards.json"].safeParse(raw["leaderboards.json"]);
  if (lbs.success) {
    refErrors(
      "leaderboards.json",
      lbs.data.items.flatMap((lb) =>
        lb.rows.map((r) => ({ player: r.playerId, where: `${lb.id} rank ${r.rank}` })),
      ),
    );
    add(
      "leaderboards.json",
      dup(lbs.data.items, (lb) => lb.id),
    );
  }

  return { errors, counts };
}

function main(): number {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  const dir = path.resolve(dirIdx >= 0 && args[dirIdx + 1] ? args[dirIdx + 1]! : "src/data/seed");
  const cssPath = path.resolve("src/app/globals.css");
  if (!existsSync(cssPath)) {
    console.error(`src/app/globals.css not found (run from the project root)`);
    return 1;
  }
  const tokens = readTeamColorTokens(readFileSync(cssPath, "utf8"));

  const raw: Partial<Record<SeedFileName, unknown>> = {};
  const readErrors: string[] = [];
  for (const name of Object.keys(seedFileSchemas) as SeedFileName[]) {
    const file = path.join(dir, name);
    if (!existsSync(file)) continue;
    try {
      raw[name] = JSON.parse(readFileSync(file, "utf8")) as unknown;
    } catch (err) {
      readErrors.push(`${name}: invalid JSON (${(err as Error).message})`);
    }
  }

  const { errors, counts } = validateSeedFiles(raw, tokens);
  const all = [...readErrors, ...errors];
  if (all.length > 0) {
    console.error(`Seed validation FAILED (${dir}):`);
    for (const e of all) console.error(`  - ${e}`);
    return 1;
  }
  console.log(`Seed validation OK (${dir})`);
  for (const name of Object.keys(seedFileSchemas) as SeedFileName[]) {
    console.log(
      `  ${name.padEnd(22)} ${String(counts[name]).padStart(6)}  (min ${seedMinimums[name]})`,
    );
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
