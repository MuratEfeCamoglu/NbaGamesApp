import "server-only";
import type { ApiErrorCode, ApiErrorDTO } from "@/lib/api-types";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXPIRED: 410,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function errorResponse(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorDTO = { error: { code, message } };
  return Response.json(body, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) return errorResponse(err.code, err.message);
  // Unexpected: log server-side only; the client never sees the stack or internal message.
  console.error(err);
  return errorResponse("INTERNAL", "Something went wrong. Please try again.");
}

/** Wraps a route handler so every thrown error becomes `{ error: { code, message } }`. */
export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}
