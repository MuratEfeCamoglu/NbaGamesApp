# NBA Games — Proje İskeleti ve Sınırları

> Bu dosya projenin tek kapsam referansıdır. CLAUDE.md kuralları, AGENT.md ajan davranışını, TASARIM_PROMPT.md görsel tasarımı tanımlar. Çelişki olursa kapsam konusunda bu dosya geçerlidir.
> Son güncelleme: 2026-11-22 · Durum: MVP + F16 dönem ayrımı + F17 oyuncu kapakları + F18 Türkçe uygulandı ve test edildi; Vercel + Turso yayın hazırlığı yapıldı (§3.5, V6) — 694 unit/entegrasyon testi (DB testleri libSQL adapter'ıyla da) + 73 e2e testi yeşil, `npm run verify` yeşil, ilk yükleme JS tüm sayfalarda <193 KB. Açık noktalar: Lighthouse puanları ölçülmedi; dönem seçici ve Türkçe arayüz henüz e2e ile test edilmedi; gerçek bir Turso veritabanına karşı denenmedi; rate limit Vercel'de instance başına sayar.

## 1. Amaç ve Hedef Kullanıcı

- **Sorun:** NBA bilgisini test etmek isteyen taraftarlar için oyuncu, takım, kadro ve istatistik bilgisini tek yerde, rekabetçi ve oyunlaştırılmış biçimde sunan Türkçe/İngilizce arayüzlü sade bir platform yok.
- **Hedef kullanıcı:** 15+ yaş NBA takipçisi; mobil (%60+ varsayılan trafik) ve masaüstü kullanıcıları. Oturum süresi hedefi 3–10 dakika.
- **Temel kullanım senaryoları:**
  1. Ziyaretçi ana sayfaya gelir, bir oyun modunu ve zorluğu seçer, kayıt olmadan 10 soruluk oturum oynar, sonuç ekranında puanını görür.
  2. Kullanıcı her gün Daily Challenge'ı (5 soru) bir kez çözer, günlük sıralamada yerini görür.
  3. Kullanıcı takma ad belirler, Leaderboard'da görünür; Profile'da puan, rozet ve geçmişini takip eder.
- **Başarı ölçütleri (MVP):**
  - Ana sayfadan ilk soruya en fazla 3 tıklama (Home → mod kartı → zorluk seç & başla).
  - 6 oyun modu × 4 zorluk = 24 kombinasyonun tamamı uçtan uca oynanabilir (e2e testle doğrulanır).
  - Aynı UTC gününde iki farklı kullanıcı Daily Challenge'da birebir aynı 5 soruyu alır.

## 2. Kapsam

### 2.1 Ortak oyun kuralları (tüm modlar)

| Kural | Değer |
|---|---|
| Oturum uzunluğu | 10 soru (Top 10 Challenge: 3 liste — bkz. F6) |
| Süre (soru başına) | Easy 30 sn · Medium 25 sn · Hard 20 sn · Expert 20 sn |
| Cevap biçimi | Easy: 4 şık · Medium: 6 şık · Hard/Expert: oyuncu arama kutusu (autocomplete, veri setindeki oyunculardan seçim; serbest metin yok) |
| Oyuncu havuzu | Her oyuncunun `fameTier` alanı (1=yıldız, 2=rotasyon, 3=az bilinen). Easy: tier 1 · Medium: tier ≤2 · Hard & Expert: tümü |
| Expert farkı | Hard ile aynı havuz + modun "ipucu azaltma" kuralı (her modda tanımlı) |
| Yanlış şıklar (Easy/Medium) | Doğru cevapla aynı zorluk havuzundan, tekrarsız; mümkünse aynı pozisyon grubundan (G/F/C) seçilir; şık sırası RNG ile karıştırılır |
| Doğru cevap gösterimi | Cevaptan sonra doğru cevap 1.5 sn gösterilir, sonra sonraki soru |
| Süre dolması | Yanlış sayılır, streak sıfırlanır |
| Cevap doğrulama | Yalnızca sunucuda. Doğru cevap, kullanıcı cevap verene kadar istemciye gönderilmez |
| Süre ölçümü | Sunucu `issuedAt` zamanına göre; limit + 2 sn tolerans sonrası gelen cevap = süre doldu |

**Puanlama formülü** (`src/games/core/scoring.ts`, saf fonksiyon):

```
doğruysa:
  base        = 100
  multiplier  = Easy 1.0 | Medium 1.5 | Hard 2.0 | Expert 3.0
  timeBonus   = floor(50 × kalanSüre / toplamSüre)          // 0–50
  streakBonus = streak ≥ 2 ? 20 × min(streak − 1, 5) : 0     // streak bu cevap dahil; maks +100
  puan        = round((base + timeBonus) × multiplier) + streakBonus
yanlış/süre doldu: puan = 0, streak = 0
```
Örnek: Hard, 10 sn kalmış (20 sn'den), 3. art arda doğru → round((100+25)×2.0) + 40 = 290.

### 2.2 Kapsam İçi (MVP)

| # | Özellik | Öncelik | Kabul Kriteri |
|---|---|---|---|
| F1 | **Starting Five** — bir takımın bir sezondaki ilk beşinden 4 oyuncu (ad + pozisyon) + takım + sezon gösterilir; eksik 5. oyuncu bulunur. "İlk beş" = o sezon en çok dakika oynayan beşli (§3.6) | Zorunlu | Soru kartında 4 oyuncu, takım rozeti ve sezon görünür; doğru cevap eksik oyuncu `playerId`'si ile eşleşir. Expert: sezon yılı gizlenir. Veri setinde ≥40 ilk beş kaydı |
| F2 | **Team Journey** — bir oyuncunun kariyerindeki takımlar kronolojik sırayla (yıl aralığıyla) gösterilir; oyuncu bulunur | Zorunlu | Yalnızca ≥2 takımda oynamış oyuncular sorulur. Expert: yıl aralıkları gizlenir. ≥60 uygun oyuncu |
| F3 | **Teammate Challenge** — oyuncunun aynı takım-sezonda oynadığı takım arkadaşları gösterilir; oyuncu bulunur | Zorunlu | Easy/Medium 5, Hard 3, Expert 2 takım arkadaşı gösterilir; gösterilen her isim veri setinde hedef oyuncuyla ortak bir `RosterEntry` (takım+sezon) paylaşır (unit testle doğrulanır) |
| F4 | **Career Stats** — kariyer ortalamaları (PPG, RPG, APG, SPG, BPG, FG%, maç, sezon sayısı, pozisyon) gösterilir; oyuncu bulunur | Zorunlu | Expert: sezon sayısı ve pozisyon gizlenir. ≥120 oyuncunun kariyer istatistiği |
| F5 | **Box Score** — gerçek bir maçtaki tek oyuncu satırı (PTS, REB, AST, STL, BLK, FGM-FGA, 3PM-3PA, MIN) + maç tarihi + iki takım + skor gösterilir; oyuncu bulunur | Zorunlu | Expert: tarih ve takımlar gizlenir (sadece istatistik satırı). ≥40 box score satırı, her biri `gameDate` ve `source` alanlı |
| F6 | **Top 10 Challenge** — bir istatistik sıralaması (ör. kariyer üçlük) 10 satır gösterilir, bazı isimler gizlidir; kullanıcı her gizli sıra için oyuncuyu seçer | Zorunlu | Oturum = 3 liste. Gizli satır sayısı: Easy 2 · Medium 3 · Hard 4 · Expert 5. Her gizli satır ayrı "soru" gibi puanlanır (süre liste başına 60 sn, tüm zorluklarda). ≥8 sıralama listesi |
| F7 | **Daily NBA** — her UTC gününde herkes için aynı 5 soru (Top 10 hariç 5 modun her birinden 1 soru, sırası seed'le karışık; Medium kuralları) | Zorunlu | Soru seçimi `seed = hash("daily:" + YYYY-MM-DD)` ile deterministik; kullanıcı başına günde 1 deneme (ikinci deneme 409 döner); günlük sıralama ayrı |
| F8 | **Streak System** | Zorunlu | Formüldeki `streakBonus` uygulanır; oturum içi streak UI'da görünür; kullanıcı `bestStreak` değeri profilde saklanır |
| F9 | **Difficulty Levels** (Easy/Medium/Hard/Expert) | Zorunlu | §2.1 tablosundaki tüm kurallar her modda uygulanır; zorluk oturum başında seçilir, oturum içinde değişmez |
| F10 | **Leaderboard** | Zorunlu | 3 sekme: Tüm zamanlar, Son 7 gün, Bugün (Daily). İlk 100 sıra + kullanıcının kendi sırası. Takma adı olmayan kullanıcılar listelenmez |
| F11 | **User Profile** (misafir hesap) | Zorunlu | İlk oyunda otomatik misafir hesap; takma ad 3–20 karakter `[A-Za-z0-9_]`, benzersiz (büyük/küçük harf duyarsız). Profilde: toplam puan, oynanan oyun, doğruluk %, en iyi streak, rozetler, son 20 oyun |
| F12 | **Achievements** | Zorunlu | §3.4'teki 8 rozet; koşul sağlandığı cevapta verilir ve sonuç ekranında bildirilir; aynı rozet iki kez verilmez (DB unique) |
| F13 | **Game History** | Zorunlu | Her biten oturum: mod, zorluk, puan, doğru/toplam, en iyi streak, tarih. Profilde son 20, en yeni üstte |
| F14 | **Sayfalar** | Zorunlu | §3.2'deki 6 route; tüm sayfalar 360 px genişlikte yatay kaydırma olmadan çalışır |
| F15 | **Durum ekranları** | Zorunlu | Her veri çeken ekranda Loading (skeleton), Empty, Error (tekrar dene butonu) durumları; TASARIM_PROMPT.md §8'e uygun |
| F16 | **Dönem ayrımı: Current / Retired** (kullanıcı isteği, 2026-11-20) — her oyun iki dönemde oynanır: **Current** = aktif oyuncular ve bugünün takımları, **Retired** = emekli oyuncular ve eski takımlar | Zorunlu | Home, Games ve oyun giriş ekranında dönem seçici (Current \| Retired), tarayıcıda hatırlanır, oyun URL'inde `?era=current\|retired`. Kurallar: (1) cevap oyuncusunun durumu dönemle eşleşir (`Player.active`); (2) Easy/Medium şıkları aynı dönem havuzundan; arama tüm oyuncularda (dönemi ele vermez); (3) Starting Five: Current = son `CURRENT_ERA_LINEUP_SEASONS` (3) sezonun beşlileri, Retired = daha eski beşliler; (4) Top 10: Current = aktif oyuncular arasındaki kariyer liderleri listeleri (`scope: "active"`), Retired = all-time listeler ve yalnız emekli oyuncuların satırları gizlenir (yeterli emekli satırı olmayan liste o zorlukta kullanılmaz). Daily karışık kalır (`era: "all"`); leaderboard dönemlerden bağımsız tektir; sonuç ekranı ve geçmiş dönemi gösterir. Doğrulama: 6 mod × 4 zorluk × 2 dönem = 48 kombinasyonun hepsi gerçek veriyle tam oturum üretir ve her cevap dönemle eşleşir (test) |
| F17 | **Oyuncu kapakları** (kullanıcı isteği, 2026-11-20) — her oyun kartının ve oyun giriş ekranının kapağında, seçili döneme göre bir yıldız oyuncunun fotoğrafı | Zorunlu | Eşleşme (Current / Retired): Starting Five = Curry / Jordan · Team Journey = LeBron / Shaq · Teammate Challenge = Dončić / Magic · Career Stats = Jokić / Kareem · Box Score = Giannis / Kobe · Top 10 = Durant / Duncan. Fotoğraf NBA CDN 260x190, `unoptimized`; yüklenemezse ya da `NEXT_PUBLIC_REMOTE_MEDIA=false` ise baş harfli fallback; `alt` = oyuncu adı |
| F18 | **Türkçe dil** (kullanıcı isteği, 2026-11-20) — arayüz Türkçe ve İngilizce | Zorunlu | Dil sırası: `ng_lang` cookie → tarayıcı dili (`Accept-Language` tr → Türkçe) → İngilizce. Nav'da TR \| EN seçici; `<html lang>` dile göre. Tüm arayüz metinleri, sayfa başlıkları, aria etiketleri ve hata mesajları (API hata koduna göre istemcide) çevrilir; sayı ve tarihler `Intl` ile yerelleştirilir. Oyun modu adları (Starting Five…) ve istatistik kısaltmaları (PPG, REB…) iki dilde de İngilizce kalır. Ek paket yok: sözlükler `src/lib/i18n/` altında, Türkçe sözlük İngilizce ile aynı tipte (eksik anahtar derleme hatası) |

### 2.3 Sonraki Sürümler
- Top 10'da "doğru sıralamayı kur" (sürükle-bırak) varyantı.
- E-posta/OAuth ile kalıcı hesap ve cihazlar arası senkron.
- Arkadaş ligleri, paylaşılabilir sonuç kartı.
- Veri setinin canlı bir API'den otomatik güncellenmesi (ücretli plan gerekir).

### 2.4 Kapsam Dışı
- **Canlı skor / gerçek zamanlı maç verisi** — ücretsiz ve güvenilir kaynak yok; oyunlar tarihsel veriyle çalışır.
- **Gerçek zamanlı çok oyunculu (1v1)** — WebSocket altyapısı MVP'yi iki katına çıkarır.
- **Ödeme, reklam, premium** — ticari model tanımlı değil.
- **Native mobil uygulama** — responsive web yeterli.
- **Şifreli hesap / sosyal giriş** — şifre saklamak güvenlik yükü getirir; misafir hesap yeterli.
- **Resmi NBA/takım logoları** — ticari marka; renkli kısaltma rozeti kullanılır. (2026-11-20: kullanıcı NBA logosunu istedi; site resmi NBA ürünü gibi görüneceği ve marka hakkı riski olduğu için eklenmedi; yerine özgün "X'ler ve O'lar" logosu (`LogoMark`, favicon `src/app/icon.svg`) eklendi.)

## 3. Mimari

### 3.1 Genel yaklaşım
Tek Next.js monoliti (App Router). Sunucu tarafı: Server Components + Route Handlers (`src/app/api/**`). Katmanlar ve bağımlılık yönü (yalnızca aşağı doğru):

```
UI (src/app, src/components)
   ↓  fetch / server component çağrısı
API + Servisler (src/app/api, src/server/services)
   ↓                         ↓
Oyun motorları (src/games)   Kalıcılık (src/server/db.ts → Prisma)
   ↓
NBA veri katmanı (src/data — NbaDataSource arayüzü)
```

- **NBA veri katmanı** (`src/data`): `NbaDataSource` arayüzü (`getPlayer`, `searchPlayers`, `getStartingFives`, `getCareerStints`, `getTeammates`, `getCareerStats`, `getBoxScores`, `getLeaderboards`, `getTeams`). MVP uygulaması `StaticNbaDataSource` — NBA API'den `npm run data:sync` ile üretilen `src/data/seed/*.json` snapshot'larını Zod ile doğrulayıp bellekte indeksler (§3.6). Oyun motorları JSON'a değil arayüze bağlıdır → veri kaynağı değişince motorlar değişmez.
- **Oyun motorları** (`src/games/<mode>/engine.ts`): saf fonksiyonlar. `generateQuestion(ds, difficulty, rng, exclude, era?) → GeneratedQuestion | null` (era F16; benzersizlik kontrolleri tüm oyuncular üzerinde) ve `toPublicQuestion(q) → PublicQuestion` (cevap alanları çıkarılmış). DB, HTTP, React importu yasak.
- **Servisler** (`src/server/services`): `game-service` (oturum aç, soru sun, cevap değerlendir, puanla), `daily-service`, `leaderboard-service`, `achievement-service`, `user-service`.
- **Kimlik** (`src/server/auth/session.ts`): misafir kullanıcı id'si HMAC-SHA256 ile imzalanmış httpOnly, `SameSite=Lax`, `Secure` (prod) cookie'de (`ng_uid`, 1 yıl). `node:crypto` kullanılır, ek kütüphane yok.
- **RNG** (`src/games/core/rng.ts`): seed'li deterministik PRNG (mulberry32) — Daily ve testler için.

### 3.2 Route'lar

| Route | Sayfa | İçerik |
|---|---|---|
| `/` | Home | Hero, Daily Challenge kartı, öne çıkan 3 oyun, kısa leaderboard (ilk 5) |
| `/games` | Games | 6 mod kartı (görsel, açıklama, zorluk seçici) |
| `/games/[mode]` | Game Detail | Mod kuralları → zorluk seçimi → oyun → sonuç ekranı |
| `/daily` | Daily Challenge | Bugünün 5 sorusu / zaten oynandıysa sonuç + günlük sıralama |
| `/leaderboard` | Leaderboard | 3 sekme (all / week / day) |
| `/profile` | Profile | Takma ad, istatistikler, rozetler, oyun geçmişi |

`[mode]` slug'ları: `starting-five`, `team-journey`, `teammate-challenge`, `career-stats`, `box-score`, `top-10`. Geçersiz slug → `notFound()`.

### 3.3 API sözleşmesi (tümü JSON, girdiler Zod ile doğrulanır)

Tam tipler: `src/lib/api-types.ts` (tek doğru kaynak; tablo özet).

| Metot & Yol | Girdi | Çıktı |
|---|---|---|
| `GET /api/me` | — | `MeDTO` (puan, en iyi streak, oyun sayısı, doğruluk, 8 rozetin durumu); cookie yoksa misafir oluşturur |
| `PATCH /api/me` | `{ nickname }` | `MeDTO`; çakışmada 409 |
| `GET /api/me/history` | — | `HistoryDTO` (son 20 biten oturum) |
| `POST /api/games/sessions` | `{ mode, difficulty, era? }` (`era`: `current`\|`retired`; yoksa `all`; açıkça `all` gönderilirse 400) | `StartSessionResponse` (oturumun `era` değeri dahil) |
| `GET /api/daily` | — | `DailyStatusDTO` (bugün oynandı mı, sonuç, sonraki sıfırlama) |
| `POST /api/games/sessions/[id]/answer` | `{ questionIndex, answer: { playerId } \| { slots: Record<rank, playerId> } \| { timeout: true } }` (şık id'leri = playerId) | `AnswerResult` (`src/games/core/types.ts`): `{ correct, correctUnits, totalUnits, correctAnswer, points, streak, totalScore, next, summary, newAchievements }` |
| `POST /api/daily/sessions` | — | Daily oturumu (aynı answer endpoint'i kullanılır); bugün oynandıysa 409 |
| `GET /api/players/search?q=` | `q` 2–40 karakter | `PlayerSearchDTO` (en fazla 10; aksan/büyük-küçük harf duyarsız) |
| `GET /api/leaderboard?period=all\|week\|day` | — | `LeaderboardDTO` |

Hata biçimi: `{ error: { code, message } }`; kodlar `VALIDATION` (400), `NOT_FOUND` (404), `CONFLICT` (409), `EXPIRED` (410, 30 dk boşta kalan oturum), `RATE_LIMITED` (429), `INTERNAL` (500).

### 3.4 Veri modeli

**NBA verisi (NBA API'den üretilen JSON snapshot'ları, `src/data/seed/`, şema `src/data/schema.ts`; kaynak eşlemesi §3.6)**

| Varlık | Alanlar |
|---|---|
| `Team` | `id` (ör. `LAL`, tarihî `SEA` dahil), `name`, `city`, `franchiseId`, `primaryColor`, `secondaryColor`, `conference` |
| `Player` | `id` (NBA PERSON_ID), `name`, `position` (G/F/C/G-F/F-C), `fameTier` (1–3), `allStarCount`, `active`, `headshotId` |
| `RosterEntry` | `playerId`, `teamId`, `season` (ör. `2015-16`) |
| `StartingFive` | `id`, `teamId`, `season`, `playerIds[5]` |
| `CareerStint` | `playerId`, `teamId`, `fromSeason`, `toSeason`, `order` |
| `CareerStats` | `playerId`, `games`, `seasons`, `ppg`, `rpg`, `apg`, `spg`, `bpg`, `fgPct` |
| `BoxScoreLine` | `id`, `playerId`, `gameDate`, `teamId`, `opponentId`, `teamScore`, `opponentScore`, `min`, `pts`, `reb`, `ast`, `stl`, `blk`, `fgm`, `fga`, `tpm`, `tpa`, `source` |
| `StatLeaderboard` | `id`, `title`, `statLabel`, `asOf` (tarih), `rows[10]: { rank, playerId, value }`, `source` |

Her JSON dosyası `meta: { snapshotDate, sources[] }` içerir.

**Kullanıcı verisi (Prisma, `prisma/schema.prisma`)**

| Model | Alanlar / kurallar |
|---|---|
| `User` | `id` (cuid), `nickname?` (unique, lowercase kopyası `nicknameKey` unique), `totalPoints`, `bestStreak`, `createdAt` |
| `GameSession` | `id`, `userId`, `mode`, `difficulty`, `isDaily`, `dailyDate?`, `seed`, `currentIndex`, `score`, `streak`, `bestStreak`, `correctCount`, `total`, `status` (`ACTIVE`/`FINISHED`), `era` (`current`/`retired`/`all`, varsayılan `all`), `questionCount`, `lastActivityAt`, `createdAt`, `finishedAt?`; unique(`userId`,`dailyDate`). `total`/`correctCount` birim sayar (Top 10'da her gizli satır 1 birim) |
| `Question` | `id`, `sessionId`, `index`, `payload` (JSON, cevapsız), `answerKey` (JSON, yalnız sunucu), `issuedAt?` (soru sunulunca; görünür olacağı ana göre ileri tarihli, bkz. `difficulty.ts`), `answeredAt?`, `correct?`, `points?`, `units`, `correctUnits` |
| `UserAchievement` | `userId`, `achievementId`, `earnedAt`; unique(`userId`,`achievementId`) |

Rozet tanımları kodda (`src/server/services/achievements.ts`), DB'de değil:
Rozetler oturum bitince değerlendirilir ve sonuç ekranında gösterilir. `first-game` (ilk oturumu bitir) · `perfect-10` (Daily dışı bir oturumda tüm birimler doğru) · `streak-5` · `streak-10` · `expert-win` (Expert'te ≥%70 doğru) · `all-modes` (6 modun her birinde ≥1 oturum) · `daily-3` (3 ardışık gün Daily) · `points-10k` (toplam ≥10.000).

### 3.5 Teknoloji yığını ve seçim gerekçeleri

| Alan | Seçim (sürüm) | Neden | Değerlendirilen alternatif |
|---|---|---|---|
| Runtime | Node.js 24 LTS (yerelde v24.20) | Next 16 desteği, LTS | Bun — ekosistem uyumu daha riskli |
| Framework | Next.js 16.x, App Router, React 19 | İstendi; RSC + Route Handlers ile ayrı backend gerekmez; geniş dokümantasyon | Remix/React Router — istenmedi |
| Dil | TypeScript 5.x `strict` | İstendi | — |
| Stil | Tailwind CSS 4.x (CSS-first `@theme`) | İstendi; tasarım token'ları doğrudan `@theme`'e aktarılır | CSS Modules — token paylaşımı zayıf |
| Animasyon | `motion` 14.x (Framer Motion'ın güncel paketi, `motion/react`) | İstendi; React 19 uyumlu, MIT | CSS transition — karmaşık sekanslar için yetersiz |
| Doğrulama | Zod 4.x | API girdisi + veri seti şeması tek kaynaktan; MIT | Valibot — daha küçük ama ekip bilinirliği düşük |
| ORM / DB | Prisma 7.x (stable; 8.x RC kullanılmaz) + SQLite: yerelde dosya (`@prisma/adapter-better-sqlite3`), yayında Turso — barındırılan libSQL (`@prisma/adapter-libsql/web` + `@libsql/client`, 2026-11-22) | Sıfır kurulum, ücretsiz; Vercel'in salt okunur ve instance'a özel diskinde yerel dosya kullanıcı verisini tutamaz; Turso SQLite uyumlu olduğundan şema, migration'lar ve testler aynı kalır, ücretsiz katmanı var. Migration'ları Turso'ya `npm run db:deploy` uygular (Prisma Migrate libSQL'e bağlanamaz) | Postgres (Neon/Supabase) — migration'ların ve SQLite'a dayanan testlerin Postgres'e taşınmasını gerektirir; Drizzle — daha hafif ama migration akışı ekipçe daha az bilinir |
| NBA verisi | NBA API (stats.nba.com) → `nba_api` 1.12 ile yerel senkron → `src/data/seed/*.json` snapshot + `NbaDataSource` | Ücretsiz ve en kapsamlı kaynak; detay §3.6 | balldontlie, API-Sports (aşağıda) |
| Veri senkronu | Python 3.13 (yerelde 3.13.0) + `nba_api`, `scripts/nba-sync/requirements.txt` ile sabit sürüm | `nba_api` endpoint sarmalayıcıları, başlık/oturum yönetimi hazır; yalnız geliştirme aracı, uygulamaya girmez | TS ile ham `fetch` — başlık ve endpoint bakımı bize kalır |
| Unit/entegrasyon test | Vitest 5.x + @testing-library/react + jsdom | Hızlı, ESM/TS yerel; Next.js dokümanlarında önerilir | Jest — TS/ESM yapılandırması ağır |
| E2E test | Playwright 1.65+ | Çoklu tarayıcı, mobil viewport | Cypress — daha yavaş, mobil emülasyon zayıf |
| Lint/format | ESLint (eslint-config-next, flat config) + Prettier (+ prettier-plugin-tailwindcss) | Standart | Biome — Next kural seti eksik |
| Yardımcı | `tsx` (TS betiklerini çalıştırma), `server-only` (sunucu modülünün istemci paketine girmesini build'de engeller) | `data:validate` betiği ve CLAUDE.md mimari kuralı bunlara dayanır | ts-node — ESM desteği zayıf |

**NBA veri kaynağı karşılaştırması (2026-11 araştırması):**

| Kaynak | Durum | Karar |
|---|---|---|
| **NBA API — stats.nba.com, `nba_api` 1.12 (Python, MIT)** | Ücretsiz, anahtarsız; kariyer, kadro, beşli, maç satırı ve all-time sıralama verisinin tamamı var. Resmi olmayan uç; bulut IP aralıklarını (AWS/GCP/Azure/Vercel) engelliyor ve throttle uyguluyor. 2026-11-19'da bu geliştirme makinesinden erişim doğrulandı (HTTP 200, 0.5 sn) | **Veri kaynağı** — yalnızca yerel senkron hattında, çalışma zamanında değil |
| balldontlie.io | Ücretsiz katman 5 istek/dk; `/stats` (box score) ücretli; NBA ayrı abonelik ($9.99+/ay) | Kullanılmaz — ücretsiz katman yetersiz |
| API-Sports (API-NBA) | Ücretli/kotalı (bu oturumda doğrulanmadı) | Kullanılmaz |

### 3.6 NBA API veri hattı
Veri **NBA API'den gelir**, ama canlı istekle değil: `npm run data:sync` geliştirici makinesinde çalışır, NBA API'den çeker, dönüştürür ve `src/data/seed/*.json` snapshot'larını yazar. Snapshot'lar repoya commit edilir; uygulama ve CI yalnızca bunları okur. Sebep: stats.nba.com bulut sunucularından gelen istekleri engeller, canlı çağrı prod'da çalışmaz.

| Seed dosyası | `nba_api` endpoint'i | Dönüşüm kuralı |
|---|---|---|
| `teams.json` | `static.teams` | Takım renkleri API'de yok → betikteki sabit 30 takımlık renk tablosu |
| `players.json` | `commonallplayers` (IsOnlyCurrentSeason=0) + `playerawards` | Havuz: 1996-97…2025-26 arasında ≥300 maç (süre bütçesi için ≥100'den yükseltildi) + beşli/box score/liderlik listelerinde geçen oyuncular (1.094). Pozisyon `playerindex`'ten. `headshotId` = `PERSON_ID`. `fameTier`: 1 = ≥3 All-Star seçimi veya MVP; 2 = ≥1 All-Star ya da ≥500 maç; 3 = diğerleri |
| `career-stats.json`, `career-stints.json` | `playercareerstats` | Ortalamalar `CareerTotalsRegularSeason`'dan; stint'ler `SeasonTotalsRegularSeason` satırlarından, `TOT` satırı atlanır, ardışık aynı takım sezonları birleştirilir |
| `rosters.json` | `playercareerstats` sezon satırları (`commonteamroster` yerine; ~900 istek tasarrufu) | 1996-97…2025-26 |
| `starting-fives.json` | `leaguedashlineups` (GroupQuantity=5, sezon başına) + `boxscoretraditionalv3` | 2007-08 ve sonrası: o takım-sezonda **en çok dakika oynayan beşli**; 1996-97…2006-07: açılış gecesi ilk beşi (F16 ek verisi) |
| `box-scores.json` | `leaguegamelog` (PlayerOrTeam=P ve T, sezon başına) | Oyuncu satırı + takım skorları; seçim: PTS ≥ 40 veya triple-double, sezon başına en fazla 10 |
| `leaderboards.json` | `alltimeleadersgrids` | PTS, REB, AST, STL, BLK, FG3M, GP, FTM, FGM listelerinin ilk 10'u (9 liste) |

Dönem ayrımı için ek veri (F16):
- **Aktif liderler listeleri** (`leaderboards.json`, `scope: "active"`, id `active-career-*`): adaylar maç kayıtlarından elenir, ardından ~45 aday için resmi `playercareerstats` (PerMode=Totals) toplamları çekilir (PTS, REB, AST, STL, BLK, FG3M, GP, FTM, FGM — 9 liste). Ortalama × maç yaklaşımı kullanılmaz (yanlış toplam verir).
- **1996 öncesi efsaneler:** `alltimeleadersgrids` (TopX=50) listelerinde geçen 77 oyuncu (Magic, Bird, Russell, Chamberlain…) havuza tam kariyerleriyle eklenir; havuz oyuncularının kadro (`rosters`) penceresi tüm sezonlara genişletilir. Tarihî takımlar (BLT, BUF, CAP, KCK, MIH, NOJ, SDC, SFW, STL, SYR… 17 kod) `teams.json`'a eklenir: ad/şehir `franchisehistory`'den, `franchiseId` TEAM_ID'den, konferans sabit tablodan; renkleri `globals.css` tarihî takım token bloğunda. GOS/PHL/SAN/UTH aynı takımın 1996 öncesi yazımları olduğundan GSW/PHI/SAS/UTA'ya çevrilir.
- **2007 öncesi ilk beşler:** 1996-97…2006-07 için her takım-sezonun ilk maçının (açılış gecesi) ilk beşi `boxscoretraditionalv3` başlangıç pozisyonlarından alınır (322 beşli; id `…-opener`, `minutes: 0` çünkü box score beşlinin birlikte süresini vermez).

Hat kuralları (`scripts/nba-sync/sync.py`):
- İstekler arası ≥0.7 sn, istek zaman aşımı 30 sn, 3 deneme (üstel bekleme). Tahmini tam senkron: ~2.000 istek, ~30 dk.
- Ham yanıtlar `data-cache/` altında önbelleklenir (gitignore); yarıda kesilen senkron kaldığı yerden devam eder.
- Her seed dosyası `meta: { snapshotDate, source: "stats.nba.com via nba_api 1.12.0", endpoints[] }` içerir; her kayıtta `source` = endpoint adı.
- Erişim başarısızsa (zaman aşımı/403) betik `"NBA API'ye erişilemedi — seed dosyaları değiştirilmedi"` yazar, 1 ile çıkar ve mevcut seed'lere dokunmaz. Hata olmasa da çalışıyor gibi gösterilmez.
- Senkron sonunda otomatik `npm run data:validate` çalışır; doğrulama başarısızsa yeni dosyalar yazılmaz (geçici klasörden atomik taşıma).

**Görseller:** Oyuncu fotoğrafı `https://cdn.nba.com/headshots/nba/latest/260x190/{headshotId}.png` (~17 KB), `next/image` ile ama `unoptimized`: tarayıcı doğrudan CDN'den yükler. Sunucudaki `/_next/image` proxy'si kullanılmaz — yavaş bir upstream o istekleri asılı bırakıp aynı origin'in bağlantılarını doldurunca cevap isteği kuyrukta takılıyordu. `NEXT_PUBLIC_REMOTE_MEDIA=false` ise veya `headshotId` yoksa veya yükleme hatasında → baş harfli, takım rengiyle `PlayerAvatar` fallback. Takımlar için logo yerine `TeamBadge` (kısaltma + takım renkleri).

## 4. Klasör Yapısı

```
NbaGamesApp/
├── README.md · CLAUDE.md          # CLAUDE.md kökte kalır: Claude Code her oturumda okur
├── docs/                        # ISKELET.md · AGENT.md · TASARIM_PROMPT.md
├── .env.example                 # değişken adları, gerçek değer yok
├── design/
│   └── design.html              # Claude Design çıktısı: tüm ekranlar, durumlar ve token'lar tek dosyada (salt okunur)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts
├── scripts/
│   ├── validate-data.ts         # seed JSON'larını Zod ile doğrular
│   ├── db-deploy.ts             # migration'ları Turso'ya uygular (npm run db:deploy)
│   └── nba-sync/                # NBA API veri hattı (Python): sync.py, requirements.txt
├── data-cache/                  # ham NBA API yanıtları (gitignore)
├── src/
│   ├── app/
│   │   ├── layout.tsx · page.tsx · globals.css · not-found.tsx · error.tsx
│   │   ├── games/page.tsx · games/[mode]/page.tsx
│   │   ├── daily/page.tsx · leaderboard/page.tsx · profile/page.tsx
│   │   └── api/                 # §3.3 route handler'ları
│   ├── components/
│   │   ├── ui/                  # Button, Card, Badge, Tabs, Skeleton, Toast...
│   │   ├── layout/              # TopNav, BottomTabBar, Footer
│   │   └── game/                # GameCard, QuestionCard, AnswerOption, PlayerSearch, TimerBar, StreakMeter, ResultSummary, ...
│   ├── games/
│   │   ├── core/                # types.ts, scoring.ts, rng.ts, difficulty.ts, registry.ts
│   │   ├── starting-five/engine.ts (+ engine.test.ts)
│   │   ├── team-journey/ · teammate-challenge/ · career-stats/ · box-score/ · top-10/
│   ├── data/
│   │   ├── schema.ts            # Zod şemaları
│   │   ├── source.ts            # NbaDataSource arayüzü
│   │   ├── static-source.ts     # StaticNbaDataSource
│   │   └── seed/                # teams, players, rosters, starting-fives, career-stats, career-stints, box-scores, leaderboards (.json)
│   ├── server/
│   │   ├── db.ts · rate-limit.ts · errors.ts
│   │   ├── auth/session.ts
│   │   └── services/            # game-service.ts, daily-service.ts, leaderboard-service.ts, achievements.ts, user-service.ts
│   └── lib/                     # utils (cn, format), client fetch yardımcıları
└── tests/
    └── e2e/                     # Playwright senaryoları
```
Unit testler test edilen dosyanın yanında `*.test.ts(x)`.

## 5. Kısıtlar

- **Teknik:** Yalnızca açık kaynak (MIT/Apache/ISC) bağımlılıklar. Çalışma zamanında ücretli servis veya NBA veri API'si yok; yayındaki veritabanı Turso'nun ücretsiz katmanıdır (kullanıcı kararı, 2026-11-22). Yeni bağımlılık AGENT.md onay kuralına tabi.
- **Performans (ölçülebilir):**
  - Lighthouse (mobil, `npm run build && npm start`) Performance ≥ 85, Accessibility ≥ 95 — Home ve `/games`.
  - LCP < 2.5 sn, CLS < 0.1 (Lighthouse mobil profili).
  - `POST /api/games/sessions/[id]/answer` yerelde p95 < 150 ms (entegrasyon testinde 50 çağrı ölçümü).
  - İlk yükte istemci JS (route başına, gzip) < 200 KB (`next build` çıktısı).
- **Güvenlik / gizlilik:**
  - Kişisel veri toplanmaz (e-posta, şifre yok); yalnızca takma ad.
  - Tüm API girdileri Zod ile doğrulanır; geçersiz → 400 `VALIDATION`.
  - Rate limit (bellek içi token bucket, kullanıcı id'si veya IP başına): answer 30 istek/10 sn, search 20 istek/10 sn, diğer yazma uçları 10 istek/dk → 429.
  - `SESSION_SECRET` (≥32 bayt) yalnızca `.env`; `.env*` git'e girmez (yalnız `.env.example`).
  - Takma ad filtresi: `src/server/services/nickname-blocklist.ts` içindeki küfür/rezerve kelime listesi (`admin`, `nba`, `moderator` dahil).
  - Cevap anahtarı (`answerKey`) hiçbir API yanıtında, cevap verilmeden yer almaz (entegrasyon testi).
  - Güvenlik başlıkları `next.config.ts` `headers()`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, temel CSP (img-src `self` + `cdn.nba.com`).
- **Erişilebilirlik:** Klavye ile tam oynanabilir (şıklar 1–6 tuşlarıyla seçilebilir), WCAG AA kontrast, `prefers-reduced-motion` desteği.
- **Zaman / bütçe:** Bütçe 0 TL (ücretsiz servisler). Süre kısıtı belirtilmedi; aşamalar bağımsız teslim edilebilir.

## 6. Geliştirme Aşamaları

| Aşama | İçerik | Bitti Kriteri |
|---|---|---|
| 0 | Tasarım: TASARIM_PROMPT.md → Claude Design → tek dosya `design/design.html` | Dosya repoda ve TASARIM_PROMPT §10 kurallarını sağlıyor (8 bölüm, 6 mod varyantı, durum seçicileri, `:root` token'ları); CLAUDE.md/AGENT.md tasarıma göre güncellendi |
| 1 | Kurulum: Next.js, Tailwind (design token'ları), ESLint/Prettier, Vitest, Playwright, Prisma + SQLite, `.env.example` | `npm run lint && npm run typecheck && npm test && npm run build` yeşil; boş layout tasarım token'larıyla render |
| 2 | Veri katmanı: Zod şemaları, `NbaDataSource`, `StaticNbaDataSource`, NBA API veri hattı (`scripts/nba-sync`), seed snapshot'larının üretilip commit'e hazırlanması | `npm run data:sync` yerelde hatasız tamamlanır; `npm run data:validate` 0 hata; §2.2 adet minimumları testle doğrulanır |
| 3 | Oyun motorları (6 mod) + `core` (scoring, rng, difficulty) | Her motor için: 4 zorlukta 100 rastgele seed ile soru üretimi hatasız, `toPublicQuestion` cevap içermiyor; scoring tablosu testleri |
| 4 | Backend: Prisma şeması, auth cookie, servisler, §3.3 API'ler, rate limit | API entegrasyon testleri (oturum aç → 10 cevap → özet; Daily 409; nickname 409; answerKey sızmıyor) |
| 5 | UI: layout/navigasyon, 6 sayfa, oyun akışı, animasyonlar, durum ekranları | Tasarımla görsel karşılaştırma checklist'i; 360/768/1280 px'te kırılma yok |
| 6 | Rekabet: Daily, Leaderboard, Profile, Achievements, History | F7–F13 kabul kriterleri testle doğrulandı |
| 7 | Sertleştirme: e2e, erişilebilirlik, performans, son denetim | §5 performans hedefleri ölçüldü; tüm e2e senaryoları yeşil |

Kod içeren tüm aşamalar (1–7) Aşama 0 bitmeden başlamaz. Aşama 2 ile Aşama 4'ün Prisma kısmı paralel yürütülebilir; Aşama 3, 2'ye bağımlıdır.

## 7. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| NBA API (resmi olmayan uç) değişir, engeller veya throttle eder | Senkron çalışmaz, veri güncellenemez | Uygulama çalışma zamanında API'ye bağlı değil (commit'li snapshot); ham yanıt önbelleği; erişim yoksa betik açık hata verir ve seed'lere dokunmaz; `nba_api` sürümü sabit |
| Bulut ortamında (CI, Vercel) senkron denenirse IP engeli | Zaman aşımı, yanlışlıkla boş veri | Senkron yalnız geliştirici makinesinde; CI yalnız `data:validate` çalıştırır |
| NBA.com kullanım koşulları veri kullanımını kısıtlayabilir | Ticari yayında hukuki risk | Kişisel/eğitsel proje varsayımı (V4); ticari yayından önce koşullar kontrol edilir |
| Dönüşüm hatası (yanlış stint birleştirme, eksik beşli) | "Yanlış doğru cevap" | Zod + mantık kontrolleri (beşlide 5 farklı oyuncu, stint sezon sırası, FGM ≤ FGA, ilk 10 sıralı); dönüşüm fonksiyonları için sabit örnek yanıtlarla pytest testleri (`scripts/nba-sync/test_transform.py`, `npm run data:test`); footer'da veri tarihi |
| NBA CDN fotoğraflarının lisans/erişim sorunu | Görseller kırılır veya kaldırılması gerekir | `NEXT_PUBLIC_REMOTE_MEDIA` bayrağı + baş harfli avatar fallback; ticari yayından önce hukuki kontrol |
| Misafir cookie silinirse hesap kaybolur | Kullanıcı puanını kaybeder | Profilde açık uyarı metni; kalıcı hesap Sonraki Sürümler'de |
| Bellek içi rate limit çok instance'ta çalışmaz | Vercel'de her instance ayrı sayar, limit atlatılabilir | Açık nokta (V6); `RateLimiter` arayüzü ortak depoya (veritabanı tablosu ya da Redis) geçiş noktası |
| SQLite dosyası sunucusuz ortamda kalıcı değil | Prod'da veri kaybı | Yayında Turso kullanılır (`TURSO_DATABASE_URL`); değişken yoksa `vercel-build` içindeki `db:deploy` hata verip build'i durdurur; deploy onay gerektirir |
| Turso'ya migration yarıda kalır | Şema yarım kalır | `db:deploy` başarısız migration'ı `_prisma_migrations`'a kaydeder ve elle düzeltilene kadar sonraki deploy'ları durdurur; migration'lar önce yerelde ve libSQL test projesinde çalışır |
| Hard/Expert'te autocomplete cevabı ele verir (ör. tek eşleşme) | Zorluk düşer | Arama en az 2 karakter ister, tüm oyuncu havuzundan (sadece cevaplardan değil) sonuç döner |
| Tasarım çıktısı gecikir veya eksik gelir | Tüm geliştirme bloke (kod tasarımdan sonra başlar) | Teslim tek HTML dosyasıyla sınırlı ve TASARIM_PROMPT §10'da kontrol edilebilir kurallarla tanımlı; eksik bölüm "Tasarım geldikten sonra" listesiyle hemen tespit edilip yalnız o bölüm yeniden istenir |

## 8. Varsayımlar
(En etkili olanlar üstte; hepsi değiştirilebilir.)

- **V1:** NBA verisi NBA API'den (stats.nba.com, `nba_api`) gelir; yerelde senkronlanıp JSON snapshot olarak commit edilir, uygulama canlı API çağrısı yapmaz. Kapsam 1996-97…2025-26 sezonları (`meta.snapshotDate`); beşliler 2007-08'den itibaren.
- **V2:** Kimlik = misafir hesap + takma ad; şifre/e-posta yok.
- **V3:** Hard/Expert cevapları serbest metin değil, veri setinden autocomplete ile seçilir (yazım hatası sorununu ortadan kaldırır).
- **V4:** Oyuncu görselleri NBA CDN'den kullanılır (kişisel/eğitsel proje); takım logoları kullanılmaz.
- **V5:** Arayüz Türkçe ve İngilizce (F18); oyun modu adları ve istatistik kısaltmaları iki dilde de İngilizce. Dokümanlar Türkçe.
- **V6:** Dağıtım hedefi Vercel + Turso (kullanıcı kararı, 2026-11-22); kendi sunucuda `npm start` + yerel SQLite dosyası da çalışır. Rate limit bellek içidir: Vercel'de her instance ayrı sayar (açık nokta).
- **V7:** Gün sınırı UTC'dir (Daily ve "Bugün" sıralaması).
- **V8:** Leaderboard "Son 7 gün" = son 7×24 saatte cevaplanan soruların `Question.points` toplamı (yarıda kalan oturumların puanı da sayılır, V9 ile tutarlı); "Bugün" = bugünkü Daily oturumunun puanı; "Tüm zamanlar" = `User.totalPoints`. Daily puanları totalPoints'e dahildir.
- **V9:** Yarıda bırakılan (30 dk'dan eski `ACTIVE`) oturumlar puan kazanmış soruları korur ama geçmişte "terk edildi" görünmez; leaderboard'a yalnız kazanılan puan yansır.
- **V10:** Paket yöneticisi npm; Node 24 LTS.
- **V11:** "Aktif" = snapshot anındaki güncel sezonda bir NBA kadrosunda olmak (`commonallplayers` ROSTERSTATUS). Varsayılan dönem Current'tır; Daily ve leaderboard dönem ayrımı yapmaz.
