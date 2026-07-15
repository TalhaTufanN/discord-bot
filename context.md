# RAADIO TR — Proje Bağlamı

Türkçe Discord müzik & radyo botu. discord.js v14 + **Lavalink** (lavalink-client v2). Slash komutları + buton kontrolleri.
Amaç: bu dosya, tekrar keşif yapmadan hızlı bağlam vermek içindir. Kısa tutun, değiştikçe güncelleyin.

## Mimari
- `index.js` — giriş noktası: client + `createLavalink()`, komut/event yükleyici, `deployCommands()`, process hata yakalayıcıları + gateway sağlık dinleyicileri. Lavalink manager bot girişinden sonra `init()` ediliyor (node'a bağlanmak için bot user id'si gerekiyor).
- `utils/lavalink.js` — **çekirdek**: LavalinkManager kurulumu, `getOrCreatePlayer()`, ve DisTube uyum yardımcıları (`formatDuration`, `trackDisplay`, `isRadioTrack`, `isSagopaAutoTrack`, `getRequester`).
- `utils/lavalinkEvents.js` — tüm Lavalink olayları: now-playing embed'i + butonlar, radyo metadata güncelleme (5sn), radyo auto-retry (5 deneme), sürekli Sagopa modu, kanal boşalınca ayrılma, `announceAddedTrack/Playlist`.
- `commands/*.js` — slash komutları (`data` + `execute`, bazıları `autocomplete`). Türkçe adlar: `çal, radyo, geç, döngü, karıştır, mevcutşarkı, kur, ...`.
- `events/` — `interactionCreate.js` (komut + buton + autocomplete yönlendirme), `ready.js`.
- `utils/` — `settings.js` (guild ayarları, `data/settings.json`), `radioStorage.js` (guild radyoları, `data/radioStations.json`), `sagopa.js` (yerel Sagopa dosya tarama, `/sagola` + sürekli mod ortak kullanır), `embeds.js`, `timer.js`, `radioMetadata.js`.
- `config/` — `stations.js` (~5500 satır istasyon listesi, .gitignore'da), `radioStations.js` (varsayılanlar), `emojis.js`.
- `server/` — tek seferlik yardımcı/test scriptleri (.gitignore'da, sadece yerel).

## Çalışma ortamı (ÖNEMLİ)
- **VPS Türkiye'de (88.209.248.103), Discord DPI/SNI ile engelli.** Bypass için **zapret** kurulu (systemd servis, reboot'ta gelir): `nfqws --dpi-desync=multisplit --dpi-desync-split-pos=2`, sadece TCP 443. Bot offline'sa önce VPS'te `systemctl status zapret` ve `curl -m15 https://discord.com/api/v10/gateway` (200 bekle). Ses/voice UDP engelli değil. Detay: hafıza `vps-discord-block-zapret`.
- **Lavalink pm2'de** (`lavalink`), `/root/lavalink`, Java 21, `-Xmx400M`, ~340MB RSS. **Sadece 127.0.0.1:2333**, dışarı kapalı. Parola `application.yml` içinde — tek kaynak, kopyalanmıyor; `ecosystem.config.js` oradan okuyor.
- **İki bot pm2'de:** `raadiotr` (RAADIO TR#7379) ve `raadiotr-lava`/`raadiotr2` (Müziking#0998) — aynı kod, farklı token (`ecosystem.config.js`, `.env`'deki `TOKEN`/`TOKEN2`), **aynı `data/` klasörünü paylaşır**. İkisi de aynı Lavalink node'una bağlanır (Lavalink çoklu bot destekler, her biri kendi session'ını açar).
- Gizli dosyalar (`.env`) .gitignore'da. `cookies.txt` **artık gereksiz** (yt-dlp gitti).

## Deploy
VPS `/root/discord-bot-lavalink` = github.com/TalhaTufanN/discord-bot klonu **ama git pull ile deploy edilmiyor**. Değişen dosyalar SFTP (ssh2 `fastPut`) ile doğrudan yüklenip `pm2 restart` yapılıyor. SSH bilgisi `.env`'de (`SSH_HOST/USER/PASS`); bağlantı deseni `scratch/*.js`.
- `data/` **git'te izleniyor** — deploy ederken `cp -r src dst` yapma, dst zaten varsa içine `data/data` yaratır (bu hata bir kez yapıldı).
- `/root/discord-bot` = eski DisTube sürümü, yedek olarak duruyor. Geri dönüş: `git checkout calisan-distube-hizli`.

## Neden Lavalink (ölçümler)
Datacenter/VPS IP'sinden YouTube googlevideo çoğu client'a **403** veriyordu (PO-token dayatması) → FFmpeg `code 8`. DisTube döneminde çözüm yt-dlp ile stream URL çözmekti; her şarkı **2-4 Python süreci** demekti.

VPS'te ölçülen ses başlangıcı: **yt-dlp sıralı ~10-12 sn → plugin sırası + paralel prefetch düzeltmesiyle ~4-5 sn → Lavalink ~988 ms.**
`loadtracks`: tek video 236-797 ms, arama 970 ms, 120 parçalık playlist 3.9 sn. Lavalink logunda **hiç 403/exception yok** — asıl belirsizlik buydu, tek kullanımlık bir test botuyla gerçek ses akıtılarak doğrulandı.

