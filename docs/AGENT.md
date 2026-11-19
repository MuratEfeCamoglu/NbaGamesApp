# NBA Games — Ajan Rehberi

> Kapsam: ISKELET.md · Kod ve komut kuralları: CLAUDE.md · Tasarım: `design/design.html` + TASARIM_PROMPT.md.
> Bu dosya ISKELET.md sınırlarını ve CLAUDE.md kurallarını genişletemez; çelişkide onlar geçerlidir.

## 1. Ana Ajan (Orchestrator)

Rol: Projenin teknik lideri. Kod yazmaktan çok işi bölen, dağıtan, denetleyen ve birleştiren taraftır.

Görevler:
1. Kullanıcı isteğini ISKELET.md'deki özellik (F1–F15) ve aşamaya (0–7) eşler.
2. İşi alt görevlere böler; her alt görev için sahip ajanı, dokunacağı dosyaları, kabul kriterini ve doğrulama komutunu yazar.
3. Dosya sahipliği tablosuna (§3) göre çakışmasız dağıtır; bağımsız görevleri paralel başlatır.
4. Her alt ajan çıktısını kendisi okur (diff + test çıktısı); yalnızca rapora güvenmez.
5. Paylaşılan dosyalardaki (§3 "Orchestrator" satırı) değişiklikleri kendisi yapar.
6. Aşama sonunda `npm run verify` çalıştırır, sonuçları ve açık kalanları kullanıcıya raporlar.
7. Dokümanları (ISKELET/CLAUDE/AGENT) güncel tutar.

Alt ajan aracı yoksa: aynı uzmanlık ayrımıyla görevleri sırayla kendisi yürütür ve raporda "alt ajan kullanılmadı, X rolü ana ajan tarafından yürütüldü" der. Kullanılmayan ajan kullanılmış gibi raporlanmaz.

## 2. Alt Ajanlar

Bu proje için 8 rol kullanılır. **Database** ayrı ajan değildir: Prisma şeması 4 model, Backend ajanına aittir (ayrı ajan koordinasyon maliyeti getirir, fayda sağlamaz).

| Ajan | Sorumluluk | Girdi | Çıktı / bitti |
|---|---|---|---|
| **Architect** | Aşama 1 iskeleti, `games/core` tipleri, `NbaDataSource` arayüzü, API tip sözleşmeleri; mimari kararlar | ISKELET §3 | Tip dosyaları derleniyor; karar notu ISKELET'e işlendi |
| **Integration** | NBA API veri hattı (`scripts/nba-sync`, `nba_api`), seed snapshot üretimi, Zod şemaları, `StaticNbaDataSource`, `validate-data.ts` | ISKELET §3.4, §3.6, §2.2 adet minimumları | `npm run data:sync` yerelde tamam; `data:test` ve `data:validate` yeşil; adet testleri yeşil; her dosyada `meta.source` |
| **Backend** | Prisma şeması/migration, auth cookie, servisler, Route Handler'lar, rate limit, oyun motorları (`src/games/<mode>`) | ISKELET §2.1, §3.3, §3.4 | Unit + API entegrasyon testleri yeşil |
| **UI/UX** | `design.html` `:root` token'larını `globals.css` `@theme`'e aktarma, `components/ui` temel bileşenleri, tasarım uygunluk kontrolü | `design/design.html` | Token'lar birebir; bileşen adları/varyantları `data-component`/`data-variant` ile aynı |
| **Frontend** | Sayfalar, `components/game`, `components/layout`, oyun akışı, animasyonlar, durum ekranları | `design/design.html` ekran bölümleri, API sözleşmesi | Bileşen testleri + 3 breakpoint kontrolü |
| **Test** | Test stratejisi, eksik testler, Playwright e2e, performans/erişilebilirlik ölçümleri | Kabul kriterleri | Test raporu: komut, geçen/kalan, başarısızlıkların sahibi |
| **Code Review** | Her aşama sonu diff incelemesi: kurallar (CLAUDE.md), güvenlik (answerKey sızıntısı, Zod, secret), mimari yön | Diff | Bulgular KRİTİK/ORTA/KÜÇÜK; KRİTİK varken aşama kapanmaz |
| **Debug** | Başarısız test/build için kök neden analizi ve minimal düzeltme | Hata çıktısı | Kök neden + düzeltme + yeniden geçen test |

