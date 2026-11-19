import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api-client";

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(() => impl());
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-client", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch(() => json(200, { results: [{ id: "1", name: "Ray Allen" }] }));
    const res = await api.searchPlayers("ray");
    expect(res.results[0]?.name).toBe("Ray Allen");
  });

  it("encodes the search query and sends JSON bodies", async () => {
    const fn = mockFetch(() => json(200, {}));
    await api.searchPlayers("Dončić & co");
    expect(fn.mock.calls[0]?.[0]).toBe("/api/players/search?q=Don%C4%8Di%C4%87%20%26%20co");

    await api.submitAnswer("s 1", { questionIndex: 2, answer: { playerId: "2544" } });
    const [url, init] = fn.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/games/sessions/s%201/answer");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      questionIndex: 2,
      answer: { playerId: "2544" },
    });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it.each([
    [400, "VALIDATION"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [410, "EXPIRED"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL"],
  ] as const)("maps the API error body for %i to code %s", async (status, code) => {
    mockFetch(() => json(status, { error: { code, message: `msg ${code}` } }));
    const err = await api.getMe().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code, status, message: `msg ${code}` });
  });

  it("falls back to the HTTP status when the body is not the error shape", async () => {
    mockFetch(() => Promise.resolve(new Response("<html>gateway</html>", { status: 410 })));
    await expect(api.getDaily()).rejects.toMatchObject({ code: "EXPIRED", status: 410 });

    mockFetch(() => Promise.resolve(new Response("", { status: 502 })));
    await expect(api.getDaily()).rejects.toMatchObject({ code: "INTERNAL", status: 502 });
  });

  it("turns a failed request into NETWORK", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(api.getLeaderboard("week")).rejects.toMatchObject({ code: "NETWORK", status: 0 });
  });

  it("rethrows aborts untouched so callers can ignore them", async () => {
    mockFetch(() => Promise.reject(new DOMException("aborted", "AbortError")));
    await expect(api.getHistory()).rejects.toMatchObject({ name: "AbortError" });
  });
});
