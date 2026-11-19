import "server-only";
import { getCurrentUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { clientKey, enforceRateLimit } from "@/server/rate-limit";
import { getDailyStatus } from "@/server/services/daily-service";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const userId = await getCurrentUserId(ctx);
  enforceRateLimit("read", userId ?? clientKey(req));
  return json(await getDailyStatus(ctx, userId));
});