Koordinasyon:
- Paralel yürütülebilir: Integration (Aşama 2) ‖ Backend Prisma/auth (Aşama 4'ün ilk kısmı) ‖ UI/UX token aktarımı (tasarım geldikten sonra).
- Sıralı: Architect → (Integration, Backend) → oyun motorları → API → Frontend → Test → Code Review.
- Bir ajan başka ajanın dosyasında değişiklik gerekiyorsa yapmaz; Orchestrator'a "değişiklik isteği" döner.
- Arayüz (tip) değişikliği yalnızca Architect + Orchestrator onayıyla.

## 3. Dosya Sahipliği (çakışma önleme)

| Yol | Sahip |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.env.example`, `prisma.config.ts`, `src/app/layout.tsx`, `src/games/core/registry.ts`, dokümanlar (*.md) | Orchestrator |
| `src/games/core/types.ts`, `src/data/source.ts` | Architect |
| `src/data/**` (source.ts hariç), `scripts/**`, `data-cache/` | Integration |
| `prisma/**`, `src/server/**`, `src/app/api/**`, `src/games/**` (core/types.ts ve registry.ts hariç) | Backend |
| `src/app/globals.css`, `src/app/design.css`, `src/components/ui/**` | UI/UX |
| `src/app/**` (api, layout.tsx, globals.css hariç), `src/components/game/**`, `src/components/layout/**`, `src/lib/**` | Frontend |
| `tests/e2e/**`, `playwright.config.ts`, `vitest.config.ts` | Test |
| `design/design.html` | Kimse (salt okunur; yalnız kullanıcı günceller) |

Aynı anda bir dosyayı yalnızca sahibi değiştirir. Colocated `*.test.ts` dosyaları, test ettiği dosyanın sahibine aittir; Test ajanı eksik testi o sahibe görev olarak açar ya da Orchestrator onayıyla yazar.

## 4. Yetkiler

### İzin gerektirmeden yapılabilir
- Sahiplik tablosundaki kendi dosyalarını oluşturma/düzenleme.
- CLAUDE.md'deki komutları çalıştırma (`db:reset` hariç), yerelde `npm run data:sync` dahil.
- `npm run db:migrate` ile yeni migration oluşturma (yerel SQLite).
- ISKELET §3.5'te listelenmiş paketleri kurma.
- `.env` dosyasını yerelde `.env.example`'dan oluşturup `SESSION_SECRET` üretme.

### Onay gerektirir (önce kullanıcıya sor)
- §3.5 dışında yeni bağımlılık — çünkü bundle boyutu (<200 KB) ve lisans kısıtını etkiler.
- Ücretli servis, API anahtarı satın alma, harici hesap açma — çünkü bütçe 0.
- Production dağıtımı, hosting/DB sağlayıcı seçimi — çünkü geri alınması zor ve maliyetli.
- `git commit`, `git push`, branch silme, PR açma — çünkü kullanıcının geçmişini değiştirir.
- `npm run db:reset` veya migration silme — çünkü kullanıcı verisini yok eder.
- ISKELET.md kapsamını (F-listesi, kapsam dışı) değiştirme — çünkü ürün kararıdır.
- Yayımlanmış API sözleşmesini (§3.3) kırıcı biçimde değiştirme.

## 5. Yasaklar
- API anahtarı, `SESSION_SECRET` veya `.env` içeriğini koda, loga, commit'e yazmak — çünkü sızıntı geri alınamaz.
- `answerKey`'i veya doğru cevabı cevap öncesi istemciye göndermek — çünkü oyun hilelenir ve leaderboard anlamsızlaşır.
- `design/design.html` eklenmeden kod yazmak ya da tasarımdan farklı UI icat etmek — çünkü tasarım tek görsel kaynaktır, sonradan yeniden yazım maliyeti doğar.
- Seed JSON'larını elle düzenlemek veya NBA API dışından veri eklemek — çünkü bilgi oyununun tek değeri doğruluktur ve snapshot her senkronda yeniden üretilir; elle düzeltme kaybolur. Hata varsa dönüşüm kuralı (`scripts/nba-sync`) düzeltilir.
- Uygulama koduna (route, servis, bileşen) stats.nba.com çağrısı koymak veya senkronu CI/sunucuda çalıştırmak — çünkü NBA API bulut IP'lerini engeller, prod'da kırılır.
- Senkron istek aralığını 0.7 sn'nin altına indirmek — çünkü NBA API throttle/IP engeli uygular, yerel erişim de kaybedilebilir.
- Erişilemeyen bir dış servisi mock'layıp çalışıyor gibi raporlamak — çünkü kullanıcı yanlış karar verir.
- Başarısız testi silmek, `skip` etmek veya beklentisini gevşeterek geçirmek — çünkü hatayı gizler. (Test yanlışsa gerekçesiyle düzeltilir ve raporlanır.)
- Kapsam dışı (ISKELET §2.4) özellik eklemek — çünkü kapsam kayması MVP'yi geciktirir.
- `--no-verify`, `eslint-disable` dosya geneli, `@ts-ignore` — çünkü kalite kapılarını devre dışı bırakır. (`@ts-expect-error` gerekçe yorumuyla istisnadır.)
- Sahibi olmadığı dosyayı değiştirmek — çünkü paralel çalışmada üzerine yazma olur.

## 6. Görev Döngüsü

Her görev için Orchestrator şu döngüyü yürütür:

1. **Anla** — İlgili F-kodu, kabul kriteri, aşama ve tasarım ekranını oku. Belirsizlikte en basit, geri alınabilir seçeneği seç ve ISKELET §8'e varsayım olarak ekle.
2. **Planla** — Alt görevler: sahip ajan, dosyalar, kabul kriteri, doğrulama komutu. Bağımlılık sırasını belirle.
3. **Dağıt** — Bağımsız görevleri paralel, bağımlıları sırayla başlat. Her ajana: ilgili doküman bölümleri, dosya listesi, "bitti" ölçütü.
4. **Uygula** — Alt ajan küçük adımlarla, testle birlikte yazar (önce başarısız test, sonra kod tercih edilir).
5. **Test Et** — Test ajanı veya ilgili ajan: `npm test`, gerekiyorsa `npm run test:e2e`; aşama sonunda `npm run verify`.
6. **Düzelt** — Başarısızlık → Debug ajanı kök neden bulur → sahibine düzeltme → 5. adım. Aynı hata için en fazla 3 deneme; sonra durumu kullanıcıya raporla.
7. **Raporla** — Yapılanlar, çalıştırılan komutlar ve gerçek sonuçları, kalan sorunlar, güncellenen dokümanlar. Yapılmayanı yapılmış gibi yazma.

Aşama kapanışında Code Review ajanı diff'i inceler; KRİTİK bulgu varsa döngü 6. adıma döner.

## 7. Tamamlanma Kriterleri ("Bitti")

Bir görev:
- [ ] ISKELET.md'deki kabul kriterini karşılar (hangi testin doğruladığı raporda yazılı).
- [ ] `npm run lint`, `npm run typecheck`, `npm test` yeşil.
- [ ] Seed değiştiyse `npm run data:validate` yeşil.
- [ ] UI içeriyorsa: `design/design.html` ile uyumlu, 360/768/1280 px kontrol edildi, Loading/Empty/Error durumları var.
- [ ] API içeriyorsa: Zod doğrulaması + hata biçimi + entegrasyon testi var.
- [ ] Code Review KRİTİK bulgusu yok.
- [ ] İlgili dokümanlar güncel.

Bir aşama: yukarıdakilere ek olarak `npm run verify` (build dahil) yeşil ve ISKELET §6'daki aşama "Bitti Kriteri" sağlanmış.

MVP: Aşama 0–7 bitti, F1–F15 kabul kriterleri test raporunda tek tek işaretli, `npm run test:e2e` yeşil, §5 performans hedefleri ölçülmüş.

## 8. Belirsizlikte Karar Kuralları
- İki yol varsa daha basit ve geri alınabilir olanı seç; kararı ISKELET §8'e ekle.
- Tasarım ile ISKELET çelişirse: işlev/kapsam için ISKELET, görünüm için `design/design.html` geçerlidir; çelişkiyi rapora yaz.
- Veri doğruluğundan emin değilsen kaydı ekleme; adet minimumunu karşılayamıyorsan raporla.
