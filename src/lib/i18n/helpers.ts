// Dictionary-free helpers: the caller passes the active dictionary (`t`), so client code that
// uses them never ships a second language.
import type { Messages } from "./types";

/** Achievement copy by id; unknown ids (a badge added on the server first) keep the API's text. */
export function achievementCopy(
  t: Messages,
  a: { id: string; name: string; description?: string },
): { name: string; description?: string } {
  const copy = (t.achievements as Record<string, { name: string; description: string }>)[a.id];
  return copy ?? { name: a.name, description: a.description };
}
