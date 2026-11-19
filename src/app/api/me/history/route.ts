import "server-only";
import { getOrCreateUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { getHistory } from "@/server/services/user-service";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const userId = await getOrCreateUserId(ctx, req);
  enforceRateLimit("read", userId);
  return json(await getHistory(ctx, userId));
});
