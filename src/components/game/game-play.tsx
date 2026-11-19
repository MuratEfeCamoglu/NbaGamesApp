"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { REVEAL_MS } from "@/games/core/difficulty";
import type { AnswerResult, GameMode, PublicQuestion, SubmittedAnswer } from "@/games/core/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, type ApiError } from "@/lib/api-client";
import type { StartSessionResponse } from "@/lib/api-types";
import { meData, useMe } from "@/lib/me-context";
import { toApiError } from "@/lib/use-api";
import { AnswerGrid } from "./answer-option";
import { Countdown } from "./countdown";
import { FeedbackBanner, type FeedbackKind } from "./feedback-banner";
import { GameHud } from "./game-hud";
import { NicknameModal } from "./nickname-form";
import { PlayerSearch, type PickedPlayer } from "./player-search";
import { QuestionCard } from "./question-card";
import { ResultSummary } from "./result-summary";
import { ScoreToast } from "./score-toast";
import { TimerBar } from "./timer-bar";
import { slotsPayload, type Top10Picks } from "./top10-table";

/** Slide-out before the next question (design: 240 ms, 120 ms with reduced motion). */
const SLIDE_OUT_MS = 240;
const SLIDE_OUT_REDUCED_MS = 120;
/** Badge toast appears shortly after the result screen (design demo: 700 ms). */
const BADGE_TOAST_DELAY_MS = 700;

interface Answered {
  result: AnswerResult;
  /** Option id / player the user chose (null on timeout). */
  chosen: PickedPlayer | null;
  chosenOptionId: string | null;
  timedOut: boolean;
}

interface Submission {
  answer: SubmittedAnswer;
  chosen: PickedPlayer | null;
  chosenOptionId: string | null;
  timedOut: boolean;
}

export interface GamePlayProps {
  /** Started by the parent's click handler (so React StrictMode never starts two sessions). */
  request: Promise<StartSessionResponse>;
  /** Parent remounts GamePlay with a fresh request. */
  onRestart: () => void;
  /** Result buttons (Play again / Choose another game…). */
  resultActions: ReactNode;
  /** Daily: POST returned 409 (already played today). */
  onConflict?: () => void;
  /** Daily header shows "Daily · <mode>". */
  onQuestion?: (mode: GameMode) => void;
  onFinished?: () => void;
  /** Replaces the default "No questions for this mode yet" panel (start returned 404). */
  emptyState?: ReactNode;
}

export function feedbackFor(a: Answered): { kind: FeedbackKind; message: string } {
  const r = a.result;
  if (r.correctAnswer.kind === "slots") {
    if (r.totalUnits > 0 && r.correctUnits === r.totalUnits)
      return { kind: "correct", message: "List complete!" };
    return {
      kind: a.timedOut ? "timeout" : "wrong",
      message: `${a.timedOut ? "Time's up — " : ""}${r.correctUnits} of ${r.totalUnits} found.`,
    };
  }
  const name = r.correctAnswer.player.name;
  if (r.correct) return { kind: "correct", message: "Correct!" };
  if (a.timedOut) return { kind: "timeout", message: `Time's up — it was ${name}.` };
  return { kind: "wrong", message: `Not quite — it was ${name}.` };
}

