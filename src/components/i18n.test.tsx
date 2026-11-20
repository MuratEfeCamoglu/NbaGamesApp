// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameCard } from "@/components/game/game-card";
import { GamePlay } from "@/components/game/game-play";
import { NicknameForm } from "@/components/game/nickname-form";
import { ResultSummary } from "@/components/game/result-summary";
import { LanguageSwitch } from "@/components/layout/language-switch";
import type { SessionSummary } from "@/games/core/types";
import { api, ApiError } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import { EnI18nProvider } from "@/lib/i18n/providers/en";
import { TrI18nProvider } from "@/lib/i18n/providers/tr";
import { MODES } from "@/lib/modes";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  refresh.mockReset();
  document.cookie = "ng_lang=; Path=/; Max-Age=0";
});

const inLocale = (locale: Locale, ui: ReactNode) =>
  render(
    locale === "tr" ? <TrI18nProvider>{ui}</TrI18nProvider> : <EnI18nProvider>{ui}</EnI18nProvider>,
  );

describe("GameCard cover (F17) and Turkish copy (F18)", () => {
  it("shows the era's cover star photo, straight from the CDN, with the name as alt", () => {
    vi.stubEnv("NEXT_PUBLIC_REMOTE_MEDIA", "true");
    inLocale("tr", <GameCard mode={MODES["starting-five"]} era="retired" />);
    const img = screen.getByRole("img", { name: "Michael Jordan" });
    expect(img).toHaveAttribute("src", "https://cdn.nba.com/headshots/nba/latest/260x190/893.png");
    expect(img).toHaveAttribute("width", "260");
    expect(img).toHaveAttribute("height", "190");
    expect(screen.getByRole("link", { name: "Starting Five oyna" })).toHaveAttribute(
      "href",
      "/games/starting-five?era=retired",
    );
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Oyna");
    expect(card).toHaveTextContent("Eski sezonlardan klasik ilk beşler.");
    expect(card.querySelector(".game-card__era-tag")).toHaveTextContent("Emekli");
    expect(card).toHaveTextContent("10 soru");
  });

  it("falls back to initials when remote media is off, and when the photo fails", () => {
    vi.stubEnv("NEXT_PUBLIC_REMOTE_MEDIA", "false");
    const { unmount } = render(<GameCard mode={MODES["box-score"]} />);
    const fallback = screen.getByRole("img", { name: "Giannis Antetokounmpo" });
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback).toHaveTextContent("GA");
    expect(screen.getByRole("link", { name: "Play Box Score" })).toBeInTheDocument();
    unmount();

    vi.stubEnv("NEXT_PUBLIC_REMOTE_MEDIA", "true");
    render(<GameCard mode={MODES["top-10"]} />);
    fireEvent.error(screen.getByRole("img", { name: "Kevin Durant" }));
    expect(screen.getByRole("img", { name: "Kevin Durant" }).tagName).toBe("SPAN");
    expect(document.querySelector("[data-component='GameCover']")).toHaveAttribute(
      "data-state",
      "fallback",
    );
  });
});

const SUMMARY: SessionSummary = {
  sessionId: "s1",
  mode: "career-stats",
  difficulty: "hard",
  era: "retired",
  score: 2140,
  correct: 8,
  total: 10,
  bestStreak: 6,
};

describe("ResultSummary in Turkish", () => {
  it("localizes labels, numbers, percents and badge names", () => {
    inLocale(
      "tr",
      <ResultSummary
        summary={SUMMARY}
        newAchievements={[{ id: "streak-5", name: "Streak 5", description: "5 in a row" }]}
        showNicknameNudge
        onSetNickname={() => {}}
        actions={null}
      />,
    );
    expect(screen.getByText("Oturum tamamlandı")).toBeInTheDocument();
    expect(screen.getByTestId("result-score")).toHaveTextContent("2.140");
    expect(screen.getByText("%80")).toBeInTheDocument();
    expect(screen.getByText("En iyi seri")).toBeInTheDocument();
    expect(screen.getByText("5'lik Seri")).toBeInTheDocument();
    expect(screen.getByText("Emekli")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Takma ad belirle" })).toBeInTheDocument();
  });
});

describe("NicknameForm in Turkish", () => {
  it("validates locally and maps server errors by code", async () => {
    const update = vi.spyOn(api, "updateNickname");
    inLocale("tr", <NicknameForm onSaved={() => {}} />);
    const input = screen.getByLabelText("Takma ad");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByText("Çok kısa — en az 3 karakter kullan.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "bad name" } });
    expect(screen.getByText("Yalnız harf, rakam ve alt çizgi.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Clutch_23" } });
    expect(screen.getByText("Gayet iyi.")).toBeInTheDocument();

    update.mockRejectedValueOnce(new ApiError("CONFLICT", "This nickname is already taken.", 409));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Takma adı kaydet" }));
    });
    expect(screen.getByText("“Clutch_23” zaten alınmış. Başka bir tane dene.")).toBeInTheDocument();

    update.mockRejectedValueOnce(new ApiError("VALIDATION", "This nickname is not allowed.", 400));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Takma adı kaydet" }));
    });
    expect(screen.getByText("Bu takma ada izin verilmiyor.")).toBeInTheDocument();
    expect(screen.queryByText(/not allowed/)).not.toBeInTheDocument();
  });
});

function rejected(code: ConstructorParameters<typeof ApiError>[0], status: number) {
  const request = Promise.reject(new ApiError(code, "English server text.", status));
  request.catch(() => undefined);
  return request;
}

describe("error states by code in Turkish", () => {
  it("shows the expired-session state, not the server's English", async () => {
    inLocale(
      "tr",
      <GamePlay request={rejected("EXPIRED", 410)} onRestart={() => {}} resultActions={null} />,
    );
    expect(await screen.findByText("Oturumun süresi doldu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yeni oturum başlat" })).toBeInTheDocument();
    expect(screen.queryByText("English server text.")).not.toBeInTheDocument();
  });

  it("shows the rate-limit and network states with a Turkish retry", async () => {
    const { unmount } = inLocale(
      "tr",
      <GamePlay
        request={rejected("RATE_LIMITED", 429)}
        onRestart={() => {}}
        resultActions={null}
      />,
    );
    expect(await screen.findByText("Biraz yavaşla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    unmount();
    inLocale(
      "tr",
      <GamePlay request={rejected("NETWORK", 0)} onRestart={() => {}} resultActions={null} />,
    );
    expect(await screen.findByText("Bağlantı koptu")).toBeInTheDocument();
  });
});

describe("LanguageSwitch", () => {
  it("stores the choice in ng_lang and refreshes the server tree", () => {
    inLocale("en", <LanguageSwitch />);
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Türkçe" }));
    expect(document.cookie).toContain("ng_lang=tr");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing for the active language", () => {
    inLocale("tr", <LanguageSwitch />);
    expect(screen.getByRole("group", { name: "Dil" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Türkçe" }));
    expect(refresh).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("ng_lang");
  });
});
