// Typed fetch wrappers for the API contract in api-types.ts (ISKELET §3.3).
// Every failure becomes an ApiError so views can switch on `code` (NOT_FOUND → empty, EXPIRED → session expired…).
import type {
  AnswerRequest,
  AnswerResponse,
  ApiErrorCode,
  DailyStatusDTO,
  HistoryDTO,
  LeaderboardDTO,
  LeaderboardPeriod,
  MeDTO,
  PlayerSearchDTO,
  StartSessionRequest,
  StartSessionResponse,
} from "@/lib/api-types";

/** NETWORK = request never got a response (offline, DNS, aborted by the browser). */
export type ClientErrorCode = ApiErrorCode | "NETWORK";

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "EXPIRED",
  429: "RATE_LIMITED",
};

const API_CODES: readonly string[] = [
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "EXPIRED",
  "RATE_LIMITED",
  "INTERNAL",
];

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;

  constructor(code: ClientErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function readErrorBody(body: unknown): { code: ApiErrorCode; message: string } | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const err = (body as { error: unknown }).error;
  if (typeof err !== "object" || err === null) return null;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code !== "string" || !API_CODES.includes(code)) return null;
  return { code: code as ApiErrorCode, message: typeof message === "string" ? message : "" };
}

/** A request that hangs longer than this surfaces as a NETWORK error so the UI can offer "Try again". */
export const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    res = await fetch(path, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (cause) {
    // Caller cancelled → propagate; our own timeout → treat as a network failure.
    if (init?.signal?.aborted) throw cause;
    if (timeout.aborted) throw new ApiError("NETWORK", "The server took too long to respond", 0);
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("NETWORK", "Network request failed", 0);
  }

  let body: unknown = null;
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const parsed = readErrorBody(body);
    const code = parsed?.code ?? STATUS_TO_CODE[res.status] ?? "INTERNAL";
    throw new ApiError(code, parsed?.message || res.statusText || "Request failed", res.status);
  }
  return body as T;
}

const json = (data: unknown) => JSON.stringify(data);

export const api = {
  getMe: (signal?: AbortSignal) => request<MeDTO>("/api/me", { signal }),
  updateNickname: (nickname: string) =>
    request<MeDTO>("/api/me", { method: "PATCH", body: json({ nickname }) }),
  getHistory: (signal?: AbortSignal) => request<HistoryDTO>("/api/me/history", { signal }),
  startSession: (body: StartSessionRequest) =>
    request<StartSessionResponse>("/api/games/sessions", { method: "POST", body: json(body) }),
  startDaily: () => request<StartSessionResponse>("/api/daily/sessions", { method: "POST" }),
  submitAnswer: (sessionId: string, body: AnswerRequest) =>
    request<AnswerResponse>(`/api/games/sessions/${encodeURIComponent(sessionId)}/answer`, {
      method: "POST",
      body: json(body),
    }),
  getDaily: (signal?: AbortSignal) => request<DailyStatusDTO>("/api/daily", { signal }),
  searchPlayers: (q: string, signal?: AbortSignal) =>
    request<PlayerSearchDTO>(`/api/players/search?q=${encodeURIComponent(q)}`, { signal }),
  getLeaderboard: (period: LeaderboardPeriod, signal?: AbortSignal) =>
    request<LeaderboardDTO>(`/api/leaderboard?period=${period}`, { signal }),
};
