import "server-only";
import { getCurrentUserId } from "@/server/auth/session";
import { getServiceContext } from "@/server/context";
import { AppError, json, withErrorHandling } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { submitAnswer } from "@/server/services/game-service";
import { answerSchema, parseOrThrow, readJson, sessionIdSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = getServiceContext();
    const sessionId = parseOrThrow(sessionIdSchema, (await params).id);
    const body = parseOrThrow(answerSchema, await readJson(req));
    // A client without a valid cookie can't own any session: don't mint a guest just to 404.
    const userId = await getCurrentUserId(ctx);
    if (!userId) throw new AppError("NOT_FOUND", "Session not found.");
    enforceRateLimit("answer", userId);
    return json(await submitAnswer(ctx, userId, sessionId, body.questionIndex, body.answer));
  },
);
