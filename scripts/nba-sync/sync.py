"""NBA API -> src/data/seed/*.json snapshot (ISKELET §3.6).

Run with `npm run data:sync` on a developer machine only (stats.nba.com blocks cloud IPs).
Flow: fetch (cached in data-cache/) -> transform (transform.py) -> write to a staging
dir -> `tsx scripts/validate-data.ts --dir <staging>` -> atomic move into src/data/seed.
If the API is unreachable, or a used team code cannot be described (name, conference,
color tokens), nothing in src/data/seed is touched.

Flags:
  --dry-run   stop after the pool has been computed (prints sizes, writes nothing)
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))

import transform as tf  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / "data-cache"
STAGING_DIR = CACHE_DIR / "_staging"
SEED_DIR = ROOT / "src" / "data" / "seed"
GLOBALS_CSS = ROOT / "src" / "app" / "globals.css"

MIN_INTERVAL_S = 0.8  # ≥0.7 s between requests (AGENT.md: never lower)
TIMEOUT_S = 30
RETRIES = 3
BACKOFF_BASE_S = 2.0
# Player pool: games played inside 1996-97…2025-26. ISKELET says ≥100; raised to keep the
# per-player request count (~2 per player) around the ~2,000-request budget.
POOL_MIN_WINDOW_GAMES = 300
MAX_BOX_SCORES_PER_SEASON = 10
# Players in the top LEGENDS_TOP_X of any used all-time list join the pool with full careers
# (brings in pre-1996 legends for the Retired era).
LEGENDS_TOP_X = 50
# Active-leader lists: this many active players per stat (ranked by game-log totals) get an
# official career-totals request; the lists are then ranked on those official totals.
ACTIVE_LEADER_CANDIDATES = 15
UNREACHABLE_MSG = "NBA API'ye erişilemedi — seed dosyaları değiştirilmedi"


class ApiUnreachable(Exception):
    pass


class Fetcher:
    def __init__(self) -> None:
        self.last_request = 0.0
        self.network_requests = 0
        self.cache_hits = 0

    def get(self, endpoint_name: str, factory: Callable[..., Any], **params: Any) -> dict[str, Any]:
        key = json.dumps(params, sort_keys=True)
        digest = hashlib.sha1(key.encode()).hexdigest()[:16]
        path = CACHE_DIR / endpoint_name / f"{digest}.json"
        if path.exists():
            self.cache_hits += 1
            return json.loads(path.read_text(encoding="utf-8"))

        last_err: Exception | None = None
        for attempt in range(RETRIES):
            wait = self.last_request + MIN_INTERVAL_S - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            try:
                self.network_requests += 1
                data = factory(**params, timeout=TIMEOUT_S).get_dict()
                self.last_request = time.monotonic()
                path.parent.mkdir(parents=True, exist_ok=True)
                tmp = path.with_suffix(".tmp")
                tmp.write_text(json.dumps(data), encoding="utf-8")
                os.replace(tmp, path)
                if self.network_requests % 50 == 0:
                    print(f"  … {self.network_requests} network requests", flush=True)
                return data
            except Exception as err:  # noqa: BLE001 — any transport/decoding failure is retried
                self.last_request = time.monotonic()
                last_err = err
                backoff = BACKOFF_BASE_S * (2**attempt)
                print(f"  ! {endpoint_name} {key} attempt {attempt + 1}/{RETRIES} failed: {err!r}", flush=True)
                if attempt + 1 < RETRIES:
                    time.sleep(backoff)
        raise ApiUnreachable(f"{endpoint_name} {key}: {last_err!r}")


def write_file(directory: Path, name: str, endpoints: list[str], items: list[dict[str, Any]], snapshot: str) -> None:
    doc = {"meta": {"snapshotDate": snapshot, "source": tf.SOURCE, "endpoints": endpoints}, "items": items}
    (directory / name).write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def slim_career(raw: dict[str, Any]) -> dict[str, Any]:
    """Keep only the season rows of a playercareerstats response (memory: ~1.4k players)."""
    return {"resultSets": [s for s in raw["resultSets"] if s.get("name") == "SeasonTotalsRegularSeason"]}


def run(dry_run: bool) -> int:
    from nba_api.stats.endpoints import (
        alltimeleadersgrids,
        boxscoretraditionalv3,
        commonallplayers,
        franchisehistory,
        leaguedashlineups,
        leaguegamelog,
        playerawards,
        playercareerstats,
        playerindex,
    )
    from nba_api.stats.static import teams as static_teams

    started = time.monotonic()
    today = dt.datetime.now(dt.timezone.utc).date()
    snapshot = today.isoformat()
    f = Fetcher()
    last = tf.season_label(tf.LAST_SEASON_START)
    seasons = tf.window_seasons()

    def game_log(season: str, kind: str) -> list[dict[str, Any]]:
        return tf.result_set(
            f.get("leaguegamelog", leaguegamelog.LeagueGameLog, season=season, player_or_team_abbreviation=kind,
                  season_type_all_star="Regular Season")
        )

    print("1/8 commonallplayers + playerindex", flush=True)
    allp = tf.result_set(
        f.get("commonallplayers", commonallplayers.CommonAllPlayers, is_only_current_season=0, league_id="00", season=last),
        "CommonAllPlayers",
    )
    allp_by_id = {str(r["PERSON_ID"]): r for r in allp}
    active_ids = {pid for pid, r in allp_by_id.items() if tf.is_active(r)}
    pidx = tf.result_set(f.get("playerindex", playerindex.PlayerIndex, historical_nullable="1", season=last))
    position_by_id = {str(r["PERSON_ID"]): r.get("POSITION") for r in pidx}

    print("2/8 leaguegamelog (P, T) per season", flush=True)
    window_games: Counter[str] = Counter()
    log_totals: dict[str, dict[str, int]] = {}
    box_scores: list[dict[str, Any]] = []
    team_seen: dict[str, dict[str, set[str]]] = {}
    openers: list[tuple[str, str, str, str]] = []  # (season, team, TEAM_ID, GAME_ID)
    for s in seasons:
        p_rows = game_log(s, "P")
        t_rows = game_log(s, "T")
        window_games.update(tf.count_window_games(p_rows))
        tf.add_log_totals(log_totals, p_rows)
        box_scores.extend(tf.select_box_scores(p_rows, t_rows, s, MAX_BOX_SCORES_PER_SEASON))
        for r in t_rows:
            tf.note_team(team_seen, r["TEAM_ABBREVIATION"], r["TEAM_ID"], s)
        if tf.season_start(s) < tf.FIRST_LINEUP_SEASON_START:
            openers += [(s, team, tid, gid) for team, (tid, gid) in sorted(tf.opening_games(t_rows).items())]
    live = tf.in_progress_season(today)
    if tf.season_start(live) > tf.LAST_SEASON_START:
        # The season under way is outside the pool window but part of every active career.
        tf.add_log_totals(log_totals, game_log(live, "P"))

    print("3/8 leaguedashlineups per season (2007-08+)", flush=True)
    lineups: list[dict[str, Any]] = []
    for s in tf.window_seasons(tf.FIRST_LINEUP_SEASON_START):
        raw = f.get("leaguedashlineups", leaguedashlineups.LeagueDashLineups, group_quantity=5, season=s,
                    per_mode_detailed="Totals", measure_type_detailed_defense="Base",
                    season_type_all_star="Regular Season")
        lineups.extend(tf.top_lineups(raw, s))

    print(f"4/8 alltimeleadersgrids (TopX={LEGENDS_TOP_X})", flush=True)
    leaders_raw = f.get("alltimeleadersgrids", alltimeleadersgrids.AllTimeLeadersGrids, topx=LEGENDS_TOP_X,
                        per_mode_simple="Totals", season_type="Regular Season")
    leaderboards = tf.parse_leaderboards(leaders_raw, snapshot)
    legends = tf.leader_ids(leaders_raw)

    print(f"5/8 boxscoretraditionalv3: opening-night starters {seasons[0]}…"
          f"{tf.season_label(tf.FIRST_LINEUP_SEASON_START - 1)} ({len({o[3] for o in openers})} games)", flush=True)
    opening: list[dict[str, Any]] = []
    opening_skipped: list[str] = []
    for s, team, tid, gid in openers:
        raw = f.get("boxscoretraditionalv3", boxscoretraditionalv3.BoxScoreTraditionalV3, game_id=gid)
        starters = tf.opening_night_starters(raw, tid)
        if starters is None:
            opening_skipped.append(f"{team} {s} ({gid})")
        else:
            opening.append(tf.opening_lineup(team, s, starters))

    print("6/8 active career leaders (playercareerstats Totals)", flush=True)
    candidates = tf.screen_active_candidates(log_totals, active_ids, ACTIVE_LEADER_CANDIDATES)
    official: dict[str, dict[str, int]] = {}
    for pid in sorted(candidates):
        totals = tf.career_totals(
            f.get("playercareerstats", playercareerstats.PlayerCareerStats, player_id=pid, per_mode36="Totals")
        )
        if totals:
            official[pid] = totals
    active_lbs = tf.active_leaderboards(official, snapshot)
    del log_totals

    base_pool = {pid for pid, g in window_games.items() if g >= POOL_MIN_WINDOW_GAMES}
    starters_ids = {p for lu in opening for p in lu["playerIds"]}
    extra = (
        {p for lu in lineups for p in lu["playerIds"]}
        | starters_ids
        | {b["playerId"] for b in box_scores}
        | legends
        | {r["playerId"] for lb in leaderboards + active_lbs for r in lb["rows"]}
    )
    pool = sorted(pid for pid in base_pool | extra if pid in allp_by_id)
    print(
        f"   pool: {len(base_pool)} with ≥{POOL_MIN_WINDOW_GAMES} window games + "
        f"{len(extra - base_pool)} for lineups/openers/box scores/leaders "
        f"(legends {len(legends - base_pool)}, opening starters {len(starters_ids - base_pool)}) → {len(pool)} players",
        flush=True,
    )
    if dry_run:
        print(f"dry run: {f.network_requests} network requests, {f.cache_hits} cache hits")
        return 0

    print("7/8 playercareerstats + playerawards per player", flush=True)
    players, stats = [], []
    careers: dict[str, dict[str, Any]] = {}
    for i, pid in enumerate(pool, start=1):
        career = f.get("playercareerstats", playercareerstats.PlayerCareerStats, player_id=pid, per_mode36="PerGame")
        awards = f.get("playerawards", playerawards.PlayerAwards, player_id=pid)
        cs = tf.career_stats(pid, career)
        if cs is None:
            continue
        all_star, mvp = tf.all_star_and_mvp(awards)
        players.append(tf.build_player(pid, allp_by_id[pid], position_by_id.get(pid), all_star, mvp, cs["games"]))
        stats.append(cs)
        careers[pid] = slim_career(career)
        for r in tf.season_rows(career):
            tf.note_team(team_seen, r["TEAM_ABBREVIATION"], r["TEAM_ID"], r["SEASON_ID"])
        if i % 100 == 0:
            print(f"   {i}/{len(pool)} players", flush=True)

    print("8/8 franchisehistory, build, validate, write", flush=True)
    statics = static_teams.get_teams()
    periods = tf.team_periods(f.get("franchisehistory", franchisehistory.FranchiseHistory, league_id="00"))
    alias = tf.team_aliases(team_seen, statics, periods)
    stints = [s for pid, c in careers.items() for s in tf.career_stints(pid, c, alias)]
    rosters = [r for pid, c in careers.items() for r in tf.roster_entries(pid, c, alias=alias)]
    known = set(careers)
    lineups = [lu for lu in lineups + opening if all(p in known for p in lu["playerIds"])]
    box_scores = [b for b in box_scores if b["playerId"] in known]
    leaderboards = [lb for lb in leaderboards + active_lbs if all(r["playerId"] in known for r in lb["rows"])]
    used_teams = (
        {r["teamId"] for r in rosters}
        | {s["teamId"] for s in stints}
        | {lu["teamId"] for lu in lineups}
        | {b["teamId"] for b in box_scores}
        | {b["opponentId"] for b in box_scores}
        | {t["abbreviation"] for t in statics}
    )
    colors = tf.parse_color_tokens(GLOBALS_CSS.read_text(encoding="utf-8"))
    teams, problems = tf.build_teams(used_teams, statics, colors, team_seen, periods)
    if problems:
        print("Takım bilgisi eksik (transform.py CONFERENCE / globals.css takım token'ları) — "
              "seed dosyaları değiştirilmedi:")
        for p in problems:
            print(f"   {p}")
        return 1

    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)
    STAGING_DIR.mkdir(parents=True)
    write_file(STAGING_DIR, "teams.json", ["static.teams", "franchisehistory"], teams, snapshot)
    write_file(STAGING_DIR, "players.json",
               ["commonallplayers", "playerindex", "playerawards", "playercareerstats", "leaguegamelog"],
               players, snapshot)
    write_file(STAGING_DIR, "rosters.json", ["playercareerstats"], rosters, snapshot)
    write_file(STAGING_DIR, "starting-fives.json", ["leaguedashlineups", "boxscoretraditionalv3", "leaguegamelog"],
               lineups, snapshot)
    write_file(STAGING_DIR, "career-stints.json", ["playercareerstats"], stints, snapshot)
    write_file(STAGING_DIR, "career-stats.json", ["playercareerstats"], stats, snapshot)
    write_file(STAGING_DIR, "box-scores.json", ["leaguegamelog"], box_scores, snapshot)
    write_file(STAGING_DIR, "leaderboards.json", ["alltimeleadersgrids", "playercareerstats", "leaguegamelog"],
               leaderboards, snapshot)

    npx = shutil.which("npx") or "npx"
    result = subprocess.run([npx, "tsx", "scripts/validate-data.ts", "--dir", str(STAGING_DIR)], cwd=ROOT)
    if result.returncode != 0:
        print("Doğrulama başarısız — seed dosyaları değiştirilmedi (staging: data-cache/_staging)")
        return 1

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    for name in os.listdir(STAGING_DIR):
        os.replace(STAGING_DIR / name, SEED_DIR / name)
    STAGING_DIR.rmdir()

    by_id = {p["id"]: p for p in players}
    added_legends = sorted((by_id[p]["name"] for p in legends - base_pool if p in by_id))
    print(f"Efsaneler (TopX={LEGENDS_TOP_X}, havuz dışından): {len(added_legends)} — {', '.join(added_legends)}")
    print(f"Açılış gecesi beşleri: {sum(1 for lu in lineups if lu['source'] == 'boxscoretraditionalv3')} "
          f"(starter'ı 5 olmayan {len(opening_skipped)} maç atlandı{': ' + ', '.join(opening_skipped) if opening_skipped else ''})")
    print(f"Aktif liderler: {len(official)} aday için resmi kariyer toplamı; listeler: "
          + "; ".join(f"{lb['title']} (#1 {by_id[lb['rows'][0]['playerId']]['name']} {lb['rows'][0]['value']})"
                      for lb in leaderboards if lb["scope"] == "active"))
    print(f"Aynı takımın 1996 öncesi kodları güncel koda çevrildi: {', '.join(f'{a}→{b}' for a, b in sorted(alias.items()))}")
    print(
        f"Bitti: {time.monotonic() - started:.0f} sn, {f.network_requests} ağ isteği, {f.cache_hits} önbellek. "
        f"teams={len(teams)} players={len(players)} rosters={len(rosters)} starting-fives={len(lineups)} "
        f"career-stints={len(stints)} career-stats={len(stats)} box-scores={len(box_scores)} "
        f"leaderboards={len(leaderboards)}"
    )
    return 0


def main() -> int:
    # Windows consoles default to a legacy code page; messages contain Turkish text and symbols.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    try:
        return run(dry_run="--dry-run" in sys.argv)
    except ApiUnreachable as err:
        print(f"{UNREACHABLE_MSG} ({err})", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
