"""Transform rules with small hand-made responses shaped like nba_api get_dict() output."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import transform as tf  # noqa: E402


def rs(name, headers, rows):
    return {"name": name, "headers": headers, "rowSet": rows}


SEASON_HEADERS = ["PLAYER_ID", "SEASON_ID", "TEAM_ABBREVIATION", "GP"]
CAREER_HEADERS = ["PLAYER_ID", "GP", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT"]


def career(rows, totals=(1, 500, 20.04, 5.0, 3.0, 1.0, 0.5, 0.4567)):
    return {
        "resultSets": [
            rs("SeasonTotalsRegularSeason", SEASON_HEADERS, [[1, s, t, 50] for s, t in rows]),
            rs("CareerTotalsRegularSeason", CAREER_HEADERS, [list(totals)]),
        ]
    }


def test_stints_merge_consecutive_and_skip_tot():
    raw = career(
        [
            ("2001-02", "SEA"),
            ("2002-03", "SEA"),
            ("2003-04", "TOT"),
            ("2003-04", "SEA"),
            ("2003-04", "MIL"),
            ("2004-05", "MIL"),
            ("2005-06", "SEA"),
        ]
    )
    stints = tf.career_stints("1", raw)
    assert [(s["teamId"], s["fromSeason"], s["toSeason"], s["order"]) for s in stints] == [
        ("SEA", "2001-02", "2003-04", 1),
        ("MIL", "2003-04", "2004-05", 2),
        ("SEA", "2005-06", "2005-06", 3),
    ]


def test_rosters_limited_to_window_and_deduplicated():
    raw = career([("1995-96", "LAL"), ("1996-97", "LAL"), ("1996-97", "TOT"), ("1997-98", "LAL")])
    entries = tf.roster_entries("1", raw, set(tf.window_seasons()))
    assert entries == [
        {"playerId": "1", "teamId": "LAL", "season": "1996-97"},
        {"playerId": "1", "teamId": "LAL", "season": "1997-98"},
    ]


def test_career_stats_per_game_and_percentage():
    raw = career([("2001-02", "SEA"), ("2002-03", "TOT"), ("2002-03", "SEA"), ("2002-03", "MIL")])
    cs = tf.career_stats("1", raw)
    assert cs["games"] == 500
    assert cs["seasons"] == 2
    assert cs["ppg"] == 20.0
    assert cs["fgPct"] == 45.7


def test_fame_tier_rule():
    assert tf.fame_tier(3, False, 100) == 1
    assert tf.fame_tier(0, True, 100) == 1
    assert tf.fame_tier(2, False, 100) == 2
    assert tf.fame_tier(0, False, 500) == 2
    assert tf.fame_tier(0, False, 499) == 3


def test_all_star_count_from_awards():
    raw = {
        "resultSets": [
            rs(
                "PlayerAwards",
                ["PERSON_ID", "DESCRIPTION", "SEASON"],
                [
                    [1, "NBA All-Star", "2001-02"],
                    [1, "NBA All-Star", "2002-03"],
                    [1, "All-NBA", "2002-03"],
                    [1, "NBA All-Star Most Valuable Player", "2002-03"],
                    [1, "NBA Most Valuable Player", "2003-04"],
                ],
            )
        ]
    }
    assert tf.all_star_and_mvp(raw) == (2, True)


def test_build_player_normalises_position():
    row = {"DISPLAY_FIRST_LAST": "Tim Duncan", "ROSTERSTATUS": 0}
    p = tf.build_player("1495", row, "C-F", 15, True, 1392)
    assert p == {
        "id": "1495",
        "name": "Tim Duncan",
        "position": "F-C",
        "fameTier": 1,
        "allStarCount": 15,
        "active": False,
        "headshotId": "1495",
    }
    assert tf.normalize_position("Guard-Forward") == "G-F"
    assert tf.normalize_position(None) == ""


def test_top_lineup_per_team_by_minutes():
    raw = {
        "resultSets": [
            rs(
                "Lineups",
                ["GROUP_ID", "TEAM_ABBREVIATION", "MIN"],
                [
                    ["-1-2-3-4-5-", "GSW", 100.5],
                    ["-1-2-3-4-6-", "GSW", 300.25],
                    ["-7-8-9-10-11-", "BOS", 50.0],
                    ["-7-8-9-10-", "BOS", 900.0],  # malformed: not five players
                ],
            )
        ]
    }
    out = tf.top_lineups(raw, "2015-16")
    assert [(lu["id"], lu["playerIds"], lu["minutes"]) for lu in out] == [
        ("BOS-2015-16", ["7", "8", "9", "10", "11"], 50.0),
        ("GSW-2015-16", ["1", "2", "3", "4", "6"], 300.2),
    ]


PLAYER_LOG_HEADERS = [
    "PLAYER_ID", "TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE", "MATCHUP", "MIN",
    "FGM", "FGA", "FG3M", "FG3A", "REB", "AST", "STL", "BLK", "PTS",
]


def log_row(pid, team, gid, matchup, pts, reb, ast, stl=1, blk=0):
    return dict(zip(PLAYER_LOG_HEADERS, [pid, team, gid, "2016-01-02", matchup, 38, 15, 25, 4, 9, reb, ast, stl, blk, pts]))


def test_triple_double_detection():
    assert tf.is_triple_double({"PTS": 10, "REB": 10, "AST": 10, "STL": 0, "BLK": 0})
    assert tf.is_triple_double({"PTS": 25, "REB": 3, "AST": 11, "STL": 10, "BLK": 0})
    assert not tf.is_triple_double({"PTS": 40, "REB": 10, "AST": 9, "STL": 0, "BLK": 0})


def test_box_score_selection_and_scores():
    players = [
        log_row(1, "GSW", "001", "GSW vs. BOS", 45, 5, 5),
        log_row(2, "BOS", "001", "BOS @ GSW", 12, 11, 10),
        log_row(3, "BOS", "001", "BOS @ GSW", 30, 5, 5),  # does not qualify
    ]
    teams = [
        {"GAME_ID": "001", "TEAM_ABBREVIATION": "GSW", "PTS": 120},
        {"GAME_ID": "001", "TEAM_ABBREVIATION": "BOS", "PTS": 110},
    ]
    out = tf.select_box_scores(players, teams, "2015-16", 10)
    assert [(b["playerId"], b["teamId"], b["opponentId"], b["teamScore"], b["opponentScore"]) for b in out] == [
        ("1", "GSW", "BOS", 120, 110),
        ("2", "BOS", "GSW", 110, 120),
    ]
    assert out[0]["tpm"] == 4 and out[0]["gameDate"] == "2016-01-02"


def test_box_score_cap_mixes_scorers_and_triple_doubles():
    players = [log_row(i, "GSW", f"{i:03}", "GSW vs. BOS", 40 + i, 2, 2) for i in range(8)]
    players += [log_row(100 + i, "GSW", f"{100 + i:03}", "GSW vs. BOS", 15, 10, 10) for i in range(8)]
    teams = []
    for r in players:
        teams += [
            {"GAME_ID": r["GAME_ID"], "TEAM_ABBREVIATION": "GSW", "PTS": 100},
            {"GAME_ID": r["GAME_ID"], "TEAM_ABBREVIATION": "BOS", "PTS": 90},
        ]
    out = tf.select_box_scores(players, teams, "2015-16", 10)
    assert len(out) == 10
    assert sum(1 for b in out if b["pts"] >= 40) == 5
    assert out[0]["pts"] == 47


def test_leaderboard_parsing():
    rows = [[100 + i, f"P{i}", 1000 - i * 10, i + 1, "N"] for i in range(10)]
    raw = {"resultSets": [rs(name, ["PLAYER_ID", "PLAYER_NAME", col, f"{col}_RANK", "IS_ACTIVE_FLAG"], rows)
                          for name, _, _, _, col in tf.LEADERBOARD_SETS]}
    lbs = tf.parse_leaderboards(raw, "2026-11-19")
    assert len(lbs) == 9
    pts = lbs[0]
    assert pts["id"] == "career-points" and pts["asOf"] == "2026-11-19"
    assert pts["rows"][0] == {"rank": 1, "playerId": "100", "value": 1000}
    assert [r["rank"] for r in pts["rows"]] == list(range(1, 11))


def test_teams_with_historical_franchise_and_colors():
    css = "--color-team-okc: #007ac1;\n--color-team-okc-fg: #ffffff;\n--color-team-sea: #00653a;\n--color-team-sea-fg: #ffc200;"
    colors = tf.parse_color_tokens(css)
    static = [{"abbreviation": "OKC", "full_name": "Oklahoma City Thunder", "city": "Oklahoma City"}]
    teams = tf.build_teams(["SEA", "OKC", "SEA"], static, colors)
    assert teams == [
        {"id": "OKC", "name": "Oklahoma City Thunder", "city": "Oklahoma City", "franchiseId": "OKC",
         "conference": "West", "primaryColor": "#007ac1", "secondaryColor": "#ffffff"},
        {"id": "SEA", "name": "Seattle SuperSonics", "city": "Seattle", "franchiseId": "OKC",
         "conference": "West", "primaryColor": "#00653a", "secondaryColor": "#ffc200"},
    ]


def test_window_games_count():
    assert tf.count_window_games([{"PLAYER_ID": 1}, {"PLAYER_ID": 1}, {"PLAYER_ID": 2}]) == {"1": 2, "2": 1}
