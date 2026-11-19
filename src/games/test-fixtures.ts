// In-memory NbaDataSource for engine/service tests. Real players, teams and team-seasons; career
// averages, box score lines and leaderboard values are close approximations — TEST DATA ONLY,
// never shipped (production data comes from `npm run data:sync`, ISKELET §3.6).
import type {
  BoxScoreLine,
  CareerStats,
  CareerStint,
  Player,
  RosterEntry,
  StartingFive,
  StatLeaderboard,
  Team,
} from "@/data/schema";
import type { NbaDataSource, PlayerFilter } from "@/data/source";

const SOURCE = "test-fixture";
const FIRST_SEASON_START = 1996;
const LAST_SEASON_START = 2025;

// [id, name, city, franchiseId, conference, primary, secondary]
type TeamRow = [string, string, string, string, "East" | "West", string, string];
const TEAM_ROWS: TeamRow[] = [
  ["ATL", "Atlanta Hawks", "Atlanta", "ATL", "East", "#E03A3E", "#C1D32F"],
  ["BOS", "Boston Celtics", "Boston", "BOS", "East", "#007A33", "#BA9653"],
  ["BKN", "Brooklyn Nets", "Brooklyn", "BKN", "East", "#000000", "#FFFFFF"],
  ["CHA", "Charlotte Hornets", "Charlotte", "CHA", "East", "#1D1160", "#00788C"],
  ["CHI", "Chicago Bulls", "Chicago", "CHI", "East", "#CE1141", "#000000"],
  ["CLE", "Cleveland Cavaliers", "Cleveland", "CLE", "East", "#860038", "#FDBB30"],
  ["DAL", "Dallas Mavericks", "Dallas", "DAL", "West", "#00538C", "#002B5E"],
  ["DEN", "Denver Nuggets", "Denver", "DEN", "West", "#0E2240", "#FEC524"],
  ["DET", "Detroit Pistons", "Detroit", "DET", "East", "#C8102E", "#1D42BA"],
  ["GSW", "Golden State Warriors", "Golden State", "GSW", "West", "#1D428A", "#FFC72C"],
  ["HOU", "Houston Rockets", "Houston", "HOU", "West", "#CE1141", "#000000"],
  ["IND", "Indiana Pacers", "Indiana", "IND", "East", "#002D62", "#FDBB30"],
  ["LAC", "LA Clippers", "LA", "LAC", "West", "#C8102E", "#1D428A"],
  ["LAL", "Los Angeles Lakers", "Los Angeles", "LAL", "West", "#552583", "#FDB927"],
  ["MEM", "Memphis Grizzlies", "Memphis", "MEM", "West", "#5D76A9", "#12173F"],
  ["MIA", "Miami Heat", "Miami", "MIA", "East", "#98002E", "#F9A01B"],
  ["MIL", "Milwaukee Bucks", "Milwaukee", "MIL", "East", "#00471B", "#EEE1C6"],
  ["MIN", "Minnesota Timberwolves", "Minnesota", "MIN", "West", "#0C2340", "#236192"],
  ["NOP", "New Orleans Pelicans", "New Orleans", "NOP", "West", "#0C2340", "#C8102E"],
  ["NYK", "New York Knicks", "New York", "NYK", "East", "#006BB6", "#F58426"],
  ["OKC", "Oklahoma City Thunder", "Oklahoma City", "OKC", "West", "#007AC1", "#EF3B24"],
  ["ORL", "Orlando Magic", "Orlando", "ORL", "East", "#0077C0", "#C4CED4"],
  ["PHI", "Philadelphia 76ers", "Philadelphia", "PHI", "East", "#006BB6", "#ED174C"],
  ["PHX", "Phoenix Suns", "Phoenix", "PHX", "West", "#1D1160", "#E56020"],
  ["POR", "Portland Trail Blazers", "Portland", "POR", "West", "#E03A3E", "#000000"],
  ["SAC", "Sacramento Kings", "Sacramento", "SAC", "West", "#5A2D81", "#63727A"],
  ["SAS", "San Antonio Spurs", "San Antonio", "SAS", "West", "#C4CED4", "#000000"],
  ["TOR", "Toronto Raptors", "Toronto", "TOR", "East", "#CE1141", "#000000"],
  ["UTA", "Utah Jazz", "Utah", "UTA", "West", "#002B5C", "#F9A01B"],
  ["WAS", "Washington Wizards", "Washington", "WAS", "East", "#002B5C", "#E31837"],
  ["SEA", "Seattle SuperSonics", "Seattle", "OKC", "West", "#00653A", "#FFC200"],
  ["NJN", "New Jersey Nets", "New Jersey", "BKN", "East", "#002A60", "#CD1041"],
  ["NOH", "New Orleans Hornets", "New Orleans", "NOP", "West", "#0093B1", "#1D1160"],
];