Lavalink `application.yml`: youtube-source plugin 1.18.1, `clients: [MUSIC, ANDROID_VR, WEB, WEBEMBEDDED]` (ANDROID_VR PO-token istemiyor — datacenter IP'de kritik). Dahili `youtube:` kaynağı **kapalı** olmalı, plugin devralıyor. `http: true` (radyo), `local: true` (Sagopa).

## Lavalink'e özgü tuzaklar (hepsi sessiz hata üretir)
1. **Süre birimi**: Lavalink **milisaniye**, DisTube saniyeydi. `track.info.duration`, `player.position`.
2. **repeatMode string**: `"off"|"track"|"queue"`. Eski sayısal `=== 2` sessizce hep false döner.
3. **Çalan parça `queue.tracks` içinde DEĞİL** → `queue.current`. `slice(1,11)` gibi eski aritmetik off-by-one olur.
4. **Yerel dosya HAM yol ister**: `file://` ve `local:` önekleri `loadType=empty` döner. lavalink-client'ta `player.search({ query: yol, source: "local" })` — `source` şart, yoksa `ytsearch:` ile öneklenir (dist/index.cjs:1515). Sagopa dosyalarında ID3 yok → başlığı dosya adından biz koyuyoruz.
5. **`stopPlaying()` vs `destroy()`**: DisTube'un `queue.stop()`'u `voice.stop()+remove()` idi — müziği durdurur, kanaldan **çıkmaz**. Karşılığı `stopPlaying(true, false)`. `destroy()` çıkar; sadece `/terket`, `music_leave` ve kanal-boş yollarında kullan.
6. **Buton işlemlerinde ÖNCE `deferUpdate()`**: `skip()` → `trackStart` → `updateMusicMessage` butonun üstünde durduğu mesajı siler; işten sonra `deferUpdate` çağırınca `40060` alırsın. Ayrıca oynatma hatası ile Discord'a cevap verme hatasını **ayrı catch'le** — birleşikken `deferUpdate` patlayınca bot kanaldan atılıyordu.
7. **"Önceki"**: hazır API yok. DisTube'un `previous()`'i iki iş yapıyordu — `previousSongs.pop()` (geçmişten TÜKET) + `songs.unshift()` (çalanı kaybetmeden önüne ekle). İkisi de şart: çalanı geri koymazsan kuyruktan düşer, geçmişi tüketmezsen "önceki"ye tekrar basınca ileri gidersin. `queue.shiftPrevious()` + `queue.add(cur,0)` + `add(prev,0)` + `skip()`, sonra `skip()`'in `previous`'a geri ittiği parçayı temizle (`queueTrackEnd` → `previous.unshift`, dist/index.cjs:1164).
8. **`announceAddedTrack/Playlist`**: Lavalink'te `addSong` olayı yok, komutlar kendi çağırıyor. Hemen çalacak parçada kendiliğinden sessiz kalır (DisTube `emitAddSongWhenCreatingQueue:true` ile ilk şarkıya da atıyordu → boş kuyrukta 2, sagola'da 3 mesaj çıkıyordu; bu bilinçli olarak düzeltildi).

## Sürekli Sagopa modu
`/sagola` (rastgele) çalınca guild ayarı `sagopaAutoplay` (varsayılan açık) ise sürekli mod aktifleşir → şarkı bitince `queueEnd` handler'ı otomatik yeni rastgele Sagopa ekler (aktif guild'ler `client.sagopaGuilds` Map'inde: `{ member, requester }`). `/sagola surekli:Aç|Kapat` ile kalıcı toggle. `/durdur`/terk/kanal-boş → mod kapanır. **Skip:** sürekli mod aktif ve sırada şarkı yoksa durdurmak yerine yeni rastgele Sagopa'ya geçer (`utils/sagopa.js` → `skipToRandomSagopa`).

## Kapsam dışı / kaldırıldı
- **Spotify**: `SpotifyPlugin` gitti. Lavalink'te karşılığı **LavaSrc** plugin'i + Spotify client id/secret. Şimdilik yok.
- **`queue.autoplay`** ve **`queue.filters`**: Lavalink'te karşılıksız → `kuyruk`/`mevcutşarkı` embed'lerinden kaldırıldı.
- yt-dlp, cookies.txt, flat playlist override, stream prefetch cache, ses kodlama bağımlılıkları (`@discordjs/voice`, opus, sodium, ffmpeg-static) — hepsi Lavalink'in çözdüğü sorunlar içindi. 16 bağımlılık → 5.

## Bilinen sorunlar / TODO
- `radioMode` (7/24) tamamen kaldırıldı; 7/24 butonu zaten render edilmiyordu (ölü kod).
- `deployCommands()` her açılışta çağrılıyor → ayrı adıma taşınmalı.
- İki process aynı `data/*.json`'a yazıyor → yazma yarışı riski.
- Komutlar sadece `.env`'deki sabit `GUILD_ID`'lere deploy oluyor → global komut yok.
- `ephemeral: true` deprecated → `flags: MessageFlags.Ephemeral`.
- `radyo.js`/`sagola.js`'teki `SHOW_PERFORMANCE` bloğu bozuk (`getTotal()` yok, `getReport()` string döner) — açılırsa patlar.
