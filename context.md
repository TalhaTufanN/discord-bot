# RAADIO TR — Proje Bağlamı

Türkçe Discord müzik & radyo botu. discord.js v14 + DisTube v5. Slash komutları + buton kontrolleri.
Amaç: bu dosya, tekrar keşif yapmadan hızlı bağlam vermek içindir. Kısa tutun, değiştikçe güncelleyin.

## Mimari
- `index.js` — giriş noktası: client + DisTube kurulumu, plugin'ler (Spotify, ytDlp, YouTube), cookie parse, komut/event yükleyici, `deployCommands()`, process hata yakalayıcıları + gateway sağlık dinleyicileri.
- `commands/*.js` — slash komutları (`data` + `execute`, bazıları `autocomplete`). Türkçe adlar: `çal, radyo, geç, döngü, karıştır, mevcutşarkı, kur, ...`.
- `events/` — `interactionCreate.js` (komut + buton + autocomplete yönlendirme), `ready.js`.
- `utils/distubeEvents.js` — tüm DisTube olayları: now-playing embed'i + butonlar, radyo metadata güncelleme (5sn), radyo auto-retry (5 deneme), hata yönetimi.
- `utils/` — `settings.js` (guild ayarları, `data/settings.json`), `radioStorage.js` (guild radyoları, `data/radioStations.json`), `sagopa.js` (yerel Sagopa dosya tarama + rastgele Song üretimi, `/sagola` + sürekli mod ortak kullanır), `embeds.js`, `timer.js`, `radioMetadata.js`.
- `config/` — `stations.js` (~5500 satır istasyon listesi, .gitignore'da), `radioStations.js` (varsayılanlar), `emojis.js`.
- `server/` — tek seferlik yardımcı/test scriptleri (.gitignore'da, sadece yerel). `package.json`'daki `npm run deploy` → `server/deploy.js`.

## Çalışma ortamı (ÖNEMLİ)
- **VPS Türkiye'de (88.209.248.103), Discord DPI/SNI ile engelli.** Bypass için **zapret** kurulu (systemd servis, reboot'ta gelir): `nfqws --dpi-desync=multisplit --dpi-desync-split-pos=2`, sadece TCP 443. Bot offline'sa önce VPS'te `systemctl status zapret` ve `curl -m15 https://discord.com/api/v10/gateway` (200 bekle). Ses/voice UDP engelli değil. Detay: hafıza `vps-discord-block-zapret`.
- **İki bot pm2'de:** `raadiotr` (RAADIO TR#7379) ve `raadiotr2` (Müziking#0998) — ikisi de aynı `index.js`, farklı token (`ecosystem.config.js`), **aynı `data/` klasörünü paylaşır**.
- Gizli dosyalar (`.env`, `cookies.txt`) .gitignore'da, git'e girmez.

## Deploy
VPS `/root/discord-bot` = github.com/TalhaTufanN/discord-bot klonu **ama git pull ile deploy edilmiyor**. Değişen dosyalar SFTP (ssh2 `fastPut`) ile doğrudan yüklenip `pm2 restart raadiotr raadiotr2` yapılıyor. SSH bilgisi `.env`'de (`SSH_HOST/USER/PASS`); bağlantı deseni `scratch/*.js`. Node 22'de `.new` uzantısı `node --check`'i yanıltır — geçici `.js` kopyaya çevirip kontrol et.

## Son değişiklikler (2026-07-08, VPS'te canlı — git'e commit EDİLMEDİ, yedekler `*.bak`)
- Dayanıklılık: `process.on(unhandledRejection/uncaughtException)`, gateway dinleyicileri (`ShardError/Disconnect/Reconnecting/Resume`, `Invalidated`→`process.exit(1)`). "pm2'de online ama Discord'da donuk" durumunu toparlar.
- FFmpeg log spam kapandı — `ffmpegDebug` artık sadece `FFMPEG_DEBUG=1` iken loglar.
- Arama cookie fix: cookie'li YouTube instance `client.youtubePlugin`'e bağlandı; `çal.js` aramada onu kullanıyor (eskiden cookie'siz ayrı instance vardı).
- `/sagola` mesaj düzeltmesi + **sürekli rastgele Sagopa modu**: `/sagola` (rastgele) çalınca guild ayarı `sagopaAutoplay` (varsayılan açık) ise sürekli mod aktifleşir → şarkı bitince `finish` handler'ı otomatik yeni rastgele Sagopa ekler (aktif guild'ler `client.sagopaGuilds` Map'inde, guild-bazlı). `/sagola surekli:Aç|Kapat` ile kalıcı toggle. `/durdur`/terk/kanal-boş → mod kapanır. Kuyruğa eklenen şarkıda artık tek mesaj (DisTube embed'i varsa komut kendi yanıtını siler); `sagopaAuto` metadata'lı otomatik şarkılar addSong embed'i atmaz. **Skip (`/geç` + geç butonu):** sürekli mod aktif ve sırada şarkı yoksa durdurmak yerine yeni rastgele Sagopa'ya geçer (`utils/sagopa.js` → `skipToRandomSagopa`, add+skip mantığı).

## YouTube stream (403 / ffmpeg code 8)
Datacenter/VPS IP'sinden YouTube googlevideo çoğu client'a **403** veriyor (PO-token dayatması) → FFmpeg `code 8`. Çözüm: `index.js`'te stream URL'i doğrudan yt-dlp ile çözüyoruz (`ytdlpResolveStreamURL`) — `--cookies cookies.txt -f bestaudio/best` + **client fallback zinciri** `YTDLP_CLIENTS=["web_safari","web_music","mweb"]` (ilk URL çıkaran kullanılır; bazı videolar web_safari'de "format yok" der, web_music/mweb çözer). Curl-403 yanıltıcı, gerçek testi ffmpeg ile yap. Ayrıca yt-dlp binary'si eskiyince de 403 artar → haftalık cron (`Pzt 05:00`, `node_modules/@distube/yt-dlp/bin/yt-dlp -U`, log `/root/ytdlp-update.log`). 403 tekrar başlarsa: (1) `yt-dlp -U` çalıştı mı bak, (2) çalışan client'ı yeniden bul: VPS'te farklı `player_client` değerleriyle `yt-dlp -f bestaudio/best -g <url>` çıktısını `curl -r 0-2000` ile test et (206=OK, 403=değiştir).

## Playlist (flat/lazy çözüm)
Büyük YouTube playlist'leri eskiden baştan tam çözülüyordu (48 parça = ~3 dk, "düşünüyor" takılır + gateway yük altında flap). `index.js`'te `ytDlpPlugin.resolve` override edildi: YouTube playlist URL'leri artık `--flat-playlist --dump-single-json` (+web_safari+cookies) ile **flat** çözülüyor (183 parça ~4 sn), her parça `plugin: ytDlpPlugin` işaretli `Song` olarak kuyruğa giriyor; stream'i sırası gelince `getStreamURL` (web_safari) çözüyor. Süre bilgisi flat modda geliyor. Tek video URL'leri hâ​lâ orijinal (tam) resolve.

## Plugin sırası (ÖNEMLİ — çalma hızının kaynağı)
`YtDlpPlugin.validate()` **koşulsuz `true`** döner, DisTube da ilk `validate` diyen plugin'i seçer (`distube/dist/index.js:1595`). Sıra eskiden `[Spotify, ytDlpPlugin, youtubePlugin]` olduğu için **tek video dahil her şey yt-dlp'ye gidiyordu**; `youtubePlugin` resolve tarafında ölü koddu. Her şarkı 2-4 yt-dlp (Python) süreci spawn ediyordu → `/çal <link>` 10-15 sn.

Sıra artık `[Spotify, youtubePlugin, ytDlpPlugin]` (ytDlpPlugin **en sonda olmalı** — plugin bunu `init()`'te kendi de uyarıyor). Tek videolar `ytdl.getBasicInfo` ile in-process çözülüyor. VPS'te ölçüm: **getBasicInfo ~1.1-2.0 sn vs yt-dlp ~5.8-6.8 sn**.
- `youtubePlugin.validate` override'ı **saf playlist** URL'lerinde `false` döner → playlist'ler aşağıdaki flat çözüme (ytDlpPlugin) gitmeye devam eder.
- `youtubePlugin.resolve` sarmalı: hata olursa `ytDlpPlugin.resolve`'a düşer. Gerekli, çünkü DisTube plugin'i seçtikten sonra resolve patlarsa diğer plugin'e **düşmez**, `play()` komple hata verir (datacenter IP + YouTube bot-algılaması riski).
- Lara/Jockie gibi botlar hızlı çünkü **Lavalink** kullanıyorlar: InnerTube'a JVM içinden HTTP, süreç spawn yok, nsig/player script cache'li, metadata+stream tek istekte. Gerçek çözüm uzun vadede Lavalink.

## Stream prefetch (hızlı geçiş)
`index.js`: bir şarkı çalınca (`playSong` dinleyicisi) sıradakinin (`queue.songs[1]`) stream URL'i arka planda çözülüp `streamUrlCache`'e (30 dk TTL) konuyor. `getStreamURLWithFallback` önce önbelleğe bakıyor → YouTube kuyruk/playlist geçişleri ~1-2 sn yerine anlık. Yerel Sagopa (file://) şarkıları http olmadığından atlanıyor. Prefetch başarısızsa sessizce normal çözüme düşer.

Ayrıca `/çal` (`client.prefetchStreamURL`, Spotify hariç) `distube.play()`'den **hemen önce** prefetch'i ateşliyor → metadata resolve'u ile stream çözümü **paralel** gidiyor, ilk şarkı da kazanıyor (eskiden sadece kuyruktaki 2. şarkı kazanıyordu).

Önbellek anahtarı **video ID** (`yt:<id>`, `streamCacheKey`) — URL değil. Şart: prefetch `youtu.be/ID` ile, `playSong` `watch?v=ID` ile gelir; URL bazlı anahtarla önbellek hiç tutmaz ve kazanç sessizce sıfırlanır.

## Bilinen sorunlar / TODO
- `radioMode` (7/24) global boolean → guild-bazı olmalı; 7/24 butonu artık render edilmiyor (ölü kod).
- `deployCommands()` her açılışta çağrılıyor → ayrı adıma taşınmalı.
- İki process aynı `data/*.json`'a yazıyor → yazma yarışı riski.
- Komutlar sadece `.env`'deki sabit `GUILD_ID`'lere deploy oluyor → global komut yok.
- `ephemeral: true` deprecated → `flags: MessageFlags.Ephemeral`. Gereksiz bağımlılık: `ytdl-core` + `@distube/ytdl-core`.
