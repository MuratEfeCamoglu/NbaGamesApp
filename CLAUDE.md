# NBA Games

## Proje
NBA oyuncu, takım, kadro ve istatistik verisi üzerine 6 bilgi oyunu (Starting Five, Team Journey, Teammate Challenge, Career Stats, Box Score, Top 10 Challenge), Daily Challenge, streak, 4 zorluk, leaderboard, profil ve rozet sistemi sunan responsive web uygulaması.

- Kapsam, kabul kriterleri, veri modeli, API sözleşmesi: @docs/ISKELET.md
- Ajan rolleri, yetkiler, görev döngüsü: @docs/AGENT.md
- Görsel tasarım brief'i: @docs/TASARIM_PROMPT.md · Tasarım çıktısı: `design/design.html`

**Durum:** MVP tamamlandı ve test edildi (unit + e2e + verify yeşil). Ortak sözleşmeler: `src/data/schema.ts` (veri şeması, tek doğru kaynak), `src/data/source.ts`, `src/games/core/*`.

## Teknoloji Yığını
- Node.js 24 LTS · npm · TypeScript 5 (`strict: true`, `noUncheckedIndexedAccess: true`)
- Next.js 16 App Router · React 19 · Route Handlers (`src/app/api`)
- Tailwind CSS 4 (CSS-first `@theme`) · `motion` (`import { motion } from "motion/react"`)
- Zod 4 (API girdisi + veri seti şeması)
- Prisma 7 (stable) + SQLite (`@prisma/adapter-better-sqlite3`)
- Vitest 5 + Testing Library + jsdom · Playwright
- Yardımcı: `tsx` (betikler), `server-only` (sunucu modül koruması)
- Veri: NBA API (stats.nba.com) ← Python 3.13 + `nba_api` 1.12 + pytest (yalnız `scripts/nba-sync`, uygulamaya girmez)
- ESLint (eslint-config-next, flat) · Prettier + prettier-plugin-tailwindcss

## Komutlar
Aşama 1'de `package.json`'a tam olarak bu adlarla eklenir:

| Amaç | Komut |
|---|---|
| Kurulum | `npm install` → `cp .env.example .env` → `npm run db:migrate` |
| Geliştirme | `npm run dev` (http://localhost:3000) |
| Lint | `npm run lint` |
| Format | `npm run format` (yazar) · `npm run format:check` |
| Tip kontrolü | `npm run typecheck` (`tsc --noEmit`) |
| Unit + entegrasyon | `npm test` (`vitest run`) · izleme: `npm run test:watch` |
| E2E | `npm run test:e2e` (`playwright test`; ilk sefer `npx playwright install chromium`) |
| Veri hattı kurulumu | `python -m venv .venv` → `.venv\Scripts\pip install -r scripts/nba-sync/requirements.txt` |
| NBA API senkronu | `npm run data:sync` (`.venv` Python ile `scripts/nba-sync/sync.py`; yalnız yerel makinede, ~30 dk) |
| Veri hattı testleri | `npm run data:test` (pytest `scripts/nba-sync`) |
| Veri doğrulama | `npm run data:validate` (`tsx scripts/validate-data.ts`) |
| DB migration | `npm run db:migrate` (`prisma migrate dev`) |
| DB sıfırlama | `npm run db:reset` — **onay gerektirir** (AGENT.md) |
| Build | `npm run build` · prod çalıştırma: `npm start` |
| Tam doğrulama | `npm run verify` = lint + typecheck + test + data:validate + build |

## Ortam Değişkenleri (`.env`, asla commit edilmez)
- `DATABASE_URL` — `file:./dev.db`
- `SESSION_SECRET` — ≥32 bayt rastgele (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `NEXT_PUBLIC_REMOTE_MEDIA` — `true`/`false` (NBA CDN oyuncu fotoğrafları)
NBA API anahtar istemez; veri hattı için ortam değişkeni yok.
`.env.example` yalnızca adları ve örnek olmayan açıklamaları içerir.

## Mimari Kurallar
- Bağımlılık yönü: `app/components` → `server/services` → `games` → `data`. Ters import yasak.
- `src/games/**`: saf TypeScript. React, Prisma, `fetch`, `Date.now()`, `Math.random()` yok; zaman ve RNG parametre olarak gelir (`rng.ts`).
- `src/games/**` NBA verisine yalnızca `NbaDataSource` arayüzüyle erişir; `seed/*.json` import etmez.
- `src/server/**` ve `src/data/static-source.ts` `import "server-only"` ile başlar. İstisna: `src/data/schema.ts`, `source.ts`, `build-source.ts` saf şema/tip/kurucu modüllerdir; betikler (`validate-data`) ve testler de kullandığı için server-only değildir, veri dosyası import etmez.
- Doğru cevap (`answerKey`) yalnız sunucuda; istemciye `toPublicQuestion()` çıktısı gider.
- Cevap kontrolü, süre ölçümü ve puan hesabı sunucuda. İstemci zamanlayıcısı yalnızca görseldir.
- Her Route Handler girdisini Zod ile `safeParse` eder; hatada `src/server/errors.ts` biçimi: `{ error: { code, message } }`.
- Prisma istemcisi tek örnek: `src/server/db.ts`.
- Yeni oyun modu = `src/games/<slug>/engine.ts` + `src/games/core/registry.ts` kaydı; başka yer değişmez.

## Kod Kuralları
- Dosya adları `kebab-case.ts(x)`; React bileşenleri `PascalCase` export; hook'lar `useX`.
- Server Component varsayılan; `"use client"` yalnız etkileşim gereken yaprak bileşenlerde.
- `any` yasak; dış veri `unknown` → Zod.
- Hata yönetimi: servisler `AppError(code, message)` fırlatır, route handler yakalayıp HTTP koduna çevirir; beklenmeyen hata 500 `INTERNAL` + `console.error` (stack istemciye gitmez).
- Yorumlar "neden"i anlatır; bariz kodu yorumlama.
- Unit test, test edilen dosyanın yanında `*.test.ts(x)`; e2e `tests/e2e/`.
- Magic number yok: zorluk/süre/puan sabitleri `src/games/core/difficulty.ts` ve `scoring.ts`'te.

## Tasarım Kuralları
- Görsel katman v2 (kullanıcı isteği, 2026-11-19): design.html yapısının üzerine mod başına renk kimliği, gradyan/cam yüzeyler ve zengin animasyonlar eklendi. Yeni renk/gradyan/süre değerleri yalnızca `globals.css` `@theme` token'larında; yapı ve bileşen adları için design.html geçerli kalır.
- Tek görsel kaynak `design/design.html`: tüm ekranlar, durumlar ve token'lar bu tek dosyada. Tarayıcıda açıp 360/768/1280 px'te incele; kaynakta ekranlar `<section id>` ile ayrılır.
- `design/design.html` elle değiştirilmez; yeni tasarım gelirse dosya bütün olarak değiştirilir.
- Renk, font, radius, gölge, spacing, hareket yalnızca token'lardan: `design.html`'deki `:root` değişkenleri `src/app/globals.css` `@theme` bloğuna birebir aktarılır. Hex kodu bileşende yazılmaz.
- Bileşen adları `design.html`'deki `data-component` değerleriyle aynıdır (`data-component="GameCard"` → `src/components/game/game-card.tsx`, export `GameCard`); varyantlar `data-variant` ile.
- Bileşen CSS'i `src/app/design.css`'tedir (design.html `<style>` bloğundan birebir). React bileşenleri tasarımın class ve `data-*` yapısını aynen kullanır (`className="player-card" data-team="gsw"`); Tailwind utility yalnız küçük düzen eklemeleri için. Takım rengi: `data-team="<id küçük harf>"` / `var(--color-team-<id>)`.
- İkonlar: design.html'deki inline SVG sprite → `src/components/ui/icon.tsx` (`<Icon name="flame" />`); ikon kütüphanesi yok.
- design.html'deki demo şeridi (`design-bar`, `screen-controls`/StateSwitcher, Mode/Phase/State seçicileri) dokümantasyon içindir, ürün UI'ına taşınmaz. Demo puan formülü yerine ISKELET §2.1 geçerlidir; misafir kimliği localStorage değil cookie'dir (ISKELET §3.1).
- Tasarımda karşılığı olmayan ekran/bileşen gerekiyorsa: önce mevcut bileşenlerden kur, farkı rapora yaz; yeni görsel dil icat etme.
- Animasyonlar `prefers-reduced-motion`'a uyar (`useReducedMotion`).
- Breakpoint'ler: mobil 360, tablet 768, masaüstü 1280 px; her ekran 360 px'te yatay kaydırmasız.

## Çalışma Kuralları
- Her değişiklikten sonra ilgili testleri, iş bitiminde `npm run verify` çalıştır.
- Test edilmemiş kod tamamlanmış sayılmaz.
- Kapsam dışı (ISKELET.md §2.4) bir şey gerekiyorsa uygulama; nota düş ve kullanıcıya sor.
- Davranış değiştiren her iş ISKELET.md'yi (gerekiyorsa) aynı commit'te günceller.
- Commit formatı: Conventional Commits (`feat(games): ...`, `fix(api): ...`, `docs: ...`, `test: ...`). Commit/push yalnızca kullanıcı isteyince.
- Dış servis erişilemiyorsa çalışıyor gibi gösterme; hatayı ve atlanan adımı raporla.

## Önemli Notlar / Tuzaklar
- Prisma 7: `prisma.config.ts` ve driver adapter zorunlu; `npm` `latest` etiketi 8.x RC'ye işaret ediyor — `prisma@7` ve `@prisma/client@7` açık sürümle kur.
- Next.js 16'da `middleware.ts` yerine `proxy.ts`; bu projede proxy kullanılmıyor, cookie Route Handler'da okunur.
- Daily seed'i UTC tarihidir; testlerde tarih parametreyle verilir, sistem saatine güvenilmez.
- `next/image` remote host'u yalnız `cdn.nba.com`; görsel hata verirse `PlayerAvatar` fallback'i göster.
- NBA verisi NBA API'den gelir (ISKELET §3.6): `src/data/seed/*.json` yalnızca `npm run data:sync` ile üretilir, elle düzenlenmez; uygulama kodu stats.nba.com'u asla çağırmaz (bulut IP'lerini engeller).
- Senkron yalnız geliştirici makinesinde; CI ve sunucuda çalıştırılmaz. API erişilemezse betik hata verir ve seed'lere dokunmaz — sonucu olduğu gibi raporla.
- Seed değiştiyse `npm run data:validate` zorunlu; `data-cache/` ve `.venv/` gitignore'da.