// [id, name, position, fameTier, allStarCount, active]
type PlayerRow = [string, string, string, 1 | 2 | 3, number, boolean];
const PLAYER_ROWS: PlayerRow[] = [
  // Tier 1
  ["2544", "LeBron James", "F", 1, 21, true],
  ["201939", "Stephen Curry", "G", 1, 11, true],
  ["201142", "Kevin Durant", "F", 1, 15, true],
  ["202691", "Klay Thompson", "G", 1, 5, true],
  ["203110", "Draymond Green", "F", 1, 4, true],
  ["202681", "Kyrie Irving", "G", 1, 9, true],
  ["201567", "Kevin Love", "F", 1, 5, true],
  ["1495", "Tim Duncan", "F-C", 1, 15, false],
  ["2225", "Tony Parker", "G", 1, 6, false],
  ["202695", "Kawhi Leonard", "F", 1, 6, true],
  ["2548", "Dwyane Wade", "G", 1, 13, false],
  ["2547", "Chris Bosh", "F-C", 1, 11, false],
  ["951", "Ray Allen", "G", 1, 10, false],
  ["977", "Kobe Bryant", "G", 1, 18, false],
  ["2200", "Pau Gasol", "F-C", 1, 6, false],
  ["1717", "Dirk Nowitzki", "F", 1, 14, false],
  ["429", "Jason Kidd", "G", 1, 10, false],
  ["201935", "James Harden", "G", 1, 11, true],
  ["201566", "Russell Westbrook", "G", 1, 9, true],
  ["2546", "Carmelo Anthony", "F", 1, 10, false],
  ["2730", "Dwight Howard", "C", 1, 8, false],
  ["202331", "Paul George", "F", 1, 9, true],
  ["203507", "Giannis Antetokounmpo", "F", 1, 9, true],
  ["708", "Kevin Garnett", "F", 1, 15, false],
  ["1718", "Paul Pierce", "F", 1, 10, false],
  ["1890", "Shawn Marion", "F", 1, 4, false],
  ["1626164", "Devin Booker", "G", 1, 4, true],
  ["200765", "Rajon Rondo", "G", 1, 4, false],
  ["101108", "Chris Paul", "G", 1, 12, true],
  // Legends (leaderboards only)
  ["76003", "Kareem Abdul-Jabbar", "C", 1, 19, false],
  ["252", "Karl Malone", "F", 1, 14, false],
  ["893", "Michael Jordan", "G", 1, 14, false],
  ["76375", "Wilt Chamberlain", "C", 1, 13, false],
  ["406", "Shaquille O'Neal", "C", 1, 15, false],
  ["77449", "Moses Malone", "C", 1, 12, false],
  ["78049", "Bill Russell", "C", 1, 12, false],
  ["76979", "Elvin Hayes", "F-C", 1, 12, false],
  ["305", "Robert Parish", "C", 1, 9, false],
  ["304", "John Stockton", "G", 1, 10, false],
  ["959", "Steve Nash", "G", 1, 8, false],
  ["349", "Mark Jackson", "G", 2, 1, false],
  ["77142", "Magic Johnson", "G", 1, 12, false],
  ["600015", "Oscar Robertson", "G", 1, 12, false],
  ["78318", "Isiah Thomas", "G", 1, 12, false],
  ["56", "Gary Payton", "G", 1, 9, false],
  ["397", "Reggie Miller", "G", 1, 5, false],
  ["2594", "Kyle Korver", "G-F", 2, 1, false],
  ["1713", "Vince Carter", "G-F", 1, 8, false],
  ["203081", "Damian Lillard", "G", 1, 9, true],
  // Tier 2
  ["1938", "Manu Ginobili", "G", 2, 2, false],
  ["2738", "Andre Iguodala", "G-F", 2, 1, false],
  ["202684", "Tristan Thompson", "C", 2, 0, false],
  ["2747", "J.R. Smith", "G", 2, 0, false],
  ["203084", "Harrison Barnes", "F", 2, 0, true],
  ["101106", "Andrew Bogut", "C", 2, 0, false],
  ["201980", "Danny Green", "G-F", 2, 0, false],
  ["2203", "Shane Battier", "F", 2, 0, false],
  ["201596", "Mario Chalmers", "G", 2, 0, false],
  ["965", "Derek Fisher", "G", 2, 0, false],
  ["1897", "Metta World Peace", "F", 2, 1, false],
  ["101115", "Andrew Bynum", "C", 2, 1, false],
  ["2199", "Tyson Chandler", "C", 2, 1, false],
  ["1891", "Jason Terry", "G", 2, 0, false],
  ["201586", "Serge Ibaka", "F-C", 2, 0, false],
  ["2570", "Kendrick Perkins", "C", 2, 0, false],
  ["200757", "Thabo Sefolosha", "G-F", 2, 0, false],
  ["2585", "Zaza Pachulia", "C", 2, 1, false],
  ["2617", "Udonis Haslem", "F", 2, 0, false],
  ["1885", "Lamar Odom", "F", 2, 0, false],
  ["2571", "Leandro Barbosa", "G", 2, 0, false],
  // Tier 3
  ["201168", "Tiago Splitter", "C", 3, 0, false],
  ["203105", "Festus Ezeli", "C", 3, 0, false],
  ["203521", "Matthew Dellavedova", "G", 3, 0, false],
  ["202389", "Timofey Mozgov", "C", 3, 0, false],
  ["202697", "Iman Shumpert", "G", 3, 0, false],
  ["2756", "Sasha Vujacic", "G", 3, 0, false],
  ["200770", "Jordan Farmar", "G", 3, 0, false],
  ["2052", "DeShawn Stevenson", "G", 3, 0, false],
];

