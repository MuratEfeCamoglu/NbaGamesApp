# TASARIM_PROMPT.md — Claude Design Promptu

> Kullanım: Aşağıdaki "PROMPT" bölümünün tamamını Claude Design'a yapıştır. Claude Design'ın ürettiği **tek HTML dosyasını** repoya `design/design.html` adıyla koy; başka tasarım dosyası eklenmez. Bu dosya eklenmeden hiçbir kod yazılmaz (CLAUDE.md).
> Kaynak gereksinimler: ISKELET.md §2–3. Arayüz dili İngilizcedir (ISKELET V5).

---

## PROMPT

Sen kıdemli bir ürün tasarımcısısın. **NBA Games** adlı responsive web uygulamasının tasarımını, bütün ekranları içeren **tek bir HTML örnek sayfası** olarak üret. Uygulama daha sonra Next.js + Tailwind CSS v4 + Framer Motion (`motion/react`) ile kodlanacak; bu HTML'deki renkler, tipografi, bileşenler ve düzenler doğrudan koda aktarılacak. Ayrı bileşen, token, ekran görüntüsü veya doküman dosyası üretme — her şey bu tek HTML'in içinde olsun (teslim kuralları §10).

### 1. Ürün
NBA Games, basketbol taraftarlarının NBA bilgisini 6 oyun modunda test ettiği, puan kazanıp liderlik tablosunda yarıştığı bir platform. Oturumlar 3–10 dakika; kullanıcıların çoğu mobilde. Tüm arayüz metinleri **İngilizce**.

Oyun modları (her biri 10 soruluk oturum, Top 10 Challenge hariç):
1. **Starting Five** — Bir takımın bir sezondaki ilk beşinden 4 oyuncu gösterilir (ad, pozisyon, fotoğraf), 5. slot boş "?" kartıdır; kullanıcı eksik oyuncuyu bulur.
2. **Team Journey** — Oyuncunun kariyerindeki takımlar kronolojik bir zaman çizelgesinde (takım rozeti + yıl aralığı) gösterilir; oyuncu tahmin edilir.
3. **Teammate Challenge** — 2–5 takım arkadaşı (fotoğraf + ad + ortak takım/sezon) gösterilir; ortak oyuncu tahmin edilir.
4. **Career Stats** — Kariyer ortalamaları istatistik kartı olarak (PPG, RPG, APG, SPG, BPG, FG%, Games, Seasons, Position) gösterilir; oyuncu tahmin edilir.
5. **Box Score** — Gerçek bir maçın tek oyuncu satırı, klasik box score tablosu görünümünde (MIN, PTS, REB, AST, STL, BLK, FG, 3P) + maç tarihi, iki takım ve skor; oyuncu tahmin edilir.
6. **Top 10 Challenge** — Bir istatistik sıralaması (ör. "Career 3-Pointers Made") 10 satırlık tablo; bazı satırlar gizli, kullanıcı her gizli satırı doldurur. Oturum 3 liste, liste başına 60 sn.

Zorluk seviyeleri: **Easy** (4 şık, 30 sn) · **Medium** (6 şık, 25 sn) · **Hard** (oyuncu arama kutusu, 20 sn) · **Expert** (arama kutusu, 20 sn, daha az ipucu). Her zorluğun kendi rozet rengi olsun.

Puan: doğru cevapta taban puan + süre bonusu + streak bonusu; yanlışta 0 ve streak sıfırlanır. Puan kazanımı animasyonlu "+290" toast'ı ile, streak bir alev sayacı ile gösterilir.

### 2. Görsel konsept
- Modern spor yayını + NBA istatistik platformu hissi: koyu, yüksek kontrastlı, veri odaklı, enerjik ama sade.
- Koyu tema varsayılan ve tek tema (açık tema yok).
- Arka planda ince parke/saha çizgisi dokusu veya çok düşük opaklıkta basketbol sahası geometrisi kullanılabilir (dikkat dağıtmadan).
- Resmi NBA veya takım logoları **kullanılmaz** (ticari marka). Takımlar, takım renkleriyle dolu yuvarlatılmış bir **TeamBadge** (3 harfli kısaltma, ör. "LAL") ile gösterilir. Oyuncu fotoğrafları 1040×760 oranlı headshot'lardır; fotoğraf yoksa takım renginde arka plan + baş harfler gösteren **PlayerAvatar** fallback'i tasarla.

