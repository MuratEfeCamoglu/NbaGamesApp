// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerBar } from "./timer-bar";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const timer = () => screen.getByRole("timer");

describe("TimerBar", () => {
  it("counts down, warns in the last 5 seconds and fires onExpire once at 0", () => {
    const onExpire = vi.fn();
    render(<TimerBar durationSec={10} running onExpire={onExpire} />);
    expect(timer()).toHaveAttribute("data-state", "normal");
    expect(timer()).toHaveTextContent("10");

    act(() => vi.advanceTimersByTime(4_000));
    expect(timer()).toHaveTextContent("6");
    expect(timer()).toHaveAttribute("data-state", "normal");

    act(() => vi.advanceTimersByTime(1_100));
    expect(timer()).toHaveAttribute("data-state", "warning");
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5_000));
    expect(timer()).toHaveAttribute("data-state", "expired");
    expect(timer()).toHaveTextContent("0");
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(5_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("freezes when not running (after an answer)", () => {
    const onExpire = vi.fn();
    const { rerender } = render(<TimerBar durationSec={20} running onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(3_000));
    rerender(<TimerBar durationSec={20} running={false} onExpire={onExpire} />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(timer()).toHaveTextContent("17");
    expect(onExpire).not.toHaveBeenCalled();
  });
});