// playerId → [[teamId, fromSeasonStartYear, toSeasonStartYear], ...] in career order.
type StintRow = [string, number, number];
const STINT_ROWS: Record<string, StintRow[]> = {
  "2544": [["CLE", 2003, 2009], ["MIA", 2010, 2013], ["CLE", 2014, 2017], ["LAL", 2018, 2025]],
  "201939": [["GSW", 2009, 2025]],
  "201142": [["SEA", 2007, 2007], ["OKC", 2008, 2015], ["GSW", 2016, 2018], ["BKN", 2020, 2022], ["PHX", 2022, 2024], ["HOU", 2025, 2025]],
  "202691": [["GSW", 2011, 2023], ["DAL", 2024, 2025]],
  "203110": [["GSW", 2012, 2025]],
  "202681": [["CLE", 2011, 2016], ["BOS", 2017, 2018], ["BKN", 2019, 2022], ["DAL", 2022, 2025]],
  "201567": [["MIN", 2008, 2013], ["CLE", 2014, 2022], ["MIA", 2022, 2024]],
  "1495": [["SAS", 1997, 2015]],
  "2225": [["SAS", 2001, 2017], ["CHA", 2018, 2018]],
  "202695": [["SAS", 2011, 2017], ["TOR", 2018, 2018], ["LAC", 2019, 2025]],
  "2548": [["MIA", 2003, 2015], ["CHI", 2016, 2016], ["CLE", 2017, 2017], ["MIA", 2017, 2018]],
  "2547": [["TOR", 2003, 2009], ["MIA", 2010, 2015]],
  "951": [["MIL", 1996, 2002], ["SEA", 2002, 2006], ["BOS", 2007, 2011], ["MIA", 2012, 2013]],
  "977": [["LAL", 1996, 2015]],
  "2200": [["MEM", 2001, 2007], ["LAL", 2007, 2013], ["CHI", 2014, 2015], ["SAS", 2016, 2018], ["MIL", 2018, 2018]],
  "1717": [["DAL", 1998, 2018]],
  "429": [["DAL", 1994, 1996], ["PHX", 1996, 2000], ["NJN", 2001, 2007], ["DAL", 2007, 2011], ["NYK", 2012, 2012]],
  "201935": [["OKC", 2009, 2011], ["HOU", 2012, 2020], ["BKN", 2020, 2021], ["PHI", 2021, 2022], ["LAC", 2023, 2025]],
  "201566": [["OKC", 2008, 2018], ["HOU", 2019, 2019], ["WAS", 2020, 2020], ["LAL", 2021, 2022], ["LAC", 2022, 2023], ["DEN", 2024, 2024], ["SAC", 2025, 2025]],
  "2546": [["DEN", 2003, 2010], ["NYK", 2010, 2016], ["OKC", 2017, 2017], ["HOU", 2018, 2018], ["POR", 2019, 2020], ["LAL", 2021, 2021]],
  "2730": [["ORL", 2004, 2011], ["LAL", 2012, 2012], ["HOU", 2013, 2015], ["ATL", 2016, 2016], ["CHA", 2017, 2017], ["WAS", 2018, 2018], ["LAL", 2019, 2019], ["PHI", 2020, 2020], ["LAL", 2021, 2021]],
  "202331": [["IND", 2010, 2016], ["OKC", 2017, 2018], ["LAC", 2019, 2023], ["PHI", 2024, 2025]],
  "203507": [["MIL", 2013, 2025]],
  "708": [["MIN", 1995, 2006], ["BOS", 2007, 2012], ["BKN", 2013, 2014], ["MIN", 2014, 2015]],
  "1718": [["BOS", 1998, 2012], ["BKN", 2013, 2013], ["WAS", 2014, 2014], ["LAC", 2015, 2016]],
  "1890": [["PHX", 1999, 2007], ["MIA", 2007, 2008], ["TOR", 2008, 2008], ["DAL", 2009, 2013], ["CLE", 2014, 2014]],
  "1626164": [["PHX", 2015, 2025]],
  "200765": [["BOS", 2006, 2014], ["DAL", 2014, 2014], ["SAC", 2015, 2015], ["CHI", 2016, 2016], ["NOP", 2017, 2017], ["LAL", 2018, 2019], ["ATL", 2020, 2020], ["LAC", 2020, 2020], ["LAL", 2021, 2021], ["CLE", 2021, 2021]],
  "1938": [["SAS", 2002, 2017]],
  "2738": [["PHI", 2004, 2011], ["DEN", 2012, 2012], ["GSW", 2013, 2018], ["MIA", 2019, 2020], ["GSW", 2021, 2022]],
  "202684": [["CLE", 2011, 2019], ["BOS", 2020, 2020], ["SAC", 2021, 2021], ["IND", 2021, 2021], ["CHI", 2021, 2021], ["LAL", 2022, 2022], ["CLE", 2023, 2024]],
  "2747": [["NOH", 2004, 2005], ["DEN", 2006, 2010], ["NYK", 2011, 2014], ["CLE", 2014, 2018], ["LAL", 2019, 2019]],
  "203084": [["GSW", 2012, 2015], ["DAL", 2016, 2018], ["SAC", 2018, 2023], ["SAS", 2024, 2025]],
  "101106": [["MIL", 2005, 2011], ["GSW", 2012, 2015], ["DAL", 2016, 2016], ["CLE", 2016, 2016], ["LAL", 2017, 2017], ["GSW", 2018, 2018]],
  "201980": [["CLE", 2009, 2009], ["SAS", 2010, 2017], ["TOR", 2018, 2018], ["LAL", 2019, 2019], ["PHI", 2020, 2021], ["MEM", 2022, 2022], ["CLE", 2022, 2022], ["PHI", 2023, 2023]],
  "2203": [["MEM", 2001, 2005], ["HOU", 2006, 2010], ["MEM", 2010, 2010], ["MIA", 2011, 2013]],
  "201596": [["MIA", 2008, 2015], ["MEM", 2015, 2015], ["MEM", 2017, 2017]],
  "965": [["LAL", 1996, 2003], ["GSW", 2004, 2005], ["UTA", 2006, 2006], ["LAL", 2007, 2011], ["OKC", 2011, 2011], ["DAL", 2012, 2012], ["OKC", 2012, 2013]],
  "1897": [["CHI", 1999, 2001], ["IND", 2001, 2005], ["SAC", 2005, 2007], ["HOU", 2008, 2008], ["LAL", 2009, 2012], ["NYK", 2013, 2013], ["LAL", 2015, 2016]],
  "101115": [["LAL", 2005, 2011], ["CLE", 2013, 2013], ["IND", 2013, 2013]],
  "2199": [["CHI", 2001, 2005], ["NOH", 2006, 2008], ["CHA", 2009, 2009], ["DAL", 2010, 2010], ["NYK", 2011, 2013], ["DAL", 2014, 2014], ["PHX", 2015, 2017], ["LAL", 2018, 2018], ["HOU", 2019, 2019]],
  "1891": [["ATL", 1999, 2003], ["DAL", 2004, 2011], ["BOS", 2012, 2012], ["BKN", 2013, 2013], ["HOU", 2014, 2015], ["MIL", 2016, 2017]],
  "201586": [["OKC", 2009, 2015], ["ORL", 2016, 2016], ["TOR", 2016, 2019], ["LAC", 2020, 2021], ["MIL", 2021, 2021]],
  "2570": [["BOS", 2003, 2010], ["OKC", 2010, 2014], ["CLE", 2014, 2014], ["NOP", 2015, 2015], ["CLE", 2017, 2017]],
  "200757": [["CHI", 2006, 2008], ["OKC", 2008, 2013], ["ATL", 2014, 2016], ["UTA", 2017, 2018], ["HOU", 2019, 2019]],
  "2585": [["ORL", 2003, 2003], ["MIL", 2004, 2004], ["ATL", 2005, 2012], ["MIL", 2013, 2014], ["DAL", 2015, 2015], ["GSW", 2016, 2017], ["DET", 2018, 2018]],
  "2617": [["MIA", 2003, 2022]],
  "1885": [["LAC", 1999, 2002], ["MIA", 2003, 2003], ["LAL", 2004, 2010], ["DAL", 2011, 2011], ["LAC", 2012, 2012]],
  "2571": [["PHX", 2003, 2009], ["TOR", 2010, 2011], ["IND", 2011, 2011], ["BOS", 2012, 2012], ["PHX", 2013, 2013], ["GSW", 2014, 2015], ["PHX", 2016, 2016]],
  "201168": [["SAS", 2010, 2014], ["ATL", 2015, 2015], ["PHI", 2016, 2016]],
  "203105": [["GSW", 2012, 2015]],
  "203521": [["CLE", 2013, 2015], ["MIL", 2016, 2018], ["CLE", 2018, 2019], ["SAC", 2022, 2022]],
  "202389": [["NYK", 2010, 2010], ["DEN", 2010, 2014], ["CLE", 2014, 2015], ["LAL", 2016, 2016], ["BKN", 2017, 2017]],
  "202697": [["NYK", 2011, 2014], ["CLE", 2014, 2017], ["SAC", 2018, 2018], ["HOU", 2018, 2018], ["BKN", 2019, 2019]],
  "2756": [["LAL", 2004, 2009], ["NJN", 2010, 2010]],
  "200770": [["LAL", 2006, 2009], ["NJN", 2010, 2011], ["LAL", 2013, 2013], ["LAC", 2014, 2014]],
  "2052": [["UTA", 2000, 2003], ["ORL", 2003, 2005], ["WAS", 2006, 2009], ["DAL", 2009, 2010], ["NJN", 2011, 2011], ["ATL", 2012, 2012]],
  "406": [["ORL", 1992, 1995], ["LAL", 1996, 2003], ["MIA", 2004, 2007], ["PHX", 2007, 2008], ["CLE", 2009, 2009], ["BOS", 2010, 2010]],
  "252": [["UTA", 1985, 2002], ["LAL", 2003, 2003]],
};

