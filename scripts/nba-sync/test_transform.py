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


def test_stints_use_the_current_code_of_the_same_team():
    # stats.nba.com spells Utah UTH and Golden State GOS before 1996-97: still one stint per team.
    raw = career(
        [
            ("1994-95", "UTH"),
            ("1995-96", "UTH"),
            ("1996-97", "UTA"),
            ("1997-98", "GOS"),  # fixture: a legacy code after the switch is still the same team
            ("1998-99", "GSW"),
            ("1999-00", "IND"),
            ("2000-01", "GSW"),
            ("2001-02", "PHL"),
            ("2002-03", "SEA"),
        ]
    )
    stints = tf.career_stints("1", raw, {"UTH": "UTA", "GOS": "GSW", "PHL": "PHI"})
    assert [(s["teamId"], s["fromSeason"], s["toSeason"], s["order"]) for s in stints] == [
        ("UTA", "1994-95", "1996-97", 1),
        ("GSW", "1997-98", "1998-99", 2),
        ("IND", "1999-00", "1999-00", 3),
        ("GSW", "2000-01", "2000-01", 4),
        ("PHI", "2001-02", "2001-02", 5),
        ("SEA", "2002-03", "2002-03", 6),
    ]
    # Without aliases the legacy code stays a separate stint.
    assert [s["teamId"] for s in tf.career_stints("1", raw)] == [
        "UTH", "UTA", "GOS", "GSW", "IND", "GSW", "PHL", "SEA",
    ]
    rosters = tf.roster_entries("1", raw, alias={"UTH": "UTA"})
    assert [(e["teamId"], e["season"]) for e in rosters][:3] == [("UTA", "1994-95"), ("UTA", "1995-96"), ("UTA", "1996-97")]


def test_rosters_limited_to_window_and_deduplicated():
    raw = career([("1995-96", "LAL"), ("1996-97", "LAL"), ("1996-97", "TOT"), ("1997-98", "LAL")])
    entries = tf.roster_entries("1", raw, set(tf.window_seasons()))
    assert entries == [
        {"playerId": "1", "teamId": "LAL", "season": "1996-97"},
        {"playerId": "1", "teamId": "LAL", "season": "1997-98"},
    ]


def test_rosters_cover_the_whole_career_by_default():
    raw = career([("1969-70", "MIL"), ("1975-76", "LAL"), ("1975-76", "TOT")])
    assert [(e["teamId"], e["season"]) for e in tf.roster_entries("1", raw)] == [("MIL", "1969-70"), ("LAL", "1975-76")]


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


def leaders_raw(n_rows):
    rows = [[100 + i, f"P{i}", 1000 - i * 10, i + 1, "N"] for i in range(n_rows)]
    return {"resultSets": [rs(name, ["PLAYER_ID", "PLAYER_NAME", col, f"{col}_RANK", "IS_ACTIVE_FLAG"], rows)
                           for name, _, _, _, col in tf.LEADERBOARD_SETS]}


def test_leaderboard_parsing():
    lbs = tf.parse_leaderboards(leaders_raw(10), "2026-11-19")
    assert len(lbs) == 9
    pts = lbs[0]
    assert pts["id"] == "career-points" and pts["asOf"] == "2026-11-19"
    assert pts["scope"] == "all-time" and pts["source"] == "alltimeleadersgrids"
    assert pts["rows"][0] == {"rank": 1, "playerId": "100", "value": 1000}
    assert [r["rank"] for r in pts["rows"]] == list(range(1, 11))


def test_top_x_response_keeps_ten_rows_and_yields_the_legends_pool():
    raw = leaders_raw(50)
    assert all(len(lb["rows"]) == 10 for lb in tf.parse_leaderboards(raw, "2026-11-20"))
    assert tf.leader_ids(raw) == {str(100 + i) for i in range(50)}


GAMELOG_COLS = ["PLAYER_ID", "PTS", "REB", "AST", "STL", "BLK", "FG3M", "FTM", "FGM"]


