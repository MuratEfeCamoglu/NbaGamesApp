"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isApiError } from "@/lib/api-client";

export type AsyncState<T> =
  { status: "loading" } | { status: "error"; error: ApiError } | { status: "success"; data: T };

export function toApiError(err: unknown): ApiError {
  if (isApiError(err)) return err;
  return new ApiError("INTERNAL", err instanceof Error ? err.message : "Unexpected error", 0);
}

/**
 * Loads data for `key` (null = idle). Changing `key` or calling `retry()` refetches and shows "loading".
 * The state is tagged with the request token, so a stale response never overwrites a newer one.
 */
export function useApi<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ token: string; value: AsyncState<T> } | null>(null);
  const token = `${key ?? ""}#${attempt}`;

  useEffect(() => {
    if (key === null) return;
    const ctrl = new AbortController();
    fetcherRef.current(ctrl.signal).then(
      (data) => setResult({ token, value: { status: "success", data } }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ token, value: { status: "error", error: toApiError(err) } });
      },
    );
    return () => ctrl.abort();
  }, [key, token]);

  const state: AsyncState<T> =
    result && result.token === token ? result.value : { status: "loading" };
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const mutate = useCallback(
    (data: T) => setResult({ token, value: { status: "success", data } }),
    [token],
  );
  return { state, retry, mutate };
}

/** Re-renders every `intervalMs` with the current time (for countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
