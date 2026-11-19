import "server-only";

/** Exact names (after stripping digits/underscores) that could impersonate staff or the brand. */
const RESERVED = [
  "admin",
  "administrator",
  "moderator",
  "mod",
  "nba",
  "nbagames",
  "official",
  "root",
  "staff",
  "support",
  "system",
  "you",
];

/** Blocked anywhere inside the nickname. */
const OFFENSIVE = [
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "fag",
  "fuck",
  "nazi",
  "nigg",
  "penis",
  "porn",
  "pussy",
  "retard",
  "shit",
  "slut",
  "whore",
  "orospu",
  "yarrak",
  "gavat",
];

export function isNicknameBlocked(nickname: string): boolean {
  const key = nickname.toLowerCase();
  const letters = key.replace(/[\d_]/g, "");
  if (RESERVED.includes(letters)) return true;
  return OFFENSIVE.some((word) => letters.includes(word));
}