// [playerId, games, seasons, ppg, rpg, apg, spg, bpg, fgPct]
type CareerRow = [string, number, number, number, number, number, number, number, number];
const CAREER_ROWS: CareerRow[] = [
  ["2544", 1562, 23, 27.0, 7.5, 7.4, 1.5, 0.7, 50.6],
  ["201939", 1026, 17, 24.8, 4.7, 6.4, 1.5, 0.2, 47.3],
  ["201142", 1123, 18, 27.2, 7.0, 4.4, 1.1, 1.1, 50.2],
  ["202691", 900, 14, 19.0, 3.5, 2.3, 0.8, 0.5, 45.3],
  ["203110", 900, 14, 8.6, 6.9, 5.5, 1.3, 0.9, 46.1],
  ["202681", 800, 15, 23.6, 3.9, 5.7, 1.3, 0.4, 47.3],
  ["201567", 900, 17, 16.5, 10.3, 2.3, 0.6, 0.4, 44.0],
  ["1495", 1392, 19, 19.0, 10.8, 3.0, 0.7, 2.2, 50.6],
  ["2225", 1254, 18, 15.5, 2.7, 5.6, 0.8, 0.1, 49.1],
  ["202695", 750, 14, 20.0, 6.3, 3.0, 1.7, 0.6, 49.5],
  ["2548", 1054, 16, 22.0, 4.7, 5.4, 1.5, 0.8, 48.0],
  ["2547", 893, 13, 19.2, 8.5, 2.0, 0.8, 1.0, 49.4],
  ["951", 1300, 18, 18.9, 4.1, 3.4, 1.1, 0.2, 45.2],
  ["977", 1346, 20, 25.0, 5.2, 4.7, 1.4, 0.5, 44.7],
  ["2200", 1226, 18, 17.0, 9.2, 3.2, 0.5, 1.6, 50.7],
  ["1717", 1522, 21, 20.7, 7.5, 2.4, 0.8, 0.8, 47.1],
  ["429", 1391, 19, 12.6, 6.3, 8.7, 1.9, 0.3, 40.0],
  ["201935", 1150, 17, 24.1, 5.6, 7.1, 1.5, 0.5, 44.2],
  ["201566", 1270, 18, 21.7, 7.0, 8.1, 1.6, 0.3, 43.8],
  ["2546", 1260, 19, 22.5, 6.2, 2.7, 1.0, 0.5, 44.7],
  ["2730", 1242, 18, 15.7, 11.8, 1.3, 0.9, 1.8, 58.6],
  ["202331", 900, 16, 20.6, 6.3, 3.7, 1.6, 0.4, 44.0],
  ["203507", 840, 13, 23.5, 9.8, 4.9, 1.1, 1.2, 54.8],
  ["708", 1462, 21, 17.8, 10.0, 3.7, 1.3, 1.4, 49.7],
  ["1718", 1343, 19, 19.7, 5.6, 3.5, 1.3, 0.6, 44.5],
  ["1890", 1163, 16, 15.2, 8.7, 1.9, 1.5, 1.1, 48.4],
  ["200765", 957, 16, 9.8, 4.5, 7.9, 1.6, 0.1, 45.7],
  ["1626164", 750, 11, 24.3, 4.2, 5.0, 0.9, 0.3, 46.8],
  ["1938", 1057, 16, 13.3, 3.5, 3.8, 1.2, 0.3, 44.7],
  ["2738", 1231, 19, 11.3, 4.9, 4.2, 1.4, 0.5, 46.4],
  ["203084", 1000, 14, 14.3, 5.2, 1.6, 0.6, 0.2, 46.0],
  ["2747", 975, 16, 12.4, 3.0, 2.1, 0.9, 0.2, 41.9],
  ["2199", 1160, 19, 8.2, 9.0, 0.9, 0.5, 1.2, 59.7],
  ["1891", 1410, 19, 13.4, 2.3, 3.8, 1.1, 0.2, 44.0],
  ["201168", 355, 7, 7.4, 4.6, 1.2, 0.5, 0.6, 54.8],
  ["203105", 199, 4, 5.0, 4.7, 0.4, 0.3, 0.9, 54.0],
  ["202697", 540, 10, 6.9, 3.2, 1.4, 1.1, 0.3, 39.4],
];

