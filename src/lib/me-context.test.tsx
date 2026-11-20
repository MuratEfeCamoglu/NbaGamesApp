// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "@/components/layout/top-nav";
import { api, ApiError } from "@/lib/api-client";
import type { MeDTO } from "@/lib/api-types";
import { ME_REFRESH_RETRY_MS, MeProvider, useMe } from "./me-context";

// TopNav also renders the language switch (F18), which refreshes through the router.
vi.mock("next/navigation", () => ({
  usePathname: () => "/games/box-score",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...mod, api: { ...mod.api, getMe: vi.fn() } };
});

const getMe = vi.mocked(api.getMe);
const me = (totalPoints: number, nickname: string | null = null): MeDTO => ({
  id: "cku1",
  nickname,
  totalPoints,
  bestStreak: 0,
  gamesPlayed: totalPoints > 0 ? 1 : 0,
  accuracy: 0,
  achievements: [],
});
const fail = () => Promise.reject(new ApiError("NETWORK", "offline", 0));

let ctx: ReturnType<typeof useMe>;
function Capture() {
  const value = useMe();
  useEffect(() => {
    ctx = value;
  });
  return null;
}
function renderNav() {
  render(
    <MeProvider>
      <TopNav />
      <Capture />
    </MeProvider>,
  );
}
const pill = () => screen.getByLabelText(/Your total points/);
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getMe.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MeProvider refresh (nav points pill after a game)", () => {
  it("updates the pill after a finished game, retrying a failed refresh", async () => {
    getMe.mockResolvedValueOnce(me(0)).mockImplementationOnce(fail).mockResolvedValueOnce(me(1240));
    renderNav();
    await flush();
    expect(pill()).toHaveTextContent("0");

    act(() => ctx.refresh());
    await flush();
    expect(pill()).toHaveTextContent("0"); // first try failed: keep the data we have
    await flush(ME_REFRESH_RETRY_MS);
    expect(pill()).toHaveTextContent("1,240");
    expect(getMe).toHaveBeenCalledTimes(3);
  });

  it("a stale refresh never overwrites newer data (nickname saved meanwhile)", async () => {
    let resolveStale: (m: MeDTO) => void = () => {};
    getMe
      .mockResolvedValueOnce(me(500))
      .mockImplementationOnce(() => new Promise<MeDTO>((r) => (resolveStale = r)));
    renderNav();
    await flush();

    act(() => ctx.refresh());
    act(() => ctx.setMe(me(800, "splash_bro")));
    expect(pill()).toHaveTextContent("800");
    await act(async () => resolveStale(me(800)));
    expect(ctx.state.status === "success" && ctx.state.data.nickname).toBe("splash_bro");
  });

  it("recovers from a failed first load (pill appears after the refresh)", async () => {
    getMe.mockImplementationOnce(fail).mockResolvedValueOnce(me(300));
    renderNav();
    await flush();
    expect(ctx.state.status).toBe("error");
    expect(screen.queryByLabelText(/Your total points/)).not.toBeInTheDocument();

    act(() => ctx.refresh());
    await flush();
    expect(pill()).toHaveTextContent("300");
  });

  it("gives up after the retries and keeps the current data", async () => {
    getMe.mockResolvedValueOnce(me(70)).mockImplementation(fail);
    renderNav();
    await flush();
    act(() => ctx.refresh());
    await flush(10 * ME_REFRESH_RETRY_MS);
    expect(getMe).toHaveBeenCalledTimes(4); // load + 1 try + 2 retries
    expect(pill()).toHaveTextContent("70");
  });
});
