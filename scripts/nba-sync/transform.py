"""Pure transform functions: raw nba_api JSON (get_dict() output) -> seed items.

No network or filesystem access here so every rule can be unit-tested with
small fixture responses (test_transform.py).
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Iterable

SOURCE = "stats.nba.com via nba_api 1.12.0"
FIRST_SEASON_START = 1996  # 1996-97
LAST_SEASON_START = 2025  # 2025-26
FIRST_LINEUP_SEASON_START = 2007  # leaguedashlineups data starts in 2007-08

# Historical franchise abbreviations stats.nba.com reports -> current franchise.
FRANCHISE_OF = {
    "SEA": "OKC",
    "VAN": "MEM",
    "NJN": "BKN",
    "NOH": "NOP",
    "NOK": "NOP",
    "CHH": "CHA",
}

# Not provided by the API (static.teams has no conference, no historical teams).
CONFERENCE = {
    "ATL": "East", "BOS": "East", "BKN": "East", "CHA": "East", "CHI": "East",
    "CLE": "East", "DET": "East", "IND": "East", "MIA": "East", "MIL": "East",
    "NYK": "East", "ORL": "East", "PHI": "East", "TOR": "East", "WAS": "East",
    "DAL": "West", "DEN": "West", "GSW": "West", "HOU": "West", "LAC": "West",
    "LAL": "West", "MEM": "West", "MIN": "West", "NOP": "West", "OKC": "West",
    "PHX": "West", "POR": "West", "SAC": "West", "SAS": "West", "UTA": "West",
    "SEA": "West", "VAN": "West", "NJN": "East", "NOH": "West", "NOK": "West",
    "CHH": "East",
}

HISTORICAL_TEAMS = {
    "SEA": ("Seattle SuperSonics", "Seattle"),
    "VAN": ("Vancouver Grizzlies", "Vancouver"),
    "NJN": ("New Jersey Nets", "New Jersey"),
    "NOH": ("New Orleans Hornets", "New Orleans"),
    "NOK": ("New Orleans/Oklahoma City Hornets", "New Orleans/Oklahoma City"),
    "CHH": ("Charlotte Hornets", "Charlotte"),
}

# alltimeleadersgrids result set -> (id, title, statLabel, value column)
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
        "active": int(allplayers_row.get("ROSTERSTATUS") or 0) == 1,
        "headshotId": player_id,
    }


# ---------------------------------------------------------------- career

def season_rows(career_raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Regular-season rows without the traded-player `TOT` aggregate rows."""
    return [r for r in result_set(career_raw, "SeasonTotalsRegularSeason") if r.get("TEAM_ABBREVIATION") != "TOT"]


def career_stints(player_id: str, career_raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Merge consecutive same-team season rows into stints, ordered chronologically.

    Rows come in chronological order (and in-season trade order) from the API; we keep
    that order so a mid-season trade A->B->A yields three stints.
    """
    stints: list[dict[str, Any]] = []
    for row in season_rows(career_raw):
        team = row["TEAM_ABBREVIATION"]
        season = row["SEASON_ID"]
        if stints and stints[-1]["teamId"] == team:
            stints[-1]["toSeason"] = season
        else:
            stints.append({"playerId": player_id, "teamId": team, "fromSeason": season, "toSeason": season})
    for i, s in enumerate(stints, start=1):
        s["order"] = i
    return stints


def roster_entries(player_id: str, career_raw: dict[str, Any], seasons: set[str]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    out = []
    for row in season_rows(career_raw):
        key = (row["TEAM_ABBREVIATION"], row["SEASON_ID"])
        if row["SEASON_ID"] in seasons and key not in seen:
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
            }
        )
    return out


# ---------------------------------------------------------------- teams

def build_teams(
    used_ids: Iterable[str],
    static_teams: list[dict[str, Any]],
    colors: dict[str, tuple[str, str]],
) -> list[dict[str, Any]]:
    """`colors` maps lowercase-agnostic team id -> (primary, secondary) from globals.css tokens."""
    by_abbr = {t["abbreviation"]: t for t in static_teams}
    out = []
    for tid in sorted(set(used_ids)):
        if tid in by_abbr:
            name, city, franchise = by_abbr[tid]["full_name"], by_abbr[tid]["city"], tid
        elif tid in HISTORICAL_TEAMS:
            name, city = HISTORICAL_TEAMS[tid]
            franchise = FRANCHISE_OF[tid]
        else:
            raise KeyError(f"unknown team abbreviation {tid}")
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
    return out


def parse_color_tokens(css: str) -> dict[str, tuple[str, str]]:
    base = dict(re.findall(r"--color-team-([a-z]{3}):\s*(#[0-9a-fA-F]{6})", css))
    fg = dict(re.findall(r"--color-team-([a-z]{3})-fg:\s*(#[0-9a-fA-F]{6})", css))
    return {k.upper(): (v, fg[k]) for k, v in base.items() if k in fg}