// [id, playerId, date, season, teamId, oppId, teamScore, oppScore, min, pts, reb, ast, stl, blk, fgm, fga, tpm, tpa]
type BoxRow = [string, string, string, string, string, string, number, number, number, number, number, number, number, number, number, number, number, number];
const BOX_ROWS: BoxRow[] = [
  ["bs-kobe-81", "977", "2006-01-22", "2005-06", "LAL", "TOR", 122, 104, 42, 81, 6, 2, 3, 1, 28, 46, 7, 13],
  ["bs-kobe-60", "977", "2016-04-13", "2015-16", "LAL", "UTA", 101, 96, 42, 60, 4, 4, 1, 1, 22, 50, 6, 21],
  ["bs-klay-60", "202691", "2016-12-05", "2016-17", "GSW", "IND", 142, 106, 29, 60, 3, 2, 2, 0, 21, 33, 8, 14],
  ["bs-curry-46", "201939", "2016-02-27", "2015-16", "GSW", "OKC", 121, 118, 46, 46, 2, 6, 2, 0, 14, 24, 12, 16],
  ["bs-booker-70", "1626164", "2017-03-24", "2016-17", "PHX", "BOS", 120, 130, 45, 70, 8, 6, 3, 1, 21, 40, 4, 11],
  ["bs-harden-60", "201935", "2018-01-30", "2017-18", "HOU", "ORL", 114, 107, 46, 60, 10, 11, 4, 1, 19, 30, 5, 14],
  ["bs-lebron-61", "2544", "2014-03-03", "2013-14", "MIA", "CHA", 124, 107, 41, 61, 7, 5, 1, 0, 22, 33, 8, 10],
  ["bs-giannis-64", "203507", "2023-12-13", "2023-24", "MIL", "IND", 140, 126, 37, 64, 14, 3, 0, 4, 20, 28, 0, 1],
  ["bs-westbrook-50", "201566", "2017-04-09", "2016-17", "OKC", "DEN", 106, 105, 46, 50, 16, 10, 1, 0, 17, 34, 4, 9],
  ["bs-durant-54", "201142", "2014-01-17", "2013-14", "OKC", "GSW", 127, 121, 41, 54, 6, 4, 1, 0, 19, 28, 4, 8],
  ["bs-dirk-53", "1717", "2004-12-02", "2004-05", "DAL", "HOU", 113, 106, 48, 53, 16, 1, 0, 1, 15, 32, 1, 5],
];

