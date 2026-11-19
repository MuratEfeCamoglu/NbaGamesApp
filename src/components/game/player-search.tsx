"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api-client";
import type { PlayerSearchResultDTO } from "@/lib/api-types";
import { PlayerAvatar } from "./player-avatar";

/** ISKELET §3.3: q is 2–40 chars. */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 40;
export const SEARCH_DEBOUNCE_MS = 200;

export type PickedPlayer = Pick<PlayerSearchResultDTO, "id" | "name" | "teamId" | "headshotId">;

type FetchStatus = "loading" | "results" | "no-results" | "error";

interface PlayerSearchProps {
  value: PickedPlayer | null;
  onChange: (player: PickedPlayer | null) => void;
  /** After answering: colours the selected chip (design data-result). */
  result?: "correct" | "wrong" | null;
  disabled?: boolean;
  /** Top 10 row: compact input, no helper messages, the chip can be cleared. */
  compact?: boolean;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

function highlight(name: string, q: string): ReactNode {
  const at = name.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0 || !q) return name;
  return (
    <>
      {name.slice(0, at)}
      <mark>{name.slice(at, at + q.length)}</mark>
      {name.slice(at + q.length)}
    </>
  );
}

export function PlayerSearch({
  value,
  onChange,
  result,
  disabled,
  compact,
  label = "Search players",
  placeholder = "Search players…",
  autoFocus,
}: PlayerSearchProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("loading");
  const [results, setResults] = useState<PlayerSearchResultDTO[]>([]);
  const [active, setActive] = useState(-1);

  const q = query.trim();

  useEffect(() => {
    if (q.length < SEARCH_MIN_CHARS) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api.searchPlayers(q.slice(0, SEARCH_MAX_CHARS), ctrl.signal).then(
        (res) => {
          setResults(res.results);
          setActive(-1);
          setFetchStatus(res.results.length > 0 ? "results" : "no-results");
        },
        () => {
          if (!ctrl.signal.aborted) setFetchStatus("error");
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const state = value
    ? "selected"
    : q.length === 0
      ? "empty"
      : q.length < SEARCH_MIN_CHARS
        ? "typing"
        : fetchStatus;
  const expanded = state === "results";

  function pick(player: PickedPlayer) {
    if (disabled) return;
    onChange(player);
    setQuery("");
    setResults([]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!expanded || results.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[Math.max(0, active)];
      if (expanded && chosen) pick(chosen);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  return (
    <div
      className="player-search"
      data-component="PlayerSearch"
      data-state={state}
      data-result={result ?? undefined}
    >
      <div className="player-search__control">
        <Icon name="search" size="sm" />
        <input
          ref={inputRef}
          className={
            compact ? "input player-search__input top10__input" : "input player-search__input"
          }
          data-component="Input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={SEARCH_MAX_CHARS}
          placeholder={placeholder}
          role="combobox"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          disabled={disabled || !!value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= SEARCH_MIN_CHARS) setFetchStatus("loading");
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      <ul
        className="player-search__results"
        id={listId}
        role="listbox"
        aria-label="Players"
        aria-busy={state === "loading"}
      >
        {state === "loading" ? (
          <>
            <li className="skeleton skeleton--row" aria-hidden="true" />
            <li className="skeleton skeleton--row" aria-hidden="true" />
          </>
        ) : (
          results.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              className="player-search__option"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <PlayerAvatar name={p.name} headshotId={p.headshotId} teamId={p.teamId} size="sm" />
              <span className="grow">{highlight(p.name, q)}</span>
              <span className="t-xs t-muted">{p.teamId ?? p.position}</span>
            </li>
          ))
        )}
      </ul>

      {compact ? null : (
        <>
          <p className="player-search__msg" data-for="empty">
            Type at least 2 letters · ↑↓ to move · Enter to pick
          </p>
          <p className="player-search__msg" data-for="typing">
            Keep typing…
          </p>
          <p className="player-search__msg" data-for="no-results" role="status">
            <Icon name="search" size="sm" />
            No players found
          </p>
          <p className="player-search__msg" data-for="error" role="alert">
            <Icon name="wifi-off" size="sm" />
            Search is unavailable. Check your connection.
          </p>
        </>
      )}

      <div className="player-search__selected">
        {value ? (
          <>
            <PlayerAvatar
              name={value.name}
              headshotId={value.headshotId}
              teamId={value.teamId}
              size="sm"
            />
            <span className="top10__name grow">{value.name}</span>
            {compact && !disabled ? (
              <button
                type="button"
                className="icon-btn"
                data-component="IconButton"
                data-variant="ghost"
                aria-label={`Clear ${value.name}`}
                onClick={() => {
                  onChange(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                <Icon name="x" size="sm" />
              </button>
            ) : (
              <Icon name={result === "wrong" ? "x" : "check"} />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