### 3. Renk paleti (başlangıç önerisi — kontrast için ayarlayabilirsin, ama token adlarını koru)
| Token | Öneri | Kullanım |
|---|---|---|
| `--color-bg` | #0B0B0D | Sayfa arka planı (siyah) |
| `--color-surface` | #16171B | Kart (antrasit) |
| `--color-surface-2` | #1F2026 | Yükseltilmiş kart, input |
| `--color-border` | #2A2C33 | Ayırıcılar |
| `--color-text` | #F5F5F7 | Ana metin |
| `--color-text-muted` | #9A9CA5 | İkincil metin |
| `--color-accent` | #FF6B1A | Turuncu vurgu, CTA |
| `--color-accent-hover` | #FF8540 | CTA hover |
| `--color-success` | #22C55E | Doğru cevap |
| `--color-danger` | #EF4444 | Yanlış cevap, hata |
| `--color-warning` | #F59E0B | Süre azalıyor |
| `--color-diff-easy` / `-medium` / `-hard` / `-expert` | yeşil / mavi / turuncu / mor-kırmızı | Zorluk rozetleri |

Bu değerler HTML'de `:root` içinde CSS değişkeni olarak tanımlanır (§10). Tüm metin/arka plan çiftleri WCAG AA (normal metin ≥4.5:1) sağlamalı; sağlamayanı düzelt ve kontrast oranını Style Guide bölümünde ilgili renk örneğinin yanına yaz.

### 4. Tipografi
- Başlık/display: dar, güçlü, sportif bir grotesk (öneri: **Oswald** veya **Bebas Neue**, Google Fonts) — büyük harf, hafif harf aralığı.
- Gövde/UI: **Inter** (Google Fonts).
- İstatistik rakamları: `font-variant-numeric: tabular-nums`; büyük rakamlar için display fontu.
- Tip ölçeği: 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 56 px; satır yükseklikleri ve ağırlıklar token olarak.

### 5. Tasarım dili ve bileşenler
Radius, gölge, spacing (4 px tabanlı) ve hareket token'larını tanımla. Aşağıdaki bileşenleri varyant ve durumlarıyla (default, hover, focus-visible, active, disabled, loading) tasarla. Bileşenler ayrı dosya değildir: ekranların içinde kullanılır ve her birinin kök elemanı `data-component="<Ad>"` taşır (varyant/durum için `data-variant`, `data-state`). **Adları aynen kullan**:

- **Temel:** Button (primary/secondary/ghost/danger; sm/md/lg), IconButton, Card, Badge, DifficultyBadge, Tabs, Input, Skeleton, Toast, Modal, Tooltip, ProgressBar, EmptyState, ErrorState.
- **Layout:** TopNav (masaüstü), BottomTabBar (mobil), PageHeader, Footer (veri tarihi notu: "Data as of 2025-26 season").
- **Oyun:** GameCard (mod görseli, ad, kısa açıklama, "Play" CTA), DifficultySelector, QuestionCard (mod bazlı içerik alanı), PlayerAvatar, PlayerCard, TeamBadge, CareerTimeline (Team Journey), StatGrid / StatCard (Career Stats), BoxScoreTable, Top10Table (gizli satır + doldurulmuş satır durumları), AnswerOption (default/selected/correct/wrong/disabled; klavye kısayol numarası 1–6 görünür), PlayerSearch (autocomplete: boş, yazıyor, sonuç listesi, sonuç yok, seçili), TimerBar (normal → son 5 sn uyarı rengi, nabız), StreakMeter (0, 1, 2–4, 5+ "on fire" durumları), ScoreToast ("+290"), QuestionProgress ("4/10"), ResultSummary (toplam puan, doğru/toplam, en iyi streak, yeni rozetler, "Play again" / "Choose another game").
- **Rekabet:** DailyChallengeCard (bugün oynanmadı / oynandı + skor + geri sayım "Next in 05:12:33"), LeaderboardTable + LeaderboardRow (ilk 3 için madalya vurgusu, "You" satırı vurgusu), AchievementBadge (kazanıldı / kilitli), StatTile (profil istatistikleri), GameHistoryList, NicknameForm (validasyon mesajları: 3–20 karakter, harf/rakam/alt çizgi, "already taken").

### 6. Ekranlar ve navigasyon
Ana navigasyon: **Home · Games · Daily · Leaderboard · Profile**. Masaüstü: üstte TopNav (logo solda, linkler, sağda kullanıcı puanı + avatar). Mobil: altta 5 sekmeli BottomTabBar, üstte sade başlık.