export function GamePlay({
  request,
  onRestart,
  resultActions,
  onConflict,
  onQuestion,
  onFinished,
  emptyState,
}: GamePlayProps) {
  const router = useRouter();
  const toast = useToast();
  const { state: meState, setMe, refresh: refreshMe } = useMe();
  const me = meData(meState);
  const reduceMotion = useReducedMotion();

  const [countdownDone, setCountdownDone] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  const [session, setSession] = useState<{ id: string; total: number } | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState<ApiError | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<("correct" | "wrong")[]>([]);
  const [picks, setPicks] = useState<Top10Picks>({});
  const [scorePop, setScorePop] = useState<{ key: number; points: number }>({ key: 0, points: 0 });
  const [anim, setAnim] = useState<"in" | "out" | undefined>(undefined);
  const [finished, setFinished] = useState<Pick<
    AnswerResult,
    "summary" | "newAchievements"
  > | null>(null);
  const [nickOpen, setNickOpen] = useState(false);
  const [pendingPick, setPendingPick] = useState<PickedPlayer | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastSubmission = useRef<Submission | null>(null);
  const onQuestionRef = useRef(onQuestion);
  const onConflictRef = useRef(onConflict);
  useEffect(() => {
    onQuestionRef.current = onQuestion;
    onConflictRef.current = onConflict;
  });

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let active = true;
    request.then(
      (res) => {
        if (!active) return;
        setSession({ id: res.sessionId, total: res.total });
        setQuestion(res.question);
      },
      (err: unknown) => {
        if (!active) return;
        const e = toApiError(err);
        if (e.code === "CONFLICT") onConflictRef.current?.();
        setStartError(e);
      },
    );
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (question) onQuestionRef.current?.(question.mode);
  }, [question]);

  const playing = !!question && countdownDone && !finished && !startError;
  useEffect(() => {
    if (!playing) return;
    document.body.dataset.immersive = "true";
    return () => {
      document.body.dataset.immersive = "false";
    };
  }, [playing]);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function applyResult(r: AnswerResult, sub: Submission, q: PublicQuestion) {
    setAnswered({
      result: r,
      chosen: sub.chosen,
      chosenOptionId: sub.chosenOptionId,
      timedOut: sub.timedOut,
    });
    setScore(r.totalScore);
    setStreak(r.streak);
    setResults((prev) => {
      const next = prev.slice();
      next[q.index] = r.correct ? "correct" : "wrong";
      return next;
    });
    if (r.points > 0) setScorePop((t) => ({ key: t.key + 1, points: r.points }));

    later(() => {
      if (r.next) {
        const next = r.next;
        setAnim("out");
        later(
          () => {
            setQuestion(next);
            setAnswered(null);
            setPicks({});
            setAnim("in");
          },
          reduceMotion ? SLIDE_OUT_REDUCED_MS : SLIDE_OUT_MS,
        );
      } else {
        setFinished({ summary: r.summary, newAchievements: r.newAchievements });
        refreshMe();
        onFinished?.();
        r.newAchievements.forEach((a, i) =>
          later(
            () => toast(`Badge unlocked: ${a.name}`, "accent", "award"),
            BADGE_TOAST_DELAY_MS + i * 400,
          ),
        );
      }
    }, REVEAL_MS);
  }

  async function send(sub: Submission) {
    if (!session || !question || answered || submitting) return;
    const q = question;
    lastSubmission.current = sub;
    setPendingPick(sub.chosen);
    setSubmitting(true);
    setAnswerError(null);
    try {
      const r = await api.submitAnswer(session.id, { questionIndex: q.index, answer: sub.answer });
      applyResult(r, sub, q);
    } catch (err) {
      setAnswerError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onTimeout() {
    if (!question || answered || submitting) return;
    if (question.input === "top10" && Object.keys(picks).length > 0) {
      // Server is the clock (limit + grace): send what was filled so partial lists still score.
      void send({
        answer: { slots: slotsPayload(picks) },
        chosen: null,
        chosenOptionId: null,
        timedOut: true,
      });
      return;
    }
    void send({ answer: { timeout: true }, chosen: null, chosenOptionId: null, timedOut: true });
  }

  function onTop10Pick(rank: number, p: PickedPlayer | null) {
    if (!question || question.content.mode !== "top-10") return;
    const next = { ...picks };
    if (p) next[rank] = p;
    else delete next[rank];
    setPicks(next);
    const hidden = question.content.rows.filter((r) => r.player === null).length;
    if (p && Object.keys(next).length === hidden) {
      void send({
        answer: { slots: slotsPayload(next) },
        chosen: null,
        chosenOptionId: null,
        timedOut: false,
      });
    }
  }

  function giveUp() {
    const answer: SubmittedAnswer =
      Object.keys(picks).length > 0 ? { slots: slotsPayload(picks) } : { timeout: true };
    void send({ answer, chosen: null, chosenOptionId: null, timedOut: false });
  }

  // ---------- error / empty / expired ----------
  const err = startError ?? answerError;
  if (err) {
    if (err.code === "NOT_FOUND" && startError) {
      if (emptyState) return <>{emptyState}</>;
      return (
        <EmptyState
          className="block"
          icon="search"
          title="No questions for this mode yet"
          description="We're still building questions at this difficulty. Try another level or mode."
          actions={<Button href="/games">Choose another game</Button>}
        />
      );
    }
    if (err.code === "EXPIRED") {
      return (
        <ErrorState
          className="block"
          variant="session-expired"
          title="Session expired"
          description="This game was idle for too long. Start a new session to keep earning points."
          actions={
            <>
              <Button onClick={onRestart}>Start new session</Button>
              <Button href="/" variant="ghost">
                Home
              </Button>
            </>
          }
        />
      );
    }
    if (err.code === "CONFLICT" && startError) {
      return (
        <EmptyState
          className="block"
          icon="calendar-check"
          title="Already played today"
          description="Come back tomorrow for a new challenge."
        />
      );
    }
    const rateLimited = err.code === "RATE_LIMITED";
    return (
      <ErrorState
        className="block"
        title={rateLimited ? "Slow down a little" : "Connection lost"}
        description={
          rateLimited
            ? "Too many requests in a short time. Wait a few seconds and try again."
            : startError
              ? "We couldn't start the game. Check your connection and try again."
              : "We couldn't load the next question. Your score so far is saved."
        }
        onRetry={() => {
          if (startError) onRestart();
          else if (lastSubmission.current) {
            setAnswerError(null);
            const sub = lastSubmission.current;
            void send(sub);
          }
        }}
      />
    );
  }

  // ---------- starting: countdown over a question skeleton ----------
  if (!question || !session || !countdownDone) {
    return (
      <>
        <div className="block" aria-busy="true" aria-label="Loading question">
          <div className="stack">
            <Skeleton shape="row" />
            <div className="card stack">
              <Skeleton shape="title" />
              <div className="lineup">
                <Skeleton shape="block" />
                <Skeleton shape="block" />
                <Skeleton shape="block" />
                <Skeleton shape="block" />
                <Skeleton shape="block" />
              </div>
            </div>
            <div className="answer-grid">
              <Skeleton shape="row" />
              <Skeleton shape="row" />
              <Skeleton shape="row" />
              <Skeleton shape="row" />
            </div>
          </div>
        </div>
        {countdownDone ? null : <Countdown onDone={() => setCountdownDone(true)} />}
      </>
    );
  }

  // ---------- result ----------
  if (finished) {
    if (!finished.summary) return null;
    return (
      <div className="block">
        <ResultSummary
          summary={finished.summary}
          newAchievements={finished.newAchievements}
          showNicknameNudge={!!me && me.nickname === null}
          onSetNickname={() => setNickOpen(true)}
          actions={resultActions}
        />
        <NicknameModal
          open={nickOpen}
          onClose={() => setNickOpen(false)}
          initial={me?.nickname}
          onSaved={(updated) => {
            setMe(updated);
            router.push("/leaderboard");
          }}
        />
      </div>
    );
  }

  // ---------- play ----------
  const q = question;
  const locked = !!answered || submitting;
  const reveal = answered
    ? { correct: answered.result.correct, answer: answered.result.correctAnswer }
    : null;
  const feedback = answered ? feedbackFor(answered) : null;
  const correctPlayerId =
    answered?.result.correctAnswer.kind === "player"
      ? answered.result.correctAnswer.player.id
      : null;

  return (
    <div className="game-stage" data-phase="play">
      <GameHud
        index={q.index}
        total={q.total}
        results={results}
        streak={streak}
        score={score}
        timer={
          <TimerBar
            key={`${session.id}-${q.index}`}
            durationSec={q.timeLimitSec}
            running={!locked && !answerError}
            onExpire={onTimeout}
          />
        }
      />
      <div className="game-layout">
        <QuestionCard
          key={`${session.id}-${q.index}`}
          content={q.content}
          reveal={reveal}
          anim={anim}
          top10={{ picks, onPick: onTop10Pick, disabled: locked }}
        >
          <ScoreToast key={scorePop.key} points={scorePop.key > 0 ? scorePop.points : null} />
        </QuestionCard>

        <div className="answer-area" data-input={q.input}>
          <FeedbackBanner kind={feedback?.kind ?? null} message={feedback?.message ?? ""} />

          {q.input === "choices" && q.options ? (
            <div data-input-view="choices">
              <AnswerGrid
                key={`${session.id}-${q.index}`}
                options={q.options}
                pending={submitting}
                reveal={
                  answered && correctPlayerId
                    ? { chosenId: answered.chosenOptionId, correctId: correctPlayerId }
                    : null
                }
                onAnswer={(id) =>
                  void send({
                    answer: { playerId: id },
                    chosen: null,
                    chosenOptionId: id,
                    timedOut: false,
                  })
                }
              />
            </div>
          ) : null}

          {q.input === "search" ? (
            <div data-input-view="search">
              <PlayerSearch
                key={`${session.id}-${q.index}`}
                value={answered?.chosen ?? (submitting ? pendingPick : null)}
                result={
                  answered && answered.chosen
                    ? answered.result.correct
                      ? "correct"
                      : "wrong"
                    : null
                }
                disabled={locked}
                onChange={(p) => {
                  if (p)
                    void send({
                      answer: { playerId: p.id },
                      chosen: p,
                      chosenOptionId: null,
                      timedOut: false,
                    });
                }}
              />
            </div>
          ) : null}

          {q.input === "top10" ? (
            <div data-input-view="top10">
              <p className="t-sm t-muted">
                Search a player for every blank row. {q.timeLimitSec} seconds per list.
              </p>
              <Button variant="secondary" onClick={giveUp} disabled={locked}>
                Give up &amp; reveal
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