def game(pid, pts, reb=0, ast=0, stl=0, blk=0, fg3m=0, ftm=0, fgm=0):
    return dict(zip(GAMELOG_COLS, [pid, pts, reb, ast, stl, blk, fg3m, ftm, fgm]))


def test_log_totals_and_active_candidate_screening():
    acc = {}
    tf.add_log_totals(acc, [game(1, 30, reb=10), game(1, 20), game(2, 50, blk=3)])
    tf.add_log_totals(acc, [game(2, 10), game(3, 99)])  # a later season adds up
    assert acc["1"] == {"PTS": 50, "REB": 10, "AST": 0, "STL": 0, "BLK": 0, "FG3M": 0, "GP": 2, "FTM": 0, "FGM": 0}
    assert acc["2"]["PTS"] == 60 and acc["2"]["GP"] == 2 and acc["2"]["BLK"] == 3
    # Player 3 leads in points but is not active; depth 1 → the top active player of each column.
    assert tf.screen_active_candidates(acc, {"1", "2"}, 1) == {"1", "2"}
    assert tf.screen_active_candidates(acc, {"1"}, 5) == {"1"}


def totals_raw(gp, pts, reb=0, ast=0, stl=0, blk=0, fg3m=0, ftm=0, fgm=0):
    headers = ["PLAYER_ID", "GP", "PTS", "REB", "AST", "STL", "BLK", "FG3M", "FTM", "FGM"]
    return {"resultSets": [rs("CareerTotalsRegularSeason", headers, [[1, gp, pts, reb, ast, stl, blk, fg3m, ftm, fgm]])]}


def test_active_leaderboards_rank_official_career_totals():
    assert tf.career_totals(totals_raw(1634, 43628.0, fg3m=2601)) == {
        "PTS": 43628, "REB": 0, "AST": 0, "STL": 0, "BLK": 0, "FG3M": 2601, "GP": 1634, "FTM": 0, "FGM": 0,
    }
    totals = {str(p): tf.career_totals(totals_raw(100 + p, 1000 * p, blk=7)) for p in range(1, 13)}
    lbs = tf.active_leaderboards(totals, "2026-11-20")
    assert len(lbs) == 9
    pts = next(lb for lb in lbs if lb["id"] == "active-career-points")
    assert pts["title"] == "Career Points — Active Players" and pts["statLabel"] == "PTS"
    assert pts["scope"] == "active" and pts["source"] == "playercareerstats" and pts["asOf"] == "2026-11-20"
    assert [r["playerId"] for r in pts["rows"]] == [str(p) for p in range(12, 2, -1)]
    assert pts["rows"][0] == {"rank": 1, "playerId": "12", "value": 12000}
    # Equal values keep a stable order (player id) so the snapshot is reproducible.
    blk = next(lb for lb in lbs if lb["id"] == "active-career-blocks")
    assert [r["playerId"] for r in blk["rows"]] == sorted(totals)[:10]
    # Fewer than ten players: no list.
    assert tf.active_leaderboards({"1": totals["1"]}, "2026-11-20") == []


def test_opening_night_starters():
    team_rows = [
        {"TEAM_ABBREVIATION": "BOS", "TEAM_ID": 1610612738, "GAME_ID": "0029600050", "GAME_DATE": "1996-11-05"},
        {"TEAM_ABBREVIATION": "BOS", "TEAM_ID": 1610612738, "GAME_ID": "0029600001", "GAME_DATE": "1996-11-01"},
        {"TEAM_ABBREVIATION": "CHI", "TEAM_ID": 1610612741, "GAME_ID": "0029600001", "GAME_DATE": "1996-11-01"},
    ]
    assert tf.opening_games(team_rows) == {
        "BOS": ("1610612738", "0029600001"),
        "CHI": ("1610612741", "0029600001"),
    }

    def side(team_id, positions):
        return {"teamId": team_id, "players": [{"personId": 10 * team_id + i, "position": p}
                                               for i, p in enumerate(positions)]}

    box = {"boxScoreTraditional": {"homeTeam": side(1, ["F", "F", "C", "G", "G", "", ""]),
                                   "awayTeam": side(2, ["F", "", "C", "G", "G", "F", ""])}}
    assert tf.opening_night_starters(box, "1") == ["10", "11", "12", "13", "14"]
    assert tf.opening_night_starters(box, "2") == ["20", "22", "23", "24", "25"]
    assert tf.opening_night_starters(box, "3") is None  # team not in this game
    short = {"boxScoreTraditional": {"homeTeam": side(1, ["F", "F", "C", "G", "", ""])}}
    assert tf.opening_night_starters(short, "1") is None  # starters not listed → no lineup
    assert tf.opening_lineup("BOS", "1996-97", ["10", "11", "12", "13", "14"]) == {
        "id": "BOS-1996-97-opener", "teamId": "BOS", "season": "1996-97",
        "playerIds": ["10", "11", "12", "13", "14"], "minutes": 0, "source": "boxscoretraditionalv3",
    }


