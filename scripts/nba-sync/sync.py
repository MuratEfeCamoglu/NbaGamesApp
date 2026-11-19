"""NBA API -> src/data/seed/*.json snapshot (ISKELET §3.6).

Run with `npm run data:sync` on a developer machine only (stats.nba.com blocks cloud IPs).
Flow: fetch (cached in data-cache/) -> transform (transform.py) -> write to a staging
dir -> `tsx scripts/validate-data.ts --dir <staging>` -> atomic move into src/data/seed.
If the API is unreachable, nothing in src/data/seed is touched.

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


def run(dry_run: bool) -> int:
    from nba_api.stats.endpoints import (
        alltimeleadersgrids,
        commonallplayers,
        leaguedashlineups,
        leaguegamelog,
        playerawards,
        playercareerstats,
        playerindex,
    )
    from nba_api.stats.static import teams as static_teams

    started = time.monotonic()
    snapshot = dt.datetime.now(dt.timezone.utc).date().isoformat()
    f = Fetcher()
    last = tf.season_label(tf.LAST_SEASON_START)
    seasons = tf.window_seasons()

    print("1/6 commonallplayers + playerindex", flush=True)
    allp = tf.result_set(
        f.get("commonallplayers", commonallplayers.CommonAllPlayers, is_only_current_season=0, league_id="00", season=last),
        "CommonAllPlayers",
    )
    allp_by_id = {str(r["PERSON_ID"]): r for r in allp}
    pidx = tf.result_set(f.get("playerindex", playerindex.PlayerIndex, historical_nullable="1", season=last))
    position_by_id = {str(r["PERSON_ID"]): r.get("POSITION") for r in pidx}

    print("2/6 leaguegamelog (P, T) per season", flush=True)
    player_logs: list[dict[str, Any]] = []
    box_scores: list[dict[str, Any]] = []
    for s in seasons:
        p_rows = tf.result_set(
            f.get("leaguegamelog", leaguegamelog.LeagueGameLog, season=s, player_or_team_abbreviation="P",
                  season_type_all_star="Regular Season")
        )
        t_rows = tf.result_set(
            f.get("leaguegamelog", leaguegamelog.LeagueGameLog, season=s, player_or_team_abbreviation="T",
                  season_type_all_star="Regular Season")
        )
        player_logs.extend(p_rows)
        box_scores.extend(tf.select_box_scores(p_rows, t_rows, s, MAX_BOX_SCORES_PER_SEASON))
    window_games = tf.count_window_games(player_logs)
    del player_logs

    print("3/6 leaguedashlineups per season (2007-08+)", flush=True)
    lineups: list[dict[str, Any]] = []
    for s in tf.window_seasons(tf.FIRST_LINEUP_SEASON_START):
        raw = f.get("leaguedashlineups", leaguedashlineups.LeagueDashLineups, group_quantity=5, season=s,
                    per_mode_detailed="Totals", measure_type_detailed_defense="Base",
                    season_type_all_star="Regular Season")
        lineups.extend(tf.top_lineups(raw, s))

    print("4/6 alltimeleadersgrids", flush=True)
    leaders_raw = f.get("alltimeleadersgrids", alltimeleadersgrids.AllTimeLeadersGrids, topx=10,
                        per_mode_simple="Totals", season_type="Regular Season")
    leaderboards = tf.parse_leaderboards(leaders_raw, snapshot)

    base_pool = {pid for pid, g in window_games.items() if g >= POOL_MIN_WINDOW_GAMES}
    extra = (
        {p for lu in lineups for p in lu["playerIds"]}
        | {b["playerId"] for b in box_scores}
        | {r["playerId"] for lb in leaderboards for r in lb["rows"]}
    )
    pool = sorted(pid for pid in base_pool | extra if pid in allp_by_id)
    print(
        f"   pool: {len(base_pool)} with ≥{POOL_MIN_WINDOW_GAMES} window games, "
        f"{len(extra - base_pool)} added for lineups/box scores/leaders → {len(pool)} players "
        f"(~{2 * len(pool)} requests)",
        flush=True,
    )
    if dry_run:
        print(f"dry run: {f.network_requests} network requests, {f.cache_hits} cache hits")
        return 0

    print("5/6 playercareerstats + playerawards per player", flush=True)
    colors = tf.parse_color_tokens(GLOBALS_CSS.read_text(encoding="utf-8"))
    window = set(seasons)
    players, stints, rosters, stats = [], [], [], []
    missing_colors: dict[str, set[str]] = {}
    for i, pid in enumerate(pool, start=1):
        career = f.get("playercareerstats", playercareerstats.PlayerCareerStats, player_id=pid, per_mode36="PerGame")
        awards = f.get("playerawards", playerawards.PlayerAwards, player_id=pid)
        cs = tf.career_stats(pid, career)
        if cs is None:
            continue
        all_star, mvp = tf.all_star_and_mvp(awards)
        players.append(tf.build_player(pid, allp_by_id[pid], position_by_id.get(pid), all_star, mvp, cs["games"]))
        stats.append(cs)
        p_stints = tf.career_stints(pid, career)
        unknown = {s["teamId"] for s in p_stints} - colors.keys()
        if unknown:
            # Team without a design color token (pre-1996 franchises): leave the journey out
            # rather than show a partial one.
            for t in unknown:
                missing_colors.setdefault(t, set()).add(pid)
        else:
            stints.extend(p_stints)
        for r in tf.roster_entries(pid, career, window):
            if r["teamId"] in colors:
                rosters.append(r)
            else:
                missing_colors.setdefault(r["teamId"], set()).add(pid)
        if i % 100 == 0:
            print(f"   {i}/{len(pool)} players", flush=True)

    print("6/6 build, validate, write", flush=True)
    known = {p["id"] for p in players}
    lineups = [lu for lu in lineups if all(p in known for p in lu["playerIds"]) and lu["teamId"] in colors]
    box_scores = [
        b for b in box_scores if b["playerId"] in known and b["teamId"] in colors and b["opponentId"] in colors
    ]
    leaderboards = [lb for lb in leaderboards if all(r["playerId"] in known for r in lb["rows"])]
    used_teams = (
        {r["teamId"] for r in rosters}
        | {s["teamId"] for s in stints}
        | {lu["teamId"] for lu in lineups}
        | {b["teamId"] for b in box_scores}
        | {b["opponentId"] for b in box_scores}
        | {t["abbreviation"] for t in static_teams.get_teams()}
    )
    teams = tf.build_teams(used_teams, static_teams.get_teams(), colors)

    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)
    STAGING_DIR.mkdir(parents=True)
    write_file(STAGING_DIR, "teams.json", ["static.teams"], teams, snapshot)
    write_file(STAGING_DIR, "players.json", ["commonallplayers", "playerindex", "playerawards", "leaguegamelog"],
               players, snapshot)
    write_file(STAGING_DIR, "rosters.json", ["playercareerstats"], rosters, snapshot)
    write_file(STAGING_DIR, "starting-fives.json", ["leaguedashlineups"], lineups, snapshot)
    write_file(STAGING_DIR, "career-stints.json", ["playercareerstats"], stints, snapshot)
    write_file(STAGING_DIR, "career-stats.json", ["playercareerstats"], stats, snapshot)
    write_file(STAGING_DIR, "box-scores.json", ["leaguegamelog"], box_scores, snapshot)
    write_file(STAGING_DIR, "leaderboards.json", ["alltimeleadersgrids"], leaderboards, snapshot)

    npx = shutil.which("npx") or "npx"
    result = subprocess.run([npx, "tsx", "scripts/validate-data.ts", "--dir", str(STAGING_DIR)], cwd=ROOT)
    if result.returncode != 0:
        print("Doğrulama başarısız — seed dosyaları değiştirilmedi (staging: data-cache/_staging)")
        return 1

    SEED_DIR.mkdir(parents=True, exist_ok=True)
    for name in os.listdir(STAGING_DIR):
        os.replace(STAGING_DIR / name, SEED_DIR / name)
    STAGING_DIR.rmdir()

    if missing_colors:
        print("Renk token'ı olmayan takımlar (yalnız 1996 öncesi; ilgili stint'ler atlandı):")
        for t, pids in sorted(missing_colors.items()):
            print(f"   {t}: {len(pids)} oyuncu")
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
