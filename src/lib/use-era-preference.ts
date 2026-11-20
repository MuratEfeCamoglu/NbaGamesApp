"use client";

import { useSyncExternalStore } from "react";
import type { Era } from "@/games/core/types";
import { DEFAULT_ERA, parseEra } from "./era";

export const ERA_STORAGE_KEY = "nba-games:era";

// The last choice made in this page session. It wins over storage, so a blocked or full
// localStorage (private mode, quota) still keeps the switch working until the next reload.
let memoryEra: Era | null = null;
const listeners = new Set<() => void>();

function readStoredEra(): Era | null {
  try {
    return parseEra(window.localStorage.getItem(ERA_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** The remembered era of this browser (default "current"). */
export function getRememberedEra(): Era {
  return memoryEra ?? readStoredEra() ?? DEFAULT_ERA;
}

/** Remember `era` for this browser and update every mounted useEraPreference(). */
export function rememberEra(era: Era): void {
  memoryEra = era;
  try {
    window.localStorage.setItem(ERA_STORAGE_KEY, era);
  } catch {
    // Storage blocked: the in-memory choice above still applies for this page session.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab picked (or cleared) the era: follow it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== ERA_STORAGE_KEY && e.key !== null) return;
    memoryEra = parseEra(e.newValue);
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// Storage is unknown on the server: render the default, the client switches after hydration.
const serverSnapshot = (): Era => DEFAULT_ERA;

/** [remembered era, remember] — shared by every component on the page and across tabs. */
export function useEraPreference(): [Era, (era: Era) => void] {
  return [useSyncExternalStore(subscribe, getRememberedEra, serverSnapshot), rememberEra];
}

/** Tests only: forget the in-memory choice. */
export function resetEraMemory(): void {
  memoryEra = null;
}
