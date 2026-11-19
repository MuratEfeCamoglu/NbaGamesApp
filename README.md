# NBA Games

NBA oyuncuları, takımları, kadroları ve istatistikleri üzerine bilgi oyunları oynanan, responsive bir web uygulaması. Kullanıcılar 6 farklı oyun modunda puan toplar, her gün yenilenen Daily Challenge'ı çözer ve liderlik tablosunda yarışır. Arayüz İngilizcedir; NBA verisi gerçek NBA istatistiklerinden (stats.nba.com) üretilir.

## Özellikler

| Mod | Nasıl oynanır |
|---|---|
| **Starting Five** | Bir takımın sezondaki ilk beşinden 4 oyuncu gösterilir; eksik oyuncuyu bul. |
| **Team Journey** | Bir oyuncunun kariyerinde oynadığı takımlar sırayla gösterilir; oyuncuyu bul. |
| **Teammate Challenge** | Takım arkadaşlarından yola çıkarak ortak oyuncuyu bul. |
| **Career Stats** | Kariyer ortalamalarından (PPG, RPG, APG…) oyuncuyu bul. |
| **Box Score** | Gerçek bir maçtaki istatistik satırının kime ait olduğunu bul. |
| **Top 10 Challenge** | All-time sıralama listelerindeki gizli isimleri doldur. |

- **4 zorluk:** Easy (4 şık), Medium (6 şık), Hard (oyuncu arama), Expert (arama + daha az ipucu).
- **Puanlama:** Taban puan + süre bonusu + streak bonusu, zorluk çarpanıyla. Cevaplar ve süre sunucuda doğrulanır; doğru cevap istemciye önceden gönderilmez.
- **Daily Challenge:** Her UTC gününde herkese aynı 5 soru, kullanıcı başına bir deneme.
- **Rekabet:** Leaderboard (tüm zamanlar / son 7 gün / bugün), profil, 8 rozet, oyun geçmişi.
- **Hesap gerektirmez:** İlk ziyarette misafir hesap açılır (imzalı cookie); leaderboard'da görünmek için takma ad belirlenir.

