// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { ERA_STORAGE_KEY, resetEraMemory } from "@/lib/use-era-preference";
import { GameFlow } from "./game-flow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...mod, api: { ...mod.api, startSession: vi.fn() } };
});

const startSession = vi.mocked(api.startSession);
const radio = (name: string) => screen.getByRole("radio", { name });
const start = () => fireEvent.click(screen.getByRole("button", { name: "Start" }));

beforeEach(() => {
  window.localStorage.clear();
  resetEraMemory();
  window.history.replaceState(null, "", "/games/box-score");
  // Pending forever: the test only looks at the request and the intro → play switch.
  startSession.mockReset().mockReturnValue(new Promise(() => {}));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GameFlow era (F16)", () => {
  it("defaults to Current and sends the chosen era and difficulty with Start", () => {
    render(<GameFlow mode="box-score" />);
    expect(radio("Current")).toBeChecked();
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByRole("radio", { name: /Hard/ }));
    start();
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(startSession).toHaveBeenCalledWith({
      mode: "box-score",
      difficulty: "hard",
      era: "current",
    });
  });

  it("starts from ?era= and remembers the era actually played", () => {
    window.history.replaceState(null, "", "/games/box-score?era=retired");
    render(<GameFlow mode="box-score" initialEra="retired" />);
    expect(radio("Retired")).toBeChecked();
    expect(screen.getByText(/The line belongs to a retired player/)).toBeInTheDocument();
    start();
    expect(startSession).toHaveBeenCalledWith({
      mode: "box-score",
      difficulty: "easy",
      era: "retired",
    });
    expect(window.localStorage.getItem(ERA_STORAGE_KEY)).toBe("retired");
  });

  it("falls back to the remembered era and writes it into the URL", () => {
    window.localStorage.setItem(ERA_STORAGE_KEY, "retired");
    render(<GameFlow mode="box-score" />);
    expect(radio("Retired")).toBeChecked();
    expect(window.location.pathname + window.location.search).toBe("/games/box-score?era=retired");
  });

  it("switching the era updates the URL in place (no reload) and the remembered choice", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    render(<GameFlow mode="box-score" />);
    fireEvent.click(radio("Retired"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/games/box-score?era=retired");
    expect(window.localStorage.getItem(ERA_STORAGE_KEY)).toBe("retired");
    fireEvent.click(radio("Current"));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/games/box-score");
    expect(window.location.search).toBe("");
  });

  it("an explicit ?era= wins over the remembered one", () => {
    window.localStorage.setItem(ERA_STORAGE_KEY, "retired");
    render(<GameFlow mode="box-score" initialEra="current" />);
    expect(radio("Current")).toBeChecked();
  });

  it("shows the session's era badge and themes the screen while playing", () => {
    const { container } = render(<GameFlow mode="top-10" initialEra="retired" />);
    start();
    expect(screen.queryByRole("group", { name: "Era" })).not.toBeInTheDocument();
    const badge = container.querySelector(".page-header [data-component='EraBadge']");
    expect(badge).toHaveAttribute("data-variant", "retired");
    expect(container.querySelector(".era-scope")).toHaveAttribute("data-era", "retired");
  });
});