FRANCHISE_HEADERS = ["LEAGUE_ID", "TEAM_ID", "TEAM_CITY", "TEAM_NAME", "START_YEAR", "END_YEAR"]


def franchise_raw():
    rows = [
        ["00", 1610612760, "Oklahoma City", "Thunder", "1967", "2026"],
        ["00", 1610612760, "Oklahoma City", "Thunder", "2008", "2026"],
        ["00", 1610612760, "Seattle", "SuperSonics", "1967", "2007"],
        ["00", 1610612762, "Utah", "Jazz", "1974", "2026"],
        ["00", 1610612762, "Utah", "Jazz", "1979", "2026"],
        ["00", 1610612762, "New Orleans", "Jazz", "1974", "1978"],
        ["00", 1610612758, "Sacramento", "Kings", "1948", "2026"],
        ["00", 1610612758, "Kansas City", "Kings", "1975", "1984"],
        ["00", 1610612758, "Kansas City-Omaha", "Kings", "1972", "1974"],
    ]
    defunct = [["00", 1610610024, "Baltimore", "Bullets", "1947", "1953"]]
    return {"resultSets": [rs("FranchiseHistory", FRANCHISE_HEADERS, rows), rs("DefunctTeams", FRANCHISE_HEADERS, defunct)]}


STATIC = [
    {"id": 1610612760, "abbreviation": "OKC", "full_name": "Oklahoma City Thunder", "city": "Oklahoma City"},
    {"id": 1610612762, "abbreviation": "UTA", "full_name": "Utah Jazz", "city": "Utah"},
    {"id": 1610612758, "abbreviation": "SAC", "full_name": "Sacramento Kings", "city": "Sacramento"},
]


def seen_teams(*entries):
    acc = {}
    for code, team_id, seasons in entries:
        for s in seasons:
            tf.note_team(acc, code, team_id, s)
    return acc


def test_team_identity_uses_the_period_of_the_seasons():
    periods = tf.team_periods(franchise_raw())
    assert tf.team_identity({"1990-91", "2005-06"}, periods["1610612760"]) == ("Seattle SuperSonics", "Seattle")
    assert tf.team_identity({"1976-77"}, periods["1610612762"]) == ("New Orleans Jazz", "New Orleans")
    assert tf.team_identity({"1980-81"}, periods["1610612762"]) == ("Utah Jazz", "Utah")
    # Most seasons win: KCK used 1973-74 and 1975-85 → Kansas City Kings.
    kck = {"1973-74", "1975-76", "1980-81", "1984-85"}
    assert tf.team_identity(kck, periods["1610612758"]) == ("Kansas City Kings", "Kansas City")
    assert tf.team_identity({"1950-51"}, periods["1610610024"]) == ("Baltimore Bullets", "Baltimore")
    assert tf.team_identity({"1930-31"}, periods["1610612760"]) is None


