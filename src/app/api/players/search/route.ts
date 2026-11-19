import "server-only";
import { getCurrentUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { clientKey, enforceRateLimit } from "@/server/rate-limit";
import { searchPlayers } from "@/server/services/player-service";
import { parseOrThrow, searchParams, searchQuerySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const { q } = parseOrThrow(searchQuerySchema, searchParams(req));
  enforceRateLimit("search", (await getCurrentUserId(ctx)) ?? clientKey(req));
  return json(searchPlayers(ctx, q));
});
