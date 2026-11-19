import "server-only";
import { getOrCreateUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { json, withErrorHandling } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { getMe, updateNickname } from "@/server/services/user-service";
import { nicknameSchema, parseOrThrow, readJson } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const userId = await getOrCreateUserId(ctx, req);
  enforceRateLimit("read", userId);
  return json(await getMe(ctx, userId));
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const ctx = getServiceContext();
  const body = parseOrThrow(nicknameSchema, await readJson(req));
  const userId = await getOrCreateUserId(ctx, req);
  enforceRateLimit("write", userId);
  return json(await updateNickname(ctx, userId, body.nickname));
});
