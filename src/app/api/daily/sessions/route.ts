import "server-only";
import { getOrCreateUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { startDaily } from "@/server/services/daily-service";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const userId = await getOrCreateUserId(ctx, req);
  enforceRateLimit("write", userId);
  return json(await startDaily(ctx, userId), { status: 201 });
});
