"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { api } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";
import { useApi, type AsyncState } from "@/lib/use-api";

/** Background refresh retries (after a finished session) before keeping the data it has. */
export const ME_REFRESH_RETRIES = 2;
export const ME_REFRESH_RETRY_MS = 1000;

interface MeContextValue {
  state: AsyncState<MeDTO>;
  /** Show loading and refetch (Try again button). */
  retry: () => void;
  /**
   * Refetch in the background (after a finished session). Retries a failed request, keeps the
   * current data meanwhile, and a successful answer also clears an earlier error state.
   */
  refresh: () => void;
  /** Replace with a fresher copy (PATCH /api/me response). */
  setMe: (me: MeDTO) => void;
}

const MeContext = createContext<MeContextValue | null>(null);

/** One GET /api/me per page load (it also creates the guest cookie); shared by TopNav, Home, Profile and nickname nudges. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { state, retry, mutate } = useApi("me", (signal) => api.getMe(signal));
  // Latest mutate (its request token changes on retry), so a late answer lands in the current state.
  const mutateRef = useRef(mutate);
  useEffect(() => {
    mutateRef.current = mutate;
  });
  // Every refresh/setMe bumps the version: an older in-flight refresh can never overwrite newer data.
  const version = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  const refresh = useCallback(() => {
    const mine = ++version.current;
    clearTimeout(retryTimer.current);
    const attempt = (n: number) => {
      api.getMe().then(
        (me) => {
          if (mine === version.current) mutateRef.current(me);
        },
        () => {
          if (mine !== version.current || n >= ME_REFRESH_RETRIES) return;
          retryTimer.current = setTimeout(() => attempt(n + 1), ME_REFRESH_RETRY_MS * (n + 1));
        },
      );
    };
    attempt(0);
  }, []);

  const setMe = useCallback((me: MeDTO) => {
    version.current++;
    clearTimeout(retryTimer.current);
    mutateRef.current(me);
  }, []);

  const value = useMemo(() => ({ state, retry, refresh, setMe }), [state, retry, refresh, setMe]);
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

const IDLE: MeContextValue = {
  state: { status: "loading" },
  retry: () => undefined,
  refresh: () => undefined,
  setMe: () => undefined,
};

export function useMe(): MeContextValue {
  return useContext(MeContext) ?? IDLE;
}

export function meData(state: AsyncState<MeDTO>): MeDTO | null {
  return state.status === "success" ? state.data : null;
}
