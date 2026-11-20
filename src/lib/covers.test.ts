import { afterEach, describe, expect, it, vi } from "vitest";
import { ERAS, GAME_MODES } from "@/games/core/types";
import { COVER_PLAYERS, coverPlayer } from "./covers";
import { headshotUrl, remoteMediaEnabled } from "./media";

afterEach(() => vi.unstubAllEnvs());

describe("cover stars (F17)", () => {
  it("has one player per mode and era, all different", () => {
    const ids = GAME_MODES.flatMap((m) => ERAS.map((e) => coverPlayer(m, e).id));
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    for (const id of ids) expect(id).toMatch(/^\d+$/);
  });

  it("matches the ISKELET table", () => {
    expect(COVER_PLAYERS["starting-five"]).toEqual({
      current: { id: "201939", name: "Stephen Curry" },
      retired: { id: "893", name: "Michael Jordan" },
    });
    expect(coverPlayer("team-journey", "current").name).toBe("LeBron James");
    expect(coverPlayer("team-journey", "retired").name).toBe("Shaquille O'Neal");
    expect(coverPlayer("teammate-challenge", "current").name).toBe("Luka Dončić");
    expect(coverPlayer("teammate-challenge", "retired").name).toBe("Magic Johnson");
    expect(coverPlayer("career-stats", "current").name).toBe("Nikola Jokić");
    expect(coverPlayer("career-stats", "retired").name).toBe("Kareem Abdul-Jabbar");
    expect(coverPlayer("box-score", "current").name).toBe("Giannis Antetokounmpo");
    expect(coverPlayer("box-score", "retired").name).toBe("Kobe Bryant");
    expect(coverPlayer("top-10", "current").name).toBe("Kevin Durant");
    expect(coverPlayer("top-10", "retired").name).toBe("Tim Duncan");
  });

  it("uses the 260x190 CDN headshot and the remote-media flag", () => {
    expect(headshotUrl("893")).toBe("https://cdn.nba.com/headshots/nba/latest/260x190/893.png");
    vi.stubEnv("NEXT_PUBLIC_REMOTE_MEDIA", "true");
    expect(remoteMediaEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_REMOTE_MEDIA", "false");
    expect(remoteMediaEnabled()).toBe(false);
  });
});