HTML gerçek anlamda responsive olsun (media query'lerle): tarayıcı **360 px (mobil), 768 px (tablet) ve 1280 px (masaüstü)** genişliğe getirildiğinde düzen doğru değişmeli. Ayrı mobil/masaüstü kopyaları üretme. Her ekran HTML'de bir `<section>`'dır:

1. **Style Guide** (`#style-guide`, sayfanın en başında, kısa) — renk örnekleri (token adı, hex, kontrast oranı), tip ölçeği, Button / Badge / DifficultyBadge / AnswerOption durumları.
2. **Home** (`#home`) — Hero (slogan + "Play now" CTA), DailyChallengeCard, "Featured games" (3 GameCard), kısa leaderboard (ilk 5), kullanıcının streak/puan özeti.
3. **Games** (`#games`) — 6 GameCard grid'i (mobil 1 sütun, tablet 2, masaüstü 3); her kartta kısa kural özeti.
4. **Game Detail** (`#game`) — üç aşama: (a) mod girişi: kurallar + DifficultySelector + "Start"; (b) oyun ekranı: üstte QuestionProgress, TimerBar, StreakMeter, skor; ortada QuestionCard; altta cevap alanı (şıklar veya PlayerSearch); cevap sonrası doğru/yanlış geri bildirimi ve doğru cevabın gösterimi (1.5 sn); (c) ResultSummary. 6 modun her biri için oyun ekranı varyantı olsun (`data-mode="starting-five"` vb.), bölümün üstündeki mod sekmeleriyle geçilsin. Cevap alanında Easy (4 şık) ↔ Hard (PlayerSearch) arasında geçiş yapan küçük bir anahtar olsun.
5. **Daily Challenge** (`#daily`) — 5 soruluk karma oturum girişi; oynandıysa sonuç + günlük leaderboard + bir sonraki challenge'a geri sayım.
6. **Leaderboard** (`#leaderboard`) — Tabs: All time / This week / Today; ilk 100 + sabit "You" satırı; takma adı yoksa "Set a nickname to appear on the leaderboard" çağrısı.
7. **Profile** (`#profile`) — Takma ad (düzenlenebilir), StatTile'lar (Total points, Games played, Accuracy %, Best streak), Achievements grid'i (8 rozet: First Game, Perfect 10, Streak 5, Streak 10, Expert Win, All Modes, Daily 3, 10K Points), Game history (son 20), misafir hesap uyarısı ("Your progress is saved in this browser").
8. **404 / genel hata** (`#not-found`).

### 7. Kullanıcı akışları ve etkileşimler
Akışlar HTML içinde tıklanarak izlenebilsin: navigasyon linkleri ve butonlar hash ile ilgili bölüme geçsin (`#home`, `#games`, `#game`, `#daily`, `#leaderboard`, `#profile`); oyun ekranında şık seçimi gerçekten doğru/yanlış geri bildirimini oynatsın. Ayrı akış dokümanı üretme. Gösterilecek akışlar:
- **İlk oyun:** Home → GameCard → Difficulty → soru → ResultSummary → "Set a nickname" önerisi.
- **Cevaplama:** şık seçimi → anında doğru (yeşil, hafif scale + parıltı) / yanlış (kırmızı, yatay sallanma) + doğru şıkkın vurgulanması → ScoreToast → streak sayacı artışı → sonraki soruya kaydırmalı geçiş.
- **Süre dolması:** TimerBar son 5 sn renk değişimi + nabız → "Time's up" durumu.
- **Daily:** Daily kartı → 5 soru → sonuç + günlük sıralama; ikinci girişte "Already played today" durumu.
- **Rozet kazanma:** ResultSummary'de rozet açılma animasyonu.
- **Takma ad belirleme:** NicknameForm → doğrulama → başarı toast'ı → leaderboard'da "You" satırı.

Hareket kuralları: süreler 150–400 ms, `ease-out` giriş / `ease-in` çıkış, yaylı (spring benzeri) hareket yalnız ödül anlarında (ScoreToast, rozet). Her animasyonun `prefers-reduced-motion` karşılığını (yalnız opaklık geçişi) tanımla. Klavye: şıklar 1–6, Enter onay, odak halkası her zaman görünür (turuncu, 2 px).

### 8. Durum ekranları
Her veri ekranı (Home blokları, Games, oyun soruları, Daily, Leaderboard, Profile, PlayerSearch) için aşağıdaki dört durumu tasarla. Durumlar aynı HTML'de görülebilsin: ilgili bölümün üstündeki küçük bir durum seçici (Default · Loading · Empty · Error) bölümün `data-state` değerini değiştirsin. Success durumları akışların içinde görünsün.
- **Loading:** içerik şeklinde Skeleton (spinner değil); oyun başlarken kısa "Get ready… 3-2-1" geri sayımı.
- **Empty:** ör. "No games played yet — Play your first game", boş leaderboard, aramada "No players found".
- **Error:** açıklayıcı mesaj + "Try again" butonu; ağ hatası ve "Session expired" varyantı.
- **Success:** doğru cevap, takma ad kaydedildi, rozet kazanıldı, oturum tamamlandı.

### 9. Responsive kurallar
- Mobil öncelikli; 360 px'te yatay kaydırma yok, dokunma hedefleri ≥44×44 px.
- Box score ve Top 10 tabloları mobilde okunabilir kalmalı (sabit ilk sütun + yatay kaydırılabilir tablo alanı veya kart düzenine dönüşme — birini seç, gerekçesini not bloğuna yaz).
- Oyun ekranında cevap alanı mobilde başparmak bölgesinde (alt yarı); klavye açıldığında PlayerSearch sonuçları görünür kalmalı.

### 10. Teslim formatı (zorunlu — projeye aktarılacak)
Çıktı **tek bir dosyadır**: `design.html` (repoda `design/design.html` olarak saklanacak). Ayrı CSS, JS, PNG, Markdown, bileşen veya token dosyası üretme.

1. **Kendi kendine yeten:** tüm CSS tek `<style>`, tüm JS tek `<script>` içinde (vanilla JS, kütüphane yok; yalnız bölüm/sekme/durum geçişleri ve demo etkileşimleri için). Harici kaynak yalnızca Google Fonts `<link>`'i ve isteğe bağlı oyuncu fotoğrafları (`https://cdn.nba.com/headshots/nba/latest/1040x760/{personId}.png`; yüklenemezse baş harfli PlayerAvatar'a düşsün). İkonlar inline SVG (Lucide çizgi stili). Base64 gömülü görsel yok.
2. **Token'lar en üstte:** `<style>`'ın ilk bloğu `:root { ... }` olsun ve §3–§5'teki tüm renk, font, tip ölçeği, radius, gölge, spacing ve hareket değişkenlerini Tailwind v4 ad alanlarıyla içersin (`--color-*`, `--font-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--spacing-*`, `--ease-*`, `--duration-*`). Hex/rgb değerleri yalnızca bu blokta geçer; geri kalan CSS yalnız `var(--...)` kullanır. Bu blok kodda doğrudan Tailwind `@theme`'e kopyalanacak.
3. **Yapı:** bir `<header>`/`<nav>` + her ekran bir `<section id="...">`: `style-guide`, `home`, `games`, `game`, `daily`, `leaderboard`, `profile`, `not-found`. `game` bölümündeki 6 varyant `data-mode="starting-five | team-journey | teammate-challenge | career-stats | box-score | top-10"` ile işaretli.
4. **Bileşen işaretleme:** her bileşenin kök elemanında §5'teki adla `data-component="GameCard"`; varyant/durum `data-variant`, `data-state`. Class adları okunur ve tutarlı (ör. `.game-card`, `.game-card__title`).
5. **Okunabilirlik:** minify etme; her bölüm `<!-- ===== HOME ===== -->` gibi bir yorumla başlasın; tekrar eden stiller ortak class'larda toplansın; tek seferlik inline `style=""` kullanma.
6. **Not bloğu:** `<head>` içindeki ilk HTML yorumunda kısaca: fontlar ve ağırlıkları, ikon stili, mobil tablo kararı (§9) ve verdiğin tasarım varsayımları. Ayrı README yazma.
7. **Hareket:** animasyonlar CSS transition/keyframes ile; `@media (prefers-reduced-motion: reduce)` bloğu zorunlu.

