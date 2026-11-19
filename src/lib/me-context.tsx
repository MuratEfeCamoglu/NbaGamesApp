"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";
import { useApi, type AsyncState } from "@/lib/use-api";

interface MeContextValue {
  state: AsyncState<MeDTO>;
  /** Show loading and refetch (Try again button). */
  retry: () => void;
  /** Refetch in the background (after a finished session); keeps current data on failure. */
  refresh: () => void;
  /** Replace with a fresher copy (PATCH /api/me response). */
  setMe: (me: MeDTO) => void;
}

const MeContext = createContext<MeContextValue | null>(null);

/** One GET /api/me per page load (it also creates the guest cookie); shared by TopNav, Home, Profile and nickname nudges. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { state, retry, mutate } = useApi("me", (signal) => api.getMe(signal));
  const refresh = useCallback(() => {
    api.getMe().then(mutate, () => undefined);
  }, [mutate]);
  const value = useMemo(
    () => ({ state, retry, refresh, setMe: mutate }),
    [state, retry, refresh, mutate],
  );
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
