// English UI strings — the source of truth for the dictionary shape (ISKELET F18).
// tr.ts is typed as `Messages`, so a key missing there is a compile error.
// Interpolated strings are functions; game mode names, stat abbreviations, team codes and player
// names are not in here because they stay English in every language.
import {
  CURRENT_ERA_LINEUP_SEASONS,
  SESSION_LENGTH,
  TOP10_LISTS_PER_SESSION,
  TOP10_TIME_LIMIT_SEC,
} from "@/games/core/difficulty";
import type { Era, GameMode } from "@/games/core/types";
import { plural } from "./plural";

export interface ModeCopy {
  /** Games grid card description */
  cardDesc: string;
  /** Home "Featured games" description */
  featuredDesc: string;
  rules: [string, string];
  /** Intro (Game Detail phase a) */
  introDesc: string;
  introRule: string;
  lengthLabel: string;
  /** Card flavour line for each era (F16). */
  eraDesc: Record<Era, string>;
  /** Intro rule line for each era: what the era changes in this mode (F16). */
  eraRule: Record<Era, string>;
}

export type AchievementCopyId =
  | "first-game"
  | "perfect-10"
  | "streak-5"
  | "streak-10"
  | "expert-win"
  | "all-modes"
  | "daily-3"
  | "points-10k";

const questionsLabel = `${SESSION_LENGTH} questions`;
const recentLineups = `the last ${CURRENT_ERA_LINEUP_SEASONS} seasons`;

const modes: Record<GameMode, ModeCopy> = {
  "starting-five": {
    cardDesc: "A real opening-night lineup with one slot left blank.",
    featuredDesc: "Four starters are on the floor. Name the fifth.",
    rules: ["See 4 starters: name, position, photo", "Find the missing fifth player"],
    introDesc: "A real opening-night lineup with one slot left blank. Name the missing starter.",
    introRule: "You see 4 starters with name, position and photo.",
    lengthLabel: questionsLabel,
    eraDesc: {
      current: `Lineups from ${recentLineups}.`,
      retired: "Classic lineups from earlier seasons.",
    },
    eraRule: {
      current: `Lineups from ${recentLineups}; the missing starter is still active.`,
      retired: "Classic lineups; the missing starter has retired.",
    },
  },
  "team-journey": {
    cardDesc: "Follow a career stop by stop and name the traveller.",
    featuredDesc: "Follow a career stop by stop and name the traveller.",
    rules: ["Teams shown in order with years", "Guess the player"],
    introDesc: "Every stop of a career, in order. Who made the trip?",
    introRule: "Teams appear on a timeline with the years spent there.",
    lengthLabel: questionsLabel,
    eraDesc: { current: "Careers still being written.", retired: "Finished careers, every stop." },
    eraRule: {
      current: "The traveller is an active player.",
      retired: "The traveller has retired.",
    },
  },
  "teammate-challenge": {
    cardDesc: "Who shared a locker room with all of them?",
    featuredDesc: "Who shared a locker room with all of them?",
    rules: ["2–5 teammates with team and season", "Name the common player"],
    introDesc: "Two to five teammates, one common link. Find him.",
    introRule: "Each card shows a teammate with the team and seasons they shared.",
    lengthLabel: questionsLabel,
    eraDesc: { current: "Today's locker rooms.", retired: "Old locker rooms, retired links." },
    eraRule: {
      current: "The common link is an active player.",
      retired: "The common link has retired.",
    },
  },
  "career-stats": {
    cardDesc: "A career told in averages. No names, just numbers.",
    featuredDesc: "PPG, RPG, APG and more. Whose career is it?",
    rules: ["PPG, RPG, APG, SPG, BPG, FG%", "Games, seasons and position"],
    introDesc: "A whole career in averages. No names, just numbers.",
    introRule: "PPG, RPG, APG, SPG, BPG, FG%, games, seasons and position.",
    lengthLabel: questionsLabel,
    eraDesc: { current: "Numbers still climbing.", retired: "Whole legacies in averages." },
    eraRule: {
      current: "An active player's career so far.",
      retired: "A finished career: the player has retired.",
    },
  },
  "box-score": {
    cardDesc: "One stat line from a real game. Whose night was it?",
    featuredDesc: "One stat line from a real game. Whose night was it?",
    rules: ["MIN, PTS, REB, AST, STL, BLK, FG, 3P", "Date, matchup and final score"],
    introDesc: "One player's line from a real game. Whose night was it?",
    introRule: "Classic box score row plus date, matchup and final score.",
    lengthLabel: questionsLabel,
    eraDesc: {
      current: "Big nights by players in the league today.",
      retired: "Classic nights by retired players.",
    },
    eraRule: {
      current: "The line belongs to an active player.",
      retired: "The line belongs to a retired player.",
    },
  },
  "top-10": {
    cardDesc: "An all-time ranking with gaps. Fill every blank.",
    featuredDesc: "Fill the blanks in an all-time ranking before the clock runs out.",
    rules: [
      `${TOP10_LISTS_PER_SESSION} lists, ${TOP10_TIME_LIMIT_SEC} seconds each`,
      "Points for every hidden row you fill",
    ],
    introDesc: "An all-time ranking with gaps. Fill every hidden row before time runs out.",
    introRule: `Pick a player for every blank row. Each list has ${TOP10_TIME_LIMIT_SEC} seconds.`,
    lengthLabel: `${TOP10_LISTS_PER_SESSION} lists · ${TOP10_TIME_LIMIT_SEC}s`,
    eraDesc: {
      current: "Career leaders among active players.",
      retired: "All-time lists. Fill in the legends.",
    },
    eraRule: {
      current: "Lists rank active players only.",
      retired: "All-time lists; only retired players are hidden.",
    },
  },
};