Sabit kurallar: Lorem ipsum kullanma; gerçekçi NBA örnek içerikleri kullan (ör. oyuncu adları, "Career 3-Pointers Made" listesi). Her ekran yalnızca tanımlı token ve bileşenlerden oluşsun; tek seferlik stil üretme.

---

## Tasarım geldikten sonra (ajan için kontrol listesi)
1. `design/design.html` var mı, tarayıcıda hatasız açılıyor mu? §10'u kontrol et: tek dosya, ilk blok `:root` token'ları, 8 `<section id>`, 6 `data-mode` varyantı, durum seçicileri, `data-component` işaretleri. Eksikleri kullanıcıya liste olarak bildir; yalnız eksik bölümü yeniden iste.
2. `:root` değişkenlerini `src/app/globals.css` `@theme` bloğuna aktar; token adlarının §3 tablosuyla uyumunu ve AA kontrastını kontrol et.
3. Tüm `data-component` adlarını çıkar (ör. `grep -o 'data-component="[A-Za-z0-9]*"' design/design.html | sort -u`), ISKELET §4 `src/components/**` planıyla eşle; farkları ISKELET ve CLAUDE.md'ye işle.
4. CLAUDE.md "Tasarım Kuralları" ve AGENT.md UI/UX + Frontend görevlerini somut bileşen/dosya adlarıyla güncelle.
