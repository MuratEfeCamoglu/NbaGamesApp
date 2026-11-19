import "server-only";
import { getCurrentUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { clientKey, enforceRateLimit } from "@/server/rate-limit";
import { getLeaderboard } from "@/server/services/leaderboard-service";
import { leaderboardQuerySchema, parseOrThrow, searchParams } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const { period } = parseOrThrow(leaderboardQuerySchema, searchParams(req));
  const userId = await getCurrentUserId(ctx);
  enforceRateLimit("read", userId ?? clientKey(req));
  return json(await getLeaderboard(ctx, period, userId));
});