def test_team_aliases_only_for_the_same_team_under_another_code():
    seen = seen_teams(
        ("UTH", 1610612762, ["1990-91", "1995-96"]),
        ("UTA", 1610612762, ["1996-97"]),
        ("SEA", 1610612760, ["1999-00"]),
        ("OKC", 1610612760, ["2008-09"]),
        ("KCK", 1610612758, ["1980-81"]),
        ("SAC", 1610612758, ["1985-86"]),
    )
    periods = tf.team_periods(franchise_raw())
    assert tf.team_aliases(seen, STATIC, periods) == {"UTH": "UTA"}
    # Same name and franchise but the current code starts after a gap (CHH 1988-2002 vs CHA 2004-):
    # a different team, so no alias.
    gap = seen_teams(("UTH", 1610612762, ["1990-91"]), ("UTA", 1610612762, ["1996-97"]))
    assert tf.team_aliases(gap, STATIC, periods) == {}


def test_teams_with_historical_franchise_and_colors():
    css = (
        "--color-team-okc: #007ac1;\n--color-team-okc-fg: #ffffff;\n--color-team-sea: #00653a;\n"
        "--color-team-sea-fg: #ffc200;\n--color-team-kck: #c8102e;\n--color-team-kck-fg: #ffffff;\n"
        "--color-team-bal: #002b5c;\n--color-team-bal-fg: #ffffff;"
    )
    colors = tf.parse_color_tokens(css)
    seen = seen_teams(
        ("SEA", 1610612760, ["1999-00", "2007-08"]),
        ("KCK", 1610612758, ["1980-81"]),
        ("BAL", 1610610024, ["1950-51"]),
    )
    tf.CONFERENCE.setdefault("BAL", "East")  # fixture-only code for a defunct franchise
    try:
        teams, problems = tf.build_teams(["SEA", "OKC", "SEA", "KCK", "BAL"], STATIC, colors, seen,
                                         tf.team_periods(franchise_raw()))
    finally:
        del tf.CONFERENCE["BAL"]
    assert problems == []
    assert teams == [
        {"id": "BAL", "name": "Baltimore Bullets", "city": "Baltimore", "franchiseId": "BAL",
         "conference": "East", "primaryColor": "#002b5c", "secondaryColor": "#ffffff"},
        {"id": "KCK", "name": "Kansas City Kings", "city": "Kansas City", "franchiseId": "SAC",
         "conference": "West", "primaryColor": "#c8102e", "secondaryColor": "#ffffff"},
        {"id": "OKC", "name": "Oklahoma City Thunder", "city": "Oklahoma City", "franchiseId": "OKC",
         "conference": "West", "primaryColor": "#007ac1", "secondaryColor": "#ffffff"},
        {"id": "SEA", "name": "Seattle SuperSonics", "city": "Seattle", "franchiseId": "OKC",
         "conference": "West", "primaryColor": "#00653a", "secondaryColor": "#ffc200"},
    ]


def test_build_teams_reports_what_is_missing_instead_of_guessing():
    seen = seen_teams(("UTH", 1610612762, ["1990-91"]), ("XYZ", 1, ["1990-91"]), ("XYZ", 2, ["1991-92"]))
    teams, problems = tf.build_teams(["UTH", "XYZ", "QQQ"], STATIC, {}, seen, tf.team_periods(franchise_raw()))
    assert teams == []
    assert any(p.startswith("UTH (Utah Jazz, 1990-91…1990-91, franchise UTA): missing color tokens") for p in problems)
    assert any(p.startswith("XYZ: expected one stats.nba.com TEAM_ID") for p in problems)
    assert any(p.startswith("QQQ: expected one stats.nba.com TEAM_ID, found none") for p in problems)


def test_in_progress_season():
    import datetime as dt

    assert tf.in_progress_season(dt.date(2026, 11, 20)) == "2026-27"
    assert tf.in_progress_season(dt.date(2027, 3, 1)) == "2026-27"
    assert tf.in_progress_season(dt.date(2026, 8, 1)) == "2025-26"


def test_window_games_count():
    assert tf.count_window_games([{"PLAYER_ID": 1}, {"PLAYER_ID": 1}, {"PLAYER_ID": 2}]) == {"1": 2, "2": 1}
