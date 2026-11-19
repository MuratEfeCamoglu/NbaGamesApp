"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerOptionView } from "@/games/core/types";
import { Icon } from "@/components/ui/icon";

export type AnswerOptionState = "default" | "selected" | "correct" | "wrong" | "disabled";

interface AnswerOptionProps {
  shortcut: number;
  label: string;
  state: AnswerOptionState;
  onSelect: () => void;
  /** Locked after answering: buttons stay visible but inert. */
  locked?: boolean;
  focus?: boolean;
}

export function AnswerOption({
  shortcut,
  label,
  state,
  onSelect,
  locked,
  focus,
}: AnswerOptionProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <button
      ref={ref}
      className="answer-option"
      data-component="AnswerOption"
      data-state={state}
      type="button"
      disabled={locked || state === "disabled"}
      aria-keyshortcuts={String(shortcut)}
      aria-pressed={state === "selected" ? true : undefined}
      onClick={onSelect}
    >
      <span className="answer-option__key">{shortcut}</span>
      <span className="answer-option__label">{label}</span>
      <Icon name="check" className="answer-option__status" data-icon="check" />
      <Icon name="x" className="answer-option__status" data-icon="x" />
      {state === "correct" ? <span className="sr-only">Correct answer</span> : null}
      {state === "wrong" ? <span className="sr-only">Your answer, wrong</span> : null}
    </button>
  );
}

interface AnswerGridProps {
  options: AnswerOptionView[];
  /** Called with the option id (a playerId) when the user commits an answer. */
  onAnswer: (optionId: string) => void;
  /** After answering. */
  reveal: { chosenId: string | null; correctId: string } | null;
  /** True while the answer request is in flight. */
  pending?: boolean;
}

/**
 * Easy/Medium answer buttons. Click answers immediately; keys 1–N select (with focus) and Enter confirms
 * (design.html keyboard rules). Keys are ignored while typing in an input.
 */
export function AnswerGrid({ options, onAnswer, reveal, pending }: AnswerGridProps) {
  const [selected, setSelected] = useState<number>(-1);
  const locked = !!reveal || !!pending;

  const onAnswerRef = useRef(onAnswer);
  useEffect(() => {
    onAnswerRef.current = onAnswer;
  });

  useEffect(() => {
    if (locked) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        setSelected(n - 1);
      } else if (e.key === "Enter" && selected >= 0) {
        const opt = options[selected];
        if (!opt) return;
        e.preventDefault();
        onAnswerRef.current(opt.id);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [locked, options, selected]);

  function stateFor(opt: AnswerOptionView, i: number): AnswerOptionState {
    if (reveal) {
      if (opt.id === reveal.correctId) return "correct";
      if (opt.id === reveal.chosenId) return "wrong";
      return "disabled";
    }
    return i === selected ? "selected" : "default";
  }

  return (
    <div
      className="answer-grid"
      data-count={options.length}
      role="group"
      aria-label="Answer options"
    >
      {options.map((opt, i) => (
        <AnswerOption
          key={opt.id}
          shortcut={i + 1}
          label={opt.label}
          state={stateFor(opt, i)}
          locked={locked}
          focus={!locked && i === selected}
          onSelect={() => {
            setSelected(i);
            onAnswer(opt.id);
          }}
        />
      ))}
    </div>
  );
}
