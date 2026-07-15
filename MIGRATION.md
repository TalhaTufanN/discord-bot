# DisTube -> Lavalink geçiş sözleşmesi

Bu dosya geçici bir referans (iş bitince silinecek). Ses katmanı DisTube'dan
Lavalink'e (lavalink-client v2.10.3) taşınıyor. Çekirdek bitti; kalan iş komutlar.

## Yeni API — bunları kullan

### `utils/lavalink.js`
```js
const {
  getOrCreatePlayer,   // async (client, { guildId, voiceChannelId, textChannelId }) -> player (bağlar)
  formatDuration,      // (ms) -> "3:32" / "1:02:03"
  formatQueueDuration, // (tracks[]) -> toplam süre metni
  isRadioTrack,        // (track) -> bool   (track.userData.stationName)
  isSagopaAutoTrack,   // (track) -> bool   (track.userData.sagopaAuto)
  isLocalTrack,        // (track) -> bool
  getRequester,        // (track) -> Discord User (mesajlarda "İsteyen")
  trackDisplay,        // (track) -> { name, uploader, duration, thumbnail, url, isRadio }
} = require("../utils/lavalink");
```
`trackDisplay(track)` radyoyu da bilir: radyoda `name`=istasyon adı,
`uploader`="Canlı Radyo", `duration`="🔴 Canlı Yayın".

### `utils/lavalinkEvents.js`
```js
const { announceAddedTrack, announceAddedPlaylist } = require("../utils/lavalinkEvents");
// DisTube'un addSong/addList olayları YOK. Kuyruğa ekledikten SONRA bunları çağır.
// Radyo ve sagopaAuto şarkıları için announceAddedTrack kendiliğinden sessiz kalır.
await announceAddedTrack(client, player, track);
await announceAddedPlaylist(client, player, tracks, { name, url, thumbnail });
```

### `utils/sagopa.js`
```js
const {
  getAllAudioFiles,      // (dir) -> string[] (dosya yolları)
  resolveLocalTrack,     // async (player, filePath, requester, userData) -> track|null
  getRandomSagopaTrack,  // async (player, requester, userData) -> track|null
  skipToRandomSagopa,    // async (player, client) -> bool
  getMusicPath,
} = require("../utils/sagopa");
```

## Eşleme tablosu

| DisTube | Lavalink |
|---|---|
| `client.distube.getQueue(guildId)` | `client.lavalink.getPlayer(guildId)` |
| `distube.voices.join(vc)` + `distube.play(...)` | `getOrCreatePlayer(...)` → `player.search` → `player.queue.add` → `player.play()` |
| `distube.voices.get(...)` / `.leave()` | `player.voiceChannelId` / `player.destroy()` |
| `queue.songs[0]` (çalan) | `player.queue.current` |
| `queue.songs.slice(1)` (sıradakiler) | `player.queue.tracks` **(current dizide DEĞİL)** |
| `queue.songs.length` | `player.queue.tracks.length + (current ? 1 : 0)` |
| `queue.stop()` | `player.set("intentionalStop", true)` sonra `player.destroy()` |
| `queue.skip()` | `player.skip()` |
| `queue.pause()` / `resume()` / `paused` | `player.pause()` / `player.resume()` / `player.paused` |
| `queue.volume` / `setVolume(n)` | `player.volume` / `player.setVolume(n)` |
| `queue.shuffle()` | `player.queue.shuffle()` |
| `queue.setRepeatMode(0/1/2)` | `player.setRepeatMode("off"/"track"/"queue")` |
| `queue.currentTime` (saniye) | `player.position` (**milisaniye**) |
| `song.name` | `track.info.title` |
| `song.url` | `track.info.uri` |
| `song.duration` (saniye) | `track.info.duration` (**milisaniye**) |
| `song.formattedDuration` | `formatDuration(track.info.duration)` |
| `song.thumbnail` | `track.info.artworkUrl` (null olabilir) |
| `song.uploader?.name` | `track.info.author` |
| `song.user` | `getRequester(track)` |
| `song.metadata.stationName` | `track.userData.stationName` → `isRadioTrack(track)` |
| `song.metadata.sagopaAuto` | `track.userData.sagopaAuto` → `isSagopaAutoTrack(track)` |
| `queue.textChannel` (nesne) | `player.textChannelId` (id) |

## TUZAKLAR — bunlar sessiz hata üretir

1. **Süre birimi**: DisTube saniye, Lavalink **milisaniye**. `track.info.duration`
   ve `player.position` ms. İlerleme çubuğu / `formatTime` hesaplarını buna göre düzelt.
2. **repeatMode string**: `"off" | "track" | "queue"`. Eski sayısal 0/1/2 ile
   karşılaştırma (`=== 2`) sessizce hep false döner.
3. **current diziden ayrı**: `queue.tracks` sadece sıradakiler. `slice(1,11)` gibi
   eski aritmetik off-by-one olur.
4. **`queue.filters`**: Lavalink'te `.names` dizisi YOK. Filtre alanını embed'lerden
   **kaldır** (`player.filterManager` farklı bir model).
5. **`queue.autoplay`**: Lavalink'te karşılığı YOK. Kaldır.
6. **Spotify kaldırıldı**: `isSpotify` dalları ve Spotify'a özel kod silinecek.
7. **Aramada `source`**: yerel dosya için `player.search({ query: yol, source: "local" })`
   **zorunlu** — yoksa yol `ytsearch:` ile öneklenip YouTube'da aranır.
   Normal arama: `player.search({ query }, requester)` (URL'yi kendi tanır).
8. **`player.play()`**: zaten çalıyorsa tekrar çağırma → `if (!player.playing) await player.play();`
9. **requester**: `player.search(query, interaction.user)` ikinci parametre requester'dır,
   `getRequester(track)` bunu geri verir. Her aramada geçir.

## Kuyruğa ekleme kalıbı (kanonik)

```js
const { getOrCreatePlayer } = require("../utils/lavalink");
const { announceAddedTrack } = require("../utils/lavalinkEvents");

const player = await getOrCreatePlayer(interaction.client, {
  guildId: interaction.guildId,
  voiceChannelId: voiceChannel.id,
  textChannelId: interaction.channelId,
});

const res = await player.search({ query }, interaction.user);
if (!res.tracks.length) { /* sonuç yok */ }

if (res.loadType === "playlist") {
  await player.queue.add(res.tracks);
  await announceAddedPlaylist(client, player, res.tracks, {
    name: res.playlist?.name, url: res.playlist?.uri, thumbnail: res.playlist?.thumbnail,
  });
} else {
  const track = res.tracks[0];
  await player.queue.add(track);
  await announceAddedTrack(client, player, track);
}
if (!player.playing) await player.play();
```

Radyo için ek olarak, `queue.add`'den **önce**:
```js
track.userData = { ...(track.userData || {}), stationName: station.name };
```

## Dokunulmayacak dosyalar
`radyoekle.js`, `radyosil.js`, `radyoduzenle.js`, `kur.js`, `yardım.js` —
DisTube'a hiç dokunmuyorlar.
