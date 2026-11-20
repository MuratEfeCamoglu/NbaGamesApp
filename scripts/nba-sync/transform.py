"""Pure transform functions: raw nba_api JSON (get_dict() output) -> seed items.

No network or filesystem access here so every rule can be unit-tested with
small fixture responses (test_transform.py).
"""

from __future__ import annotations

import datetime as dt
import re
from collections import Counter, defaultdict
from typing import Any, Iterable

SOURCE = "stats.nba.com via nba_api 1.12.0"
FIRST_SEASON_START = 1996  # 1996-97
LAST_SEASON_START = 2025  # 2025-26
FIRST_LINEUP_SEASON_START = 2007  # leaguedashlineups data starts in 2007-08

# Not provided by the API: the conference each team played in. Before 1970 the NBA had
# Eastern/Western *divisions*; those map to East/West. A code that spans both (SAN, CIN,
# BLT) gets the side it spent most of its seasons on.
CONFERENCE = {
    "ATL": "East", "BOS": "East", "BKN": "East", "CHA": "East", "CHI": "East",
    "CLE": "East", "DET": "East", "IND": "East", "MIA": "East", "MIL": "East",
    "NYK": "East", "ORL": "East", "PHI": "East", "TOR": "East", "WAS": "East",
    "DAL": "West", "DEN": "West", "GSW": "West", "HOU": "West", "LAC": "West",
    "LAL": "West", "MEM": "West", "MIN": "West", "NOP": "West", "OKC": "West",
    "PHX": "West", "POR": "West", "SAC": "West", "SAS": "West", "UTA": "West",
    # historical codes stats.nba.com uses
    "SEA": "West", "VAN": "West", "NJN": "East", "NOH": "West", "NOK": "West",
    "CHH": "East", "GOS": "West", "PHL": "East", "SAN": "West", "UTH": "West",
    "KCK": "West", "KCO": "West", "CIN": "East", "ROC": "West", "BLT": "East",
    "CAP": "East", "WSB": "East", "CHP": "West", "CHZ": "West", "PHW": "East",
    "SFW": "West", "SDR": "West", "BUF": "East", "SDC": "West", "NOJ": "East",
    "NYN": "East", "MNL": "West", "MIH": "West", "STL": "West", "TRI": "West",
    "SYR": "East", "FTW": "West",
}

# alltimeleadersgrids result set -> (id, title, statLabel, value column). The same columns
# exist in playercareerstats CareerTotalsRegularSeason and leaguegamelog rows (GP = rows).
LEADERBOARD_SETS = [
    ("PTSLeaders", "career-points", "Career Points", "PTS", "PTS"),
    ("REBLeaders", "career-rebounds", "Career Rebounds", "REB", "REB"),
    ("ASTLeaders", "career-assists", "Career Assists", "AST", "AST"),
    ("STLLeaders", "career-steals", "Career Steals", "STL", "STL"),
    ("BLKLeaders", "career-blocks", "Career Blocks", "BLK", "BLK"),
    ("FG3MLeaders", "career-3pm", "Career 3-Pointers Made", "3PM", "FG3M"),
    ("GPLeaders", "career-games", "Career Games Played", "GP", "GP"),
    ("FTMLeaders", "career-ftm", "Career Free Throws Made", "FTM", "FTM"),
    ("FGMLeaders", "career-fgm", "Career Field Goals Made", "FGM", "FGM"),
]
LEADER_COLUMNS = [col for *_, col in LEADERBOARD_SETS]


# ---------------------------------------------------------------- helpers

def result_set(raw: dict[str, Any], name: str | None = None) -> list[dict[str, Any]]:
    """Return rows of a result set as dicts. Handles both `resultSets` list and single `resultSet`."""
    sets = raw.get("resultSets")
    if sets is None:
        sets = raw.get("resultSet")
    if isinstance(sets, dict):
        sets = [sets]
    if not isinstance(sets, list):
        raise ValueError("response has no resultSets")
    for s in sets:
        if name is None or s.get("name") == name:
            headers = s["headers"]
            return [dict(zip(headers, row)) for row in s.get("rowSet", [])]
    raise KeyError(f"result set {name!r} not found")