const achievements: Record<AchievementCopyId, { name: string; description: string }> = {
  "first-game": { name: "First Game", description: "Finish your first game." },
  "perfect-10": {
    name: "Perfect 10",
    description: "Answer every question of a game correctly.",
  },
  "streak-5": { name: "Streak 5", description: "Get 5 correct answers in a row." },
  "streak-10": { name: "Streak 10", description: "Get 10 correct answers in a row." },
  "expert-win": { name: "Expert Win", description: "Score at least 7/10 on Expert." },
  "all-modes": { name: "All Modes", description: "Finish a game in all 6 modes." },
  "daily-3": { name: "Daily 3", description: "Play the Daily Challenge 3 days in a row." },
  "points-10k": { name: "10K Points", description: "Reach 10,000 total points." },
};

export const en = {
  meta: {
    siteDescription:
      "Test your NBA knowledge across six trivia games, a daily challenge and a leaderboard.",
    homeTitle: "NBA Games — trivia built from real box scores",
    gamesTitle: "Games",
    gamesDescription: "Six ways to test your NBA knowledge. Every mode has four difficulty levels.",
    dailyTitle: "Daily Challenge",
    dailyDescription: "Five mixed questions, the same for everyone. One attempt per day.",
    leaderboardTitle: "Leaderboard",
    leaderboardDescription: "Top 100 players: all time, this week and today.",
    profileTitle: "Profile",
    profileDescription: "Your points, streaks, badges and game history.",
    notFoundTitle: "Not found",
    pageNotFoundTitle: "Page not found",
  },
  nav: {
    home: "Home",
    games: "Games",
    daily: "Daily",
    leaderboard: "Leaderboard",
    profile: "Profile",
    /** BottomTabBar's shorter Leaderboard label. */
    ranksTab: "Ranks",
    mainLabel: "Main",
    homeLabel: "NBA Games home",
    profileLabel: "Your profile",
    totalPointsLabel: (points: string) => `Your total points: ${points}`,
    guest: "Guest",
  },
  language: {
    label: "Language",
    names: { en: "English", tr: "Türkçe" },
  },
  footer: {
    dataUpdated: "NBA data updated",
    disclaimer: "NBA Games is a fan project, not affiliated with the NBA or its teams.",
  },
  common: {
    tryAgain: "Try again",
    home: "Home",
    close: "Close",
    cancel: "Cancel",
    you: "You",
    locked: "Locked",
    playNow: "Play now",
    playAGame: "Play a game",
    allGames: "All games",
    chooseAnotherGame: "Choose another game",
    playYourFirstGame: "Play your first game",
    noScoresYet: "No scores yet",
    noGamesYet: "No games played yet",
    totalPoints: "Total points",
    gamesPlayed: "Games played",
    bestStreak: "Best streak",
    accuracy: "Accuracy",
    score: "Score",
    correct: "Correct",
    rank: "Rank",
    player: "Player",
    points: "Points",
    leaderboardUnavailable: "Leaderboard unavailable",
    loadingLeaderboard: "Loading leaderboard",
    setNickname: "Set nickname",
    nicknameCta: "Set a nickname to appear on the leaderboard.",
  },
  difficulty: {
    legend: "Difficulty",
    label: { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" },
    options: (n: number) => `${n} options`,
    search: "Search",
    blanks: (n: number) => `${n} blanks`,
    seconds: (s: number) => `${s}s`,
    fewerHints: "fewer hints",
  },
  era: {
    legend: "Era",
    pick: "Pick your era",
    current: { label: "Current", tagline: "Active players · today's teams" },
    retired: { label: "Retired", tagline: "Retired legends · classic teams" },
    mixed: "Mixed",
    /** Screen-reader prefix before an era line ("Current era: …"). */
    srPrefix: (label: string) => `${label} era: `,
    badgeSr: "Era: ",
  },
  modes,
  dailyTitle: "Daily Challenge",
  home: {
    loading: "Loading home",
    dailyError: "Couldn't load the daily challenge",
    weekEmptyDesc: "Be the first name on this week's board.",
    topThisWeek: "Top players this week",
    errorTitle: "We couldn't load the court",
    errorDesc: "Something went wrong reaching our servers. Your progress is safe.",
    welcome: "Welcome,",
    rookie: "rookie.",
    firstLead: "No games played yet. Your first game takes about three minutes.",
    waitingTitle: "Your name isn't on the board yet",
    waitingDesc: "Finish one game and you're on this week's sheet. Even a bad one counts.",
    kicker: "Six games, one sheet",
    heroTitle: "Who started",
    heroTitleEm: "at the four?",
    heroLead:
      "Six trivia games built from real lineups, box scores and career lines. A round takes about three minutes.",
    /** Hand-lettered note beside the hero play diagram. */
    diagramNote: "if X3 overplays, 3 goes backdoor",
    featured: "On the board",
    seeAll: "See all",
    fullBoard: "Full board",
    scoringTitle: "How a play is scored",
    scoringBase: "Base points for every correct answer, × difficulty (up to ×3 on Expert)",
    scoringTime: "Time bonus at most. It drains with the clock.",
    scoringStreak: "Per answer in a row, up to +100. One miss wipes it.",
  },
  games: {
    eyebrow: "Pick a mode",
  },
  gameCard: {
    play: "Play",
    playLabel: (title: string) => `Play ${title}`,
    coverLabel: (name: string) => `Cover star: ${name}`,
  },
  flow: {
    modeBadge: (n: string) => `Mode ${n}`,
    timerRule: "Beat the clock. The quicker the answer, the bigger the time bonus.",
    streakRule: "Consecutive correct answers build a streak bonus.",
    keyboardTop10: "Keyboard: type a name, ↑↓ to move, Enter to pick.",
    keyboardChoices: "Keyboard: 1–6 picks an option, Enter confirms.",
    start: "Start",
    emptyTitle: "No questions for this mode yet",
    emptyEraDesc:
      "We're still building questions for this era and difficulty. Try another era, level or mode.",
    changeEraLevel: "Change era or level",
    playAgain: "Play again",
  },
  play: {
    listComplete: "List complete!",
    foundOf: (found: number, total: number, timedOut: boolean) =>
      `${timedOut ? "Time's up — " : ""}${found} of ${total} found.`,
    correct: "Correct!",
    timeUpWas: (name: string) => `Time's up — it was ${name}.`,
    notQuiteWas: (name: string) => `Not quite — it was ${name}.`,
    badgeUnlocked: (name: string) => `Badge unlocked: ${name}`,
    emptyDesc: "We're still building questions at this difficulty. Try another level or mode.",
    expiredTitle: "Session expired",
    expiredDesc: "This game was idle for too long. Start a new session to keep earning points.",
    startNew: "Start new session",
    alreadyPlayedTitle: "Already played today",
    alreadyPlayedDesc: "Come back tomorrow for a new challenge.",
    rateLimitedTitle: "Slow down a little",
    connectionTitle: "Connection lost",
    rateLimitedDesc: "Too many requests in a short time. Wait a few seconds and try again.",
    startErrorDesc: "We couldn't start the game. Check your connection and try again.",
    answerErrorDesc: "We couldn't load the next question. Your score so far is saved.",
    loadingQuestion: "Loading question",
    top10Hint: (sec: number) => `Search a player for every blank row. ${sec} seconds per list.`,
    giveUp: "Give up & reveal",
    getReady: "Get ready…",
  },
  hud: {
    questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
    streakLabel: (n: number) => `Streak: ${n}`,
    onFire: "On fire",
    timeLeft: (sec: number) => `Time left: ${sec} seconds`,
  },
  answers: {
    groupLabel: "Answer options",
    correctAnswer: "Correct answer",
    yourWrongAnswer: "Your answer, wrong",
  },
  question: {
    prompts: {
      "starting-five": "Who completes the starting five?",
      "team-journey": "Whose career path is this?",
      "teammate-challenge": "Who played with all of them?",
      "career-stats": "Whose career averages are these?",
      "box-score": "Who had this night?",
    } satisfies Record<Exclude<GameMode, "top-10">, string>,
    seasons: (n: number) => plural("en", n, { one: `${n} season`, other: `${n} seasons` }),
    allStar: (n: number) => `${n}× All-Star`,
    noAllStar: "No All-Star picks",
    missingStarter: "Missing starter",
    careerStops: "Career stops in order",
    boxScoreLine: "Box score line",
    games: "Games",
    seasonsLabel: "Seasons",
    position: "Position",
    list: (n: number, total: number) => `List ${n}/${total}`,
    /** Top 10 list titles come from the data set in English. */
    listTitle: (title: string) => title,
    gotIt: "(you got it)",
    missed: "(missed)",
    rankPlayer: (rank: number) => `Rank ${rank} player`,
    whoIs: (rank: number) => `Who is #${rank}?`,
  },
  search: {
    label: "Search players",
    placeholder: "Search players…",
    listLabel: "Players",
    hintEmpty: "Type at least 2 letters · ↑↓ to move · Enter to pick",
    typing: "Keep typing…",
    noResults: "No players found",
    error: "Search is unavailable. Check your connection.",
    clear: (name: string) => `Clear ${name}`,
  },
  result: {
    complete: "Session complete",
    newBadges: "New badges",
  },
  nickname: {
    tooShort: (min: number) => `Too short — use at least ${min} characters.`,
    tooLong: (max: number) => `Too long — ${max} characters max.`,
    chars: "Only letters, numbers and underscores.",
    looksGood: "Looks good.",
    saveError: "Couldn't save your nickname. Check your connection and try again.",
    taken: (value: string) => `“${value}” is already taken. Try another.`,
    /** Server-side reason (blocklist etc.); English shows the server text as is. */
    rejected: (serverMessage: string) => serverMessage || "That nickname isn't allowed.",
    rateLimited: "Too many attempts. Wait a moment and try again.",
    label: "Nickname",
    placeholder: "e.g. ClutchCity_23",
    hint: (min: number, max: number) => `${min}–${max} characters · letters, numbers and _ only`,
    save: "Save nickname",
    modalTitle: "Set your nickname",
    modalDesc: "This is how you'll appear on the leaderboard.",
    savedToast: "Nickname saved — you're on the leaderboard",
  },
  daily: {
    eyebrow: "Daily",
    titleWithMode: (mode: string) => `Daily · ${mode}`,
    emptyTitle: "Today's challenge is on its way",
    emptyDesc: "A new challenge drops at midnight UTC. Warm up with a regular game.",
    loading: "Loading daily challenge",
    todaysMix: "Today's mix",
    start: "Start daily challenge",
    oneAttempt: "One attempt per day",
    sameQuestions: (n: number) =>
      `Everyone gets the same ${n} questions today. Your attempt starts when you press Start.`,
    eraMix: "Daily mixes current and retired players, so either era can come up.",
    resetsIn: "Resets in",
    nextIn: "Next in",
    alreadyPlayed: "Already played today",
    todaysRanking: "Today's ranking",
    loadingRanking: "Loading today's ranking",
    rankingUnavailable: "Ranking unavailable",
    rankingEmptyDesc: "Rankings appear as players finish today's challenge.",
    seeRanking: "See daily ranking",
    errorTitle: "Couldn't load today's challenge",
    errorDesc: "Check your connection. Your daily attempt is not used until you start.",
    card: {
      badge: "Daily challenge",
      yourScore: "Your score",
      title: "Five questions, one from each mode. You get one try.",
      sub: "Same questions for everyone today.",
      play: "Play today's challenge",
    },
  },
  leaderboard: {
    eyebrow: "Top 100",
    periods: { all: "All time", week: "This week", day: "Today" },
    periodLabel: "Leaderboard period",
    unavailableDesc: "We couldn't fetch rankings. Your points are still counted.",
    emptyDesc: "Nobody has played in this period. Be the first name on the board.",
    noNickname: (name: string) => `${name} · no nickname`,
    top100: "Top 100 players",
    defaultLabel: "Top players",
  },
  profile: {
    loading: "Loading profile",
    loadingHistory: "Loading game history",
    historyError: "Couldn't load your history",
    historyEmptyDesc: "Play your first game to start your history.",
    guestNicknameSet: "Guest · nickname set",
    guest: "Guest",
    editNickname: "Edit nickname",
    errorTitle: "Couldn't read your progress",
    errorDesc: "Check your connection and try again. Your stats are stored on our server.",
    guestNoteStrong: "Your progress is saved in this browser.",
    guestNoteRest: "Clearing site data or switching devices starts you over.",
    emptyDesc: "Play your first game to start your history and unlock badges.",
    achievements: "Achievements",
    history: "Game history",
    last20: "Last 20",
    correctOf: (correct: number, total: number) => `${correct}/${total} correct`,
  },
  achievements,
  notFound: {
    title: "Air ball.",
    description: "This page isn't on the court. It may have moved, or the link is wrong.",
    back: "Back to home",
    browse: "Browse games",
  },
  routeError: {
    title: "Technical foul on our side",
    description: "Something broke while loading this page. Try again in a moment.",
  },
};

export type Messages = typeof en;
