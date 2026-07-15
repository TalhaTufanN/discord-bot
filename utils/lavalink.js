// Lavalink cekirdegi — DisTube'un yerini alan ses katmani.
//
// Neden Lavalink: bu VPS (Turkiye, datacenter IP) YouTube tarafindan
// engelleniyordu; yt-dlp ile her sarki icin 2-4 Python sureci spawn edip
// 10-15 sn bekliyorduk. Lavalink InnerTube'a JVM icinden konusuyor, surec
// yok, metadata+stream tek yerden geliyor. VPS'te olculdu: ses baslangici
// ~988 ms (yt-dlp: ~10-12 sn, ara duzeltmelerden sonra ~4-5 sn).
const { LavalinkManager } = require("lavalink-client");

const HOST = process.env.LAVALINK_HOST || "127.0.0.1";
const PORT = Number(process.env.LAVALINK_PORT || 2333);
const PASSWORD = process.env.LAVALINK_PASSWORD;

/**
 * LavalinkManager'i kurar ve discord.js'e baglar.
 * @param {import("discord.js").Client} client
 */
function createLavalink(client) {
  if (!PASSWORD) {
    throw new Error(
      "LAVALINK_PASSWORD .env'de tanimli degil — Lavalink'e baglanilamaz.",
    );
  }

  const manager = new LavalinkManager({
    nodes: [
      {
        id: "main",
        host: HOST,
        port: PORT,
        authorization: PASSWORD,
        secure: false,
        retryAmount: 10,
        retryDelay: 3000,
      },
    ],
    sendToShard: (guildId, payload) =>
      client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: { id: process.env.CLIENT_ID, username: "raadiotr" },
    // Sarki bitince/hata alinca sirakine gec
    autoSkip: true,
    // Spotify parcalari UnresolvedTrack olarak kuyruga giriyor ve YouTube
    // aramasi sirasi gelince yapiliyor. Bir parca YouTube'da bulunamazsa
    // kuyruk kilitlenmesin, sirakine gecsin.
    autoSkipOnResolveError: true,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      // Kuyruk bosaldiginda player'i biz yonetiyoruz (surekli Sagopa modu,
      // radyo retry). Lavalink kendi basina yok etmesin.
      onEmptyQueue: { destroyAfterMs: undefined },
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
    },
  });

  // Discord gateway ses paketlerini Lavalink'e aktar (voice state/server update).
  // Bu kopru olmadan player ses kanalina hic baglanamaz.
  client.on("raw", (d) => manager.sendRawData(d));

  return manager;
}

/**
 * Guild icin player'i alir, yoksa olusturur ve ses kanalina baglar.
 * DisTube'daki "distube.voices.join(vc) + distube.play(...)" ikilisinin yerine
 * gecer; komutlarin hepsi bunu kullanmali ki baglanma mantigi tek yerde kalsin.
 */
async function getOrCreatePlayer(client, { guildId, voiceChannelId, textChannelId }) {
  let player = client.lavalink.getPlayer(guildId);
  if (!player) {
    player = client.lavalink.createPlayer({
      guildId,
      voiceChannelId,
      textChannelId,
      selfDeaf: true,
      volume: 100,
    });
  }
  // Kullanici baska kanala gectiyse player'i oraya tasi
  if (player.voiceChannelId !== voiceChannelId) {
    player.voiceChannelId = voiceChannelId;
  }
  if (textChannelId) player.textChannelId = textChannelId;
  if (!player.connected) await player.connect();
  return player;
}

// --- DisTube uyum yardimcilari ---
// Eski kod song.formattedDuration, song.name, song.user gibi alanlara
// dayaniyordu. Lavalink'te karsiliklari track.info altinda ve DUZENLI
// FARKLILIKLARI var; en tehlikelisi sure: DisTube saniye, Lavalink MILISANIYE.

/**
 * ms -> "3:32" / "1:02:03". DisTube'un formattedDuration'inin karsiligi.
 * Canli yayinda (isStream) sure anlamsiz.
 */
function formatDuration(ms) {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Kuyrugun toplam suresi (ms) -> okunabilir metin */
function formatQueueDuration(tracks) {
  const total = (tracks || []).reduce(
    (sum, t) => sum + (t?.info?.isStream ? 0 : t?.info?.duration || 0),
    0,
  );
  return formatDuration(total);
}

/** Radyo istasyonu mu? (eski: song.metadata.stationName) */
function isRadioTrack(track) {
  return Boolean(track?.userData?.stationName);
}

/** Surekli Sagopa modunun otomatik ekledigi sarki mi? (eski: song.metadata.sagopaAuto) */
function isSagopaAutoTrack(track) {
  return Boolean(track?.userData?.sagopaAuto);
}

/** Yerel dosya mi? (eski: song.url.startsWith("file:")) */
function isLocalTrack(track) {
  const uri = track?.info?.uri;
  return !uri || track?.info?.sourceName === "local" || uri.startsWith("file:") || uri.startsWith("/");
}

/** Sarkiyi isteyen kullanici — mesajlarda "İsteyen" alani icin */
function getRequester(track) {
  return track?.userData?.requester ?? track?.requester ?? null;
}

/**
 * Eski song.name / song.uploader?.name / song.thumbnail / song.formattedDuration
 * dorduslusunu tek yerden uretir; embed'ler bunu kullanir.
 */
function trackDisplay(track) {
  const info = track?.info || {};
  const radio = isRadioTrack(track);
  return {
    name: radio ? track.userData.stationName : info.title || "Bilinmeyen",
    uploader: radio ? "Canlı Radyo" : info.author || "Sagopa Kajmer",
    duration: radio || info.isStream ? "🔴 Canlı Yayın" : formatDuration(info.duration),
    thumbnail: info.artworkUrl || null,
    url: info.uri || null,
    isRadio: radio,
  };
}

module.exports = {
  createLavalink,
  getOrCreatePlayer,
  formatDuration,
  formatQueueDuration,
  isRadioTrack,
  isSagopaAutoTrack,
  isLocalTrack,
  getRequester,
  trackDisplay,
};