def season_label(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def season_start(label: str) -> int:
    return int(label[:4])


def window_seasons(first: int = FIRST_SEASON_START, last: int = LAST_SEASON_START) -> list[str]:
    return [season_label(y) for y in range(first, last + 1)]


def in_progress_season(today: dt.date) -> str:
    """Season label containing `today`; the regular season tips off in October."""
    return season_label(today.year if today.month >= 10 else today.year - 1)


_POS_MAP = {
    "G": "G", "F": "F", "C": "C",
    "G-F": "G-F", "F-G": "G-F",
    "F-C": "F-C", "C-F": "F-C",
    "PG": "PG", "SG": "SG", "SF": "SF", "PF": "PF",
    "GUARD": "G", "FORWARD": "F", "CENTER": "C",
    "GUARD-FORWARD": "G-F", "FORWARD-GUARD": "G-F",
    "FORWARD-CENTER": "F-C", "CENTER-FORWARD": "F-C",
}


def normalize_position(raw: Any) -> str:
    if not raw:
        return ""
    key = str(raw).strip().upper().replace(" ", "")
    return _POS_MAP.get(key, "")


def _num(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, str) and ":" in v:  # "35:12" minute strings
        mm, ss = v.split(":", 1)
        return float(mm) + float(ss) / 60
    return float(v)


def _int(v: Any) -> int:
    return int(round(_num(v)))


# ---------------------------------------------------------------- players / pool

def count_window_games(player_logs: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Games played per player from leaguegamelog (P) rows: one row = one game."""
    counts: dict[str, int] = defaultdict(int)
    for row in player_logs:
        counts[str(row["PLAYER_ID"])] += 1
    return dict(counts)


def all_star_and_mvp(awards_raw: dict[str, Any]) -> tuple[int, bool]:
    rows = result_set(awards_raw, "PlayerAwards")
    all_star = sum(1 for r in rows if str(r.get("DESCRIPTION", "")).strip() == "NBA All-Star")
    mvp = any(str(r.get("DESCRIPTION", "")).strip() == "NBA Most Valuable Player" for r in rows)
    return all_star, mvp


def fame_tier(all_star_count: int, mvp: bool, career_games: int) -> int:
    """ISKELET §3.6: 1 = ≥3 All-Star or MVP; 2 = ≥1 All-Star or ≥500 games; 3 = rest."""
    if all_star_count >= 3 or mvp:
        return 1
    if all_star_count >= 1 or career_games >= 500:
        return 2
    return 3


def build_player(
    player_id: str,
    allplayers_row: dict[str, Any],
    position_raw: Any,
    all_star_count: int,
    mvp: bool,
    career_games: int,
) -> dict[str, Any]:
    return {
        "id": player_id,
        "name": str(allplayers_row["DISPLAY_FIRST_LAST"]).strip(),
        "position": normalize_position(position_raw),
        "fameTier": fame_tier(all_star_count, mvp, career_games),
        "allStarCount": all_star_count,
        "active": is_active(allplayers_row),
        "headshotId": player_id,
    }


def is_active(allplayers_row: dict[str, Any]) -> bool:
    """commonallplayers ROSTERSTATUS: on an NBA roster now (= era "current")."""
    return int(allplayers_row.get("ROSTERSTATUS") or 0) == 1


# ---------------------------------------------------------------- career

def season_rows(career_raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Regular-season rows without the traded-player `TOT` aggregate rows."""
    return [r for r in result_set(career_raw, "SeasonTotalsRegularSeason") if r.get("TEAM_ABBREVIATION") != "TOT"]


def career_stints(
    player_id: str,
    career_raw: dict[str, Any],
    alias: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Merge consecutive same-team season rows into stints, ordered chronologically.

    Rows come in chronological order (and in-season trade order) from the API; we keep
    that order so a mid-season trade A->B->A yields three stints. `alias` (team_aliases)
    rewrites a legacy code to the current code of the very same team first (UTH -> UTA),
    so a one-team career like Stockton's is not split at the 1996 code switch.
    """
    alias = alias or {}
    stints: list[dict[str, Any]] = []
    for row in season_rows(career_raw):
        team = alias.get(row["TEAM_ABBREVIATION"], row["TEAM_ABBREVIATION"])
        season = row["SEASON_ID"]
        if stints and stints[-1]["teamId"] == team:
            stints[-1]["toSeason"] = season
        else:
            stints.append({"playerId": player_id, "teamId": team, "fromSeason": season, "toSeason": season})
    for i, s in enumerate(stints, start=1):
        s["order"] = i
    return stints


def roster_entries(
    player_id: str,
    career_raw: dict[str, Any],
    seasons: set[str] | None = None,
    alias: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """One entry per (team, season) the player appeared for; `seasons` limits the window
    (None = whole career), `alias` rewrites legacy codes as in career_stints."""
    alias = alias or {}
    seen: set[tuple[str, str]] = set()
    out = []
    for row in season_rows(career_raw):
        key = (alias.get(row["TEAM_ABBREVIATION"], row["TEAM_ABBREVIATION"]), row["SEASON_ID"])
        if (seasons is None or row["SEASON_ID"] in seasons) and key not in seen:
            seen.add(key)
            out.append({"playerId": player_id, "teamId": key[0], "season": key[1]})
    return out


def career_stats(player_id: str, career_raw: dict[str, Any]) -> dict[str, Any] | None:
    """Per-game career averages from CareerTotalsRegularSeason (request PerMode=PerGame)."""
    totals = result_set(career_raw, "CareerTotalsRegularSeason")
    if not totals:
        return None
    t = totals[0]
    games = _int(t.get("GP"))
    seasons = {r["SEASON_ID"] for r in season_rows(career_raw)}
    if games < 1 or not seasons:
        return None
    return {
        "playerId": player_id,
        "games": games,
        "seasons": len(seasons),
        "ppg": round(_num(t.get("PTS")), 1),
        "rpg": round(_num(t.get("REB")), 1),
        "apg": round(_num(t.get("AST")), 1),
        "spg": round(_num(t.get("STL")), 1),
        "bpg": round(_num(t.get("BLK")), 1),
        "fgPct": round(_num(t.get("FG_PCT")) * 100, 1),
        "source": "playercareerstats",
    }


def career_totals(career_raw: dict[str, Any]) -> dict[str, int] | None:
    """Regular-season career totals of the leaderboard columns (request PerMode=Totals)."""
    rows = result_set(career_raw, "CareerTotalsRegularSeason")
    if not rows:
        return None
    return {col: _int(rows[0].get(col)) for col in LEADER_COLUMNS}


# ---------------------------------------------------------------- lineups

def _lineup_player_ids(group_id: str) -> list[str]:
    return [p for p in re.split(r"[-\s]+", str(group_id)) if p]


def top_lineups(lineups_raw: dict[str, Any], season: str) -> list[dict[str, Any]]:
    """Per team, the five-man unit with the most minutes that season."""
    best: dict[str, dict[str, Any]] = {}
    for row in result_set(lineups_raw, "Lineups"):
        team = row["TEAM_ABBREVIATION"]
        ids = _lineup_player_ids(row["GROUP_ID"])
        if len(ids) != 5 or len(set(ids)) != 5:
            continue
        minutes = _num(row.get("MIN"))
        cur = best.get(team)
        if cur is None or minutes > cur["minutes"]:
            best[team] = {
                "id": f"{team}-{season}",
                "teamId": team,
                "season": season,
                "playerIds": ids,
                "minutes": round(minutes, 1),
                "source": "leaguedashlineups",
            }
    return [best[t] for t in sorted(best)]


def opening_games(team_rows: list[dict[str, Any]]) -> dict[str, tuple[str, str]]:
    """Team code -> (TEAM_ID, GAME_ID) of its first game, from a season's leaguegamelog (T) rows."""
    first: dict[str, tuple[str, str]] = {}
    for r in sorted(team_rows, key=lambda r: (str(r["GAME_DATE"])[:10], str(r["GAME_ID"]))):
        first.setdefault(r["TEAM_ABBREVIATION"], (str(r["TEAM_ID"]), str(r["GAME_ID"])))
    return first


def opening_night_starters(box_raw: dict[str, Any], team_id: str) -> list[str] | None:
    """The team's starters in a boxscoretraditionalv3 response: players listed with a starting
    position (bench players have ""). None unless exactly five distinct starters are listed."""
    box = box_raw.get("boxScoreTraditional") or {}
    for side in ("homeTeam", "awayTeam"):
        team = box.get(side) or {}
        if str(team.get("teamId")) != str(team_id):
            continue
        ids = [str(p["personId"]) for p in team.get("players") or [] if str(p.get("position") or "").strip()]
        return ids if len(ids) == 5 and len(set(ids)) == 5 else None
    return None


def opening_lineup(team: str, season: str, starters: list[str]) -> dict[str, Any]:
    """Opening-night starting five (seasons before leaguedashlineups data). `minutes` is 0:
    the box score has per-player minutes only, not the time this five shared the floor."""
    return {
        "id": f"{team}-{season}-opener",
        "teamId": team,
        "season": season,
        "playerIds": starters,
        "minutes": 0,
        "source": "boxscoretraditionalv3",
    }


# ---------------------------------------------------------------- box scores

def is_triple_double(row: dict[str, Any]) -> bool:
    return sum(1 for k in ("PTS", "REB", "AST", "STL", "BLK") if _int(row.get(k)) >= 10) >= 3


def _opponent(matchup: str, team: str) -> str | None:
    # "LAL vs. BOS" (home) or "LAL @ BOS" (away)
    parts = re.split(r"\s+(?:vs\.|@)\s+", matchup.strip())
    if len(parts) != 2:
        return None
    a, b = parts
    return b if a == team else a if b == team else None


def select_box_scores(
    player_rows: list[dict[str, Any]],
    team_rows: list[dict[str, Any]],
    season: str,
    max_per_season: int = 10,
) -> list[dict[str, Any]]:
    """PTS ≥ 40 or triple-double; up to half the slots for top scoring games, the rest
    for triple-doubles (then any remaining qualifier), so both kinds appear."""
    team_pts = {(str(r["GAME_ID"]), r["TEAM_ABBREVIATION"]): _int(r["PTS"]) for r in team_rows}
    qualifying = [r for r in player_rows if _int(r.get("PTS")) >= 40 or is_triple_double(r)]
    scorers = sorted(
        (r for r in qualifying if _int(r.get("PTS")) >= 40),
        key=lambda r: (-_int(r["PTS"]), str(r["GAME_ID"]), str(r["PLAYER_ID"])),
    )
    tds = sorted(
        (r for r in qualifying if is_triple_double(r) and _int(r.get("PTS")) < 40),
        key=lambda r: (-(_int(r["PTS"]) + _int(r["REB"]) + _int(r["AST"])), str(r["GAME_ID"]), str(r["PLAYER_ID"])),
    )
    half = max_per_season // 2
    picked = scorers[:half] + tds[: max_per_season - min(half, len(scorers))]
    rest = [r for r in scorers[half:] + tds if r not in picked]
    picked = (picked + rest)[:max_per_season]

    out = []
    for r in picked:
        team = r["TEAM_ABBREVIATION"]
        opp = _opponent(str(r.get("MATCHUP", "")), team)
        gid = str(r["GAME_ID"])
        if opp is None or (gid, team) not in team_pts or (gid, opp) not in team_pts:
            continue
        line = {
            "id": f"{gid}-{r['PLAYER_ID']}",
            "playerId": str(r["PLAYER_ID"]),
            "gameId": gid,
            "gameDate": str(r["GAME_DATE"])[:10],
            "season": season,
            "teamId": team,
            "opponentId": opp,
            "teamScore": team_pts[(gid, team)],
            "opponentScore": team_pts[(gid, opp)],
            "min": _int(r.get("MIN")),
            "pts": _int(r.get("PTS")),
            "reb": _int(r.get("REB")),
            "ast": _int(r.get("AST")),
            "stl": _int(r.get("STL")),
            "blk": _int(r.get("BLK")),
            "fgm": _int(r.get("FGM")),
            "fga": _int(r.get("FGA")),
            "tpm": _int(r.get("FG3M")),
            "tpa": _int(r.get("FG3A")),
            "source": "leaguegamelog",
        }
        if line["fgm"] <= line["fga"] and line["tpm"] <= line["tpa"] and line["tpm"] <= line["fgm"]:
            out.append(line)
    return out


# ---------------------------------------------------------------- leaderboards

def parse_leaderboards(raw: dict[str, Any], as_of: str) -> list[dict[str, Any]]:
    """Top 10 of each all-time list (the response may hold more rows: TopX)."""
    out = []
    for set_name, lb_id, title, label, col in LEADERBOARD_SETS:
        rows = result_set(raw, set_name)
        rows = sorted(rows, key=lambda r: (-_num(r[col]), _int(r.get(f"{col}_RANK", 0))))[:10]
        if len(rows) < 10:
            continue
        out.append(
            {
                "id": lb_id,
                "title": title,
                "statLabel": label,
                "asOf": as_of,
                "rows": [
                    {"rank": i, "playerId": str(r["PLAYER_ID"]), "value": int(_num(r[col]))}
                    for i, r in enumerate(rows, start=1)
                ],
                "source": "alltimeleadersgrids",
                "scope": "all-time",
            }
        )
    return out


def leader_ids(raw: dict[str, Any]) -> set[str]:
    """Every player in the used alltimeleadersgrids lists (all TopX rows): the legends pool."""
    return {str(r["PLAYER_ID"]) for set_name, *_ in LEADERBOARD_SETS for r in result_set(raw, set_name)}


def add_log_totals(acc: dict[str, dict[str, int]], player_rows: Iterable[dict[str, Any]]) -> None:
    """Accumulate leaderboard-column totals from leaguegamelog (P) rows (one row = one game)."""
    for r in player_rows:
        t = acc.setdefault(str(r["PLAYER_ID"]), dict.fromkeys(LEADER_COLUMNS, 0))
        t["GP"] += 1
        for col in LEADER_COLUMNS:
            if col != "GP":
                t[col] += _int(r.get(col))


def screen_active_candidates(
    log_totals: dict[str, dict[str, int]],
    active_ids: set[str],
    depth: int,
) -> set[str]:
    """Active players in the top `depth` of any leaderboard column by game-log totals.

    Game logs cover every active player's whole career (all debuted after 1996-97), so this
    cheaply narrows who needs an official career-totals request."""
    out: set[str] = set()
    for col in LEADER_COLUMNS:
        ranked = sorted((p for p in log_totals if p in active_ids), key=lambda p: (-log_totals[p][col], p))
        out.update(ranked[:depth])
    return out


def active_leaderboards(totals: dict[str, dict[str, int]], as_of: str) -> list[dict[str, Any]]:
    """Top 10 career totals among the given (active) players, one list per leaderboard column."""
    out = []
    for _, lb_id, title, label, col in LEADERBOARD_SETS:
        ranked = sorted(totals, key=lambda p: (-totals[p][col], p))[:10]
        if len(ranked) < 10:
            continue
        out.append(
            {
                "id": f"active-{lb_id}",
                "title": f"{title} — Active Players",
                "statLabel": label,
                "asOf": as_of,
                "rows": [{"rank": i, "playerId": p, "value": totals[p][col]} for i, p in enumerate(ranked, start=1)],
                "source": "playercareerstats",
                "scope": "active",
            }
        )
    return out


# ---------------------------------------------------------------- teams

def note_team(acc: dict[str, dict[str, set[str]]], code: str, team_id: Any, season: str) -> None:
    """Record that team `code` (with stats.nba.com TEAM_ID) appears in `season`."""
    acc.setdefault(code, {}).setdefault(str(team_id), set()).add(season)


def team_periods(franchise_raw: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """TEAM_ID -> name periods (city, name, first/last season start year) from franchisehistory."""
    out: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for set_name in ("FranchiseHistory", "DefunctTeams"):
        for r in result_set(franchise_raw, set_name):
            out[str(r["TEAM_ID"])].append(
                {
                    "city": str(r["TEAM_CITY"]).strip(),
                    "name": str(r["TEAM_NAME"]).strip(),
                    "start": int(r["START_YEAR"]),
                    "end": int(r["END_YEAR"]),
                }
            )
    return dict(out)


def team_identity(seasons: set[str], periods: list[dict[str, Any]]) -> tuple[str, str] | None:
    """(full name, city) the team had in most of `seasons`. Each season votes for the narrowest
    franchisehistory period containing it, because the endpoint also lists whole-history
    summary rows under the current name (e.g. "Sacramento Kings 1948-2026")."""
    votes: Counter[tuple[str, str]] = Counter()
    for s in seasons:
        y = season_start(s)
        containing = [p for p in periods if p["start"] <= y <= p["end"]]
        if containing:
            best = min(containing, key=lambda p: (p["end"] - p["start"], -p["start"]))
            votes[(best["city"], best["name"])] += 1
    if not votes:
        return None
    (city, name), _ = max(votes.items(), key=lambda kv: (kv[1], kv[0]))
    return f"{city} {name}", city


def team_aliases(
    seen: dict[str, dict[str, set[str]]],
    static_teams: list[dict[str, Any]],
    periods: dict[str, list[dict[str, Any]]],
) -> dict[str, str]:
    """Legacy code -> current code when both name the very same team: same TEAM_ID, same city
    and name, and the current code takes over without a season gap. stats.nba.com spells some
    teams differently before 1996-97 (UTH, GOS, PHL, SAN). Renamed or relocated teams (SEA,
    NJN, WSB…) are not aliases, nor is CHH (1988-2002 Hornets; Charlotte had no team 2002-04)."""
    current = {str(t["id"]): t for t in static_teams}
    codes = {t["abbreviation"] for t in static_teams}
    out = {}
    for code, ids in seen.items():
        if code in codes or len(ids) != 1:
            continue
        (team_id, seasons), = ids.items()
        team = current.get(team_id)
        if team is None:
            continue
        ident = team_identity(seasons, periods.get(team_id, []))
        successor = seen.get(team["abbreviation"], {}).get(team_id, set())
        contiguous = bool(successor) and min(map(season_start, successor)) <= max(map(season_start, seasons)) + 1
        if ident and ident[0] == team["full_name"] and contiguous:
            out[code] = team["abbreviation"]
    return out


def build_teams(
    used_ids: Iterable[str],
    static_teams: list[dict[str, Any]],
    colors: dict[str, tuple[str, str]],
    seen: dict[str, dict[str, set[str]]],
    periods: dict[str, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[str]]:
    """teams.json items + problems (each a reason a used code cannot be described).

    Current teams come from static.teams. Historical codes: franchise = current code of the
    same stats.nba.com TEAM_ID (defunct franchises point at themselves), city/name from the
    franchisehistory period of the seasons the code was used, conference from CONFERENCE,
    colors from the globals.css tokens (`colors`, keyed by uppercase code)."""
    by_code = {t["abbreviation"]: t for t in static_teams}
    code_of_id = {str(t["id"]): t["abbreviation"] for t in static_teams}
    out, problems = [], []
    for tid in sorted(set(used_ids)):
        if tid in by_code:
            name, city, franchise = by_code[tid]["full_name"], by_code[tid]["city"], tid
        else:
            ids = seen.get(tid, {})
            if len(ids) != 1:
                problems.append(f"{tid}: expected one stats.nba.com TEAM_ID, found {sorted(ids) or 'none'}")
                continue
            (team_id, seasons), = ids.items()
            ident = team_identity(seasons, periods.get(team_id, []))
            if ident is None:
                problems.append(f"{tid}: TEAM_ID {team_id} has no franchisehistory period for {sorted(seasons)}")
                continue
            name, city = ident
            franchise = code_of_id.get(team_id, tid)
        missing = [what for what, ok in (("conference", tid in CONFERENCE), ("color tokens", tid in colors)) if not ok]
        if missing:
            seasons_all = sorted(s for ss in seen.get(tid, {}).values() for s in ss)
            span = f"{seasons_all[0]}…{seasons_all[-1]}" if seasons_all else "?"
            problems.append(f"{tid} ({name}, {span}, franchise {franchise}): missing {' + '.join(missing)}")
            continue
        primary, secondary = colors[tid]
        out.append(
            {
                "id": tid,
                "name": name,
                "city": city,
                "franchiseId": franchise,
                "conference": CONFERENCE[tid],
                "primaryColor": primary,
                "secondaryColor": secondary,
            }
        )
    return out, problems


def parse_color_tokens(css: str) -> dict[str, tuple[str, str]]:
    base = dict(re.findall(r"--color-team-([a-z]{3}):\s*(#[0-9a-fA-F]{6})", css))
    fg = dict(re.findall(r"--color-team-([a-z]{3})-fg:\s*(#[0-9a-fA-F]{6})", css))
    return {k.upper(): (v, fg[k]) for k, v in base.items() if k in fg}