## Teknolojiler

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · `motion` · Zod 4 · Prisma 7 + SQLite · Vitest 5 · Playwright · Python 3.13 + [`nba_api`](https://github.com/swar/nba_api) (yalnızca veri senkronu için).

## Kurulum

Gereksinimler: **Node.js 24+**, npm. Veriyi yeniden çekmek isterseniz **Python 3.13+**.

```bash
npm install                 # bağımlılıklar + Prisma istemcisi (postinstall)
cp .env.example .env        # ardından SESSION_SECRET'i doldurun (aşağıya bakın)
npm run db:migrate          # yerel SQLite veritabanı (dev.db)
npm run dev                 # http://localhost:3000
```

`SESSION_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

NBA verisi repoda hazır gelir (`src/data/seed/`), API anahtarı gerekmez.

### Ortam değişkenleri (`.env`)

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | SQLite dosyası, varsayılan `file:./dev.db` |
| `SESSION_SECRET` | Misafir cookie'sini imzalamak için ≥32 bayt rastgele değer |
| `NEXT_PUBLIC_REMOTE_MEDIA` | `true` ise oyuncu fotoğrafları NBA CDN'den yüklenir; `false` ise baş harfli avatar |
| `TRUST_PROXY` | Ters proxy arkasında `true`: rate limit için `X-Forwarded-For` kullanılır |
| `GUEST_LIMIT_PER_HOUR` | İstemci başına saatlik yeni misafir sınırı (varsayılan 10) |

> Yayına alırken: proxy arkasında `TRUST_PROXY=true` ayarlanmazsa tüm çerezsiz ziyaretçiler tek bir misafir kotasını paylaşır.

## Komutlar

| Komut | İş |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Production build ve çalıştırma |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript kontrolü |
| `npm run format` | Prettier ile biçimlendirme |
| `npm test` | Unit + entegrasyon testleri (Vitest) |
| `npm run test:e2e` | Uçtan uca testler (Playwright; ilk sefer `npx playwright install chromium`) |
| `npm run verify` | lint + typecheck + test + veri doğrulama + build |
| `npm run db:migrate` | Prisma migration |
| `npm run data:validate` | Seed verisini şema ve bütünlük kurallarına göre doğrular |
| `npm run data:sync` | NBA API'den veriyi yeniden çeker (aşağıya bakın) |
| `npm run data:test` | Veri hattı (Python) testleri |

## NBA verisi

Uygulama çalışırken NBA API'yi çağırmaz; veriler `src/data/seed/*.json` dosyalarından okunur. Bu dosyalar `npm run data:sync` ile stats.nba.com'dan üretilir (1996-97 → güncel sezon; 1.094 oyuncu, 568 ilk beş, 300 box score, 9 all-time liste).

Veriyi yenilemek için (yaklaşık 50 dakika, yalnızca kendi bilgisayarınızda — stats.nba.com bulut sunucularını engeller):

```bash
python -m venv .venv
.venv/Scripts/pip install -r scripts/nba-sync/requirements.txt   # macOS/Linux: .venv/bin/pip
npm run data:sync
```

Senkron, ham yanıtları `data-cache/` altında önbelleğe alır (yarıda kalırsa kaldığı yerden devam eder) ve yeni dosyaları ancak doğrulamadan geçerse yazar.

## Proje yapısı

```
├── docs/                 Planlama dokümanları (kapsam, ajan rehberi, tasarım promptu)
├── design/design.html    Görsel tasarım referansı (tüm ekranlar tek dosyada)
├── prisma/               Veritabanı şeması ve migration'lar
├── scripts/
│   ├── nba-sync/         NBA API veri hattı (Python)
│   └── validate-data.ts  Seed doğrulama
├── src/
│   ├── app/              Sayfalar (App Router) ve API route'ları (app/api)
│   ├── components/       ui/ (temel), layout/ (navigasyon), game/ (oyun ve rekabet bileşenleri)
│   ├── games/            Oyun motorları — her mod bir klasör; core/ (tipler, puanlama, RNG)
│   ├── data/             NBA veri katmanı (şema, NbaDataSource, seed/*.json)
│   ├── server/           Servisler, oturum, rate limit, veritabanı
│   └── lib/              İstemci API katmanı ve yardımcılar
└── tests/e2e/            Playwright testleri
```

Katmanlar tek yönlüdür: `app/components → server → games → data`. Oyun motorları saf fonksiyonlardır ve veriye yalnızca `NbaDataSource` arayüzüyle erişir.

## Dokümanlar

- [CLAUDE.md](CLAUDE.md) — kod kuralları ve komutlar (Claude Code oturum rehberi)
- [docs/ISKELET.md](docs/ISKELET.md) — kapsam, kabul kriterleri, mimari, veri modeli, API sözleşmesi
- [docs/AGENT.md](docs/AGENT.md) — ajan rolleri ve çalışma kuralları
- [docs/TASARIM_PROMPT.md](docs/TASARIM_PROMPT.md) — tasarımın üretildiği Claude Design promptu

## Bilinen açık noktalar

- Kariyer verisi devam eden 2026-27 sezonunu da içeriyor; alt bilgi ise "2025-26" diyor.
- Leaderboard'da listede olan kullanıcı için "You" satırı ayrıca bir kez daha görünüyor; oyun biter bitmez menüdeki puan kısa süre 0 görünebiliyor.
- Lighthouse puanları ölçülmedi.

## Veri ve lisans notu

NBA istatistikleri stats.nba.com'dan kişisel/eğitsel amaçla alınır; oyuncu fotoğrafları NBA CDN'den yüklenir. Resmi NBA veya takım logoları kullanılmaz. Ticari kullanımdan önce NBA.com kullanım koşullarını kontrol edin.
