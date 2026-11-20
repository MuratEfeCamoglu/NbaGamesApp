import "server-only";
import { getOrCreateUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { startSession } from "@/server/services/game-service";
import { parseOrThrow, readJson, startSessionSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const body = parseOrThrow(startSessionSchema, await readJson(req));
  const userId = await getOrCreateUserId(ctx, req);
  enforceRateLimit("write", userId);
  return json(await startSession(ctx, userId, body.mode, body.difficulty, body.era), {
    status: 201,
  });
});