// [id, title, statLabel, [playerId, value][] (rank order)]
type BoardRow = [string, string, string, [string, number][]];
const BOARD_ROWS: BoardRow[] = [
  ["career-pts", "Career Points", "PTS", [
    ["2544", 40474], ["76003", 38387], ["252", 36928], ["977", 33643], ["893", 32292],
    ["1717", 31560], ["76375", 31419], ["406", 28596], ["2546", 28289], ["77449", 27409],
  ]],
  ["career-fg3m", "Career 3-Pointers Made", "3PM", [
    ["201939", 3747], ["951", 2973], ["201935", 2852], ["203081", 2804], ["397", 2560],
    ["202691", 2481], ["2594", 2450], ["2544", 2410], ["1713", 2290], ["1891", 2282],
  ]],
  ["career-reb", "Career Rebounds", "REB", [
    ["76375", 23924], ["78049", 21620], ["76003", 17440], ["76979", 16279], ["77449", 16212],
    ["1495", 15091], ["252", 14968], ["305", 14715], ["708", 14662], ["2730", 14627],
  ]],
  ["career-ast", "Career Assists", "AST", [
    ["304", 15806], ["101108", 12188], ["429", 12091], ["2544", 11009], ["959", 10335],
    ["349", 10334], ["77142", 10141], ["600015", 9887], ["78318", 9061], ["56", 8966],
  ]],
];

// [teamId, seasonStartYear, playerIds[5]] — the five-man unit with the most minutes that season.
type LineupRow = [string, number, [string, string, string, string, string]];
const LINEUP_ROWS: LineupRow[] = [
  ["GSW", 2015, ["201939", "202691", "203084", "203110", "101106"]],
  ["GSW", 2016, ["201939", "202691", "201142", "203110", "2585"]],
  ["CLE", 2015, ["202681", "2747", "2544", "201567", "202684"]],
  ["SAS", 2013, ["2225", "201980", "202695", "1495", "201168"]],
  ["MIA", 2012, ["201596", "2548", "2544", "2203", "2547"]],
  ["LAL", 2009, ["965", "977", "1897", "2200", "101115"]],
  ["DAL", 2010, ["429", "2052", "1890", "1717", "2199"]],
  ["OKC", 2011, ["201566", "200757", "201142", "201586", "2570"]],
  ["OKC", 2012, ["201566", "200757", "201142", "201586", "2570"]],
  ["CLE", 2016, ["202681", "2747", "2544", "201567", "202684"]],
  ["BOS", 2007, ["200765", "951", "1718", "708", "2570"]],
  ["GSW", 2017, ["201939", "202691", "201142", "203110", "2585"]],
];

export function seasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function createFixtureDataSource(): NbaDataSource {
  const teams: Team[] = TEAM_ROWS.map(([id, name, city, franchiseId, conference, primaryColor, secondaryColor]) => ({
    id,
    name,
    city,
    franchiseId,
    conference,
    primaryColor,
    secondaryColor,
  }));
  const players: Player[] = PLAYER_ROWS.map(([id, name, position, fameTier, allStarCount, active]) => ({
    id,
    name,
    position,
    fameTier,
    allStarCount,
    active,
    headshotId: id,
  }));

  const stints: CareerStint[] = Object.entries(STINT_ROWS).flatMap(([playerId, rows]) =>
    rows.map(([teamId, from, to], i) => ({
      playerId,
      teamId,
      fromSeason: seasonLabel(from),
      toSeason: seasonLabel(to),
      order: i + 1,
    })),
  );

  // Rosters derived from stints, limited to the dataset's season range (ISKELET V1).
  const rosters: RosterEntry[] = [];
  const rosterKeys = new Set<string>();
  for (const [playerId, rows] of Object.entries(STINT_ROWS)) {
    for (const [teamId, from, to] of rows) {
      for (let y = Math.max(from, FIRST_SEASON_START); y <= Math.min(to, LAST_SEASON_START); y++) {
        const key = `${playerId}:${teamId}:${y}`;
        if (rosterKeys.has(key)) continue;
        rosterKeys.add(key);
        rosters.push({ playerId, teamId, season: seasonLabel(y) });
      }
    }
  }

  const careerStats: CareerStats[] = CAREER_ROWS.map(([playerId, games, seasons, ppg, rpg, apg, spg, bpg, fgPct]) => ({
    playerId,
    games,
    seasons,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    fgPct,
    source: SOURCE,
  }));

  const boxScores: BoxScoreLine[] = BOX_ROWS.map(
    ([id, playerId, gameDate, season, teamId, opponentId, teamScore, opponentScore, min, pts, reb, ast, stl, blk, fgm, fga, tpm, tpa]) => ({
      id,
      playerId,
      gameId: `game-${id}`,
      gameDate,
      season,
      teamId,
      opponentId,
      teamScore,
      opponentScore,
      min,
      pts,
      reb,
      ast,
      stl,
      blk,
      fgm,
      fga,
      tpm,
      tpa,
      source: SOURCE,
    }),
  );

  const leaderboards: StatLeaderboard[] = BOARD_ROWS.map(([id, title, statLabel, rows]) => ({
    id,
    title,
    statLabel,
    asOf: "2024-06-30",
    rows: rows.map(([playerId, value], i) => ({ rank: i + 1, playerId, value })),
    source: SOURCE,
  }));

  const startingFives: StartingFive[] = LINEUP_ROWS.map(([teamId, year, playerIds]) => ({
    id: `${teamId}-${seasonLabel(year)}`,
    teamId,
    season: seasonLabel(year),
    playerIds: [...playerIds],
    minutes: 800,
    source: SOURCE,
  }));

  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const statsById = new Map(careerStats.map((s) => [s.playerId, s]));
  const rostersByPlayer = new Map<string, RosterEntry[]>();
  const rostersByTeamSeason = new Map<string, string[]>();
  for (const r of rosters) {
    rostersByPlayer.set(r.playerId, [...(rostersByPlayer.get(r.playerId) ?? []), r]);
    const k = `${r.teamId}:${r.season}`;
    rostersByTeamSeason.set(k, [...(rostersByTeamSeason.get(k) ?? []), r.playerId]);
  }

  return {
    meta: { snapshotDate: "2026-11-19", source: SOURCE, endpoints: ["fixture"] },
    getTeams: () => teams,
    getTeam: (id) => teamById.get(id),
    getPlayers: (filter?: PlayerFilter) =>
      filter?.maxFameTier === undefined ? players : players.filter((p) => p.fameTier <= (filter.maxFameTier ?? 3)),
    getPlayer: (id) => playerById.get(id),
    searchPlayers: (query, limit = 10) => {
      const q = normalize(query.trim());
      if (!q) return [];
      return players.filter((p) => normalize(p.name).includes(q)).slice(0, limit);
    },
    getStartingFives: () => startingFives,
    getCareerStints: (playerId) => stints.filter((s) => s.playerId === playerId).sort((a, b) => a.order - b.order),
    getPlayersWithStints: (minTeams) =>
      players.filter((p) => new Set(stints.filter((s) => s.playerId === p.id).map((s) => s.teamId)).size >= minTeams),
    getCareerStats: (playerId) => statsById.get(playerId),
    getPlayersWithCareerStats: () => players.filter((p) => statsById.has(p.id)),
    getRosterEntries: (playerId) => rostersByPlayer.get(playerId) ?? [],
    getTeammates: (playerId, teamId, season) =>
      (rostersByTeamSeason.get(`${teamId}:${season}`) ?? [])
        .filter((id) => id !== playerId)
        .map((id) => playerById.get(id))
        .filter((p): p is Player => p !== undefined),
    getBoxScores: () => boxScores,
    getLeaderboards: () => leaderboards,
  };
}
