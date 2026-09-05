// YouTube ses köprüsü istemcisi.
//
// Neden (2026-09, bkz. hafıza youtube-sabr-block): YouTube "SABR" zorunluluğu
// yüzünden youtube-source artık ses baytlarını çekemiyor ("No supported audio
// streams available"). Çözüm: SABR'ı konuşabilen yt-dlp. VPS'te küçük bir yerel
// HTTP köprüsü (server/ytstream.js -> :2444) yt-dlp ile sesi indirip seekable
// dosya olarak veriyor; Lavalink onu http kaynağı olarak çalıyor.
//
// Bu modül YouTube parçalarını "bridged" UnresolvedTrack'lere çevirir: Lavalink
// arama/kuyruk/ses/filtreleri yapmaya devam eder, sadece parça OYNATILACAĞI an
// (resolve) sesi köprüden çekeriz. Böylece playlist'ler toplu inmez.
const BRIDGE = process.env.YT_BRIDGE_URL || "http://127.0.0.1:2444";

/** Köprüye indirtip hazır olmasını bekler (cache'e alır). */
async function prepare(videoId) {
  const res = await fetch(`${BRIDGE}/prepare?v=${encodeURIComponent(videoId)}`, {
    signal: AbortSignal.timeout(120000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ready) throw new Error(j.error || `prepare HTTP ${res.status}`);
}

/** `this` (unresolved) nesnesini gerçek (resolved) http track'e dönüştürür. */
function becomeTrack(target, source) {
  for (const p of Object.getOwnPropertyNames(target)) delete target[p];
  for (const s of Object.getOwnPropertySymbols(target)) delete target[s];
  Object.assign(target, source);
  for (const s of Object.getOwnPropertySymbols(source)) {
    Object.defineProperty(target, s, { configurable: true, value: source[s] });
  }
}

/** Ortak: videoId'yi köprüle, http track döndür (metadata çağıran tarafından bindirilir). */
async function resolveViaBridge(self, player, videoId) {
  await prepare(videoId);
  const r = await player.search({ query: `${BRIDGE}/stream?v=${videoId}` }, self.requester);
  const closest = r?.tracks?.[0];
  if (!closest) throw new Error("köprü: http track çözülemedi");
  becomeTrack(self, closest);
  return closest;
}

/**
 * YouTube arama/URL sonucundan (videoId + metadata biliniyor) köprü parçası.
 * @param {import("discord.js").Client} client
 * @param {object} info  Lavalink track.info (identifier, title, author, ...)
 * @param {*} requester
 */
function bridgedFromInfo(client, info, requester) {
  const meta = {
    identifier: info.identifier,
    title: info.title,
    author: info.author,
    duration: info.duration ?? info.length,
    length: info.length ?? info.duration,
    artworkUrl: info.artworkUrl || null,
    uri: info.uri || `https://www.youtube.com/watch?v=${info.identifier}`,
    isSeekable: true,
    isStream: false,
    sourceName: "youtube",
  };
  const t = client.lavalink.utils.buildUnresolvedTrack({ info: meta, title: meta.title }, requester);
  t.resolve = async function (player) {
    await resolveViaBridge(this, player, meta.identifier);
    Object.assign(this.info, {
      title: meta.title,
      author: meta.author,
      artworkUrl: meta.artworkUrl,
      uri: meta.uri,
      identifier: meta.identifier,
      duration: meta.duration || this.info.duration,
      length: meta.length || this.info.length,
    });
    return this;
  };
  return t;
}

/**
 * Sadece başlık/sanatçı biliniyorsa (Spotify): önce YouTube'da bul, sonra köprüle.
 * @param {import("discord.js").Client} client
 * @param {{title:string, author:string, durationMs?:number, artworkUrl?:string}} q
 * @param {*} requester
 */
function bridgedFromQuery(client, q, requester) {
  const meta = {
    title: q.title,
    author: q.author,
    duration: q.durationMs || 0,
    length: q.durationMs || 0,
    artworkUrl: q.artworkUrl || null,
    identifier: "",
    uri: "",
    isSeekable: true,
    isStream: false,
    sourceName: "youtube",
  };
  const t = client.lavalink.utils.buildUnresolvedTrack({ info: meta, title: meta.title }, requester);
  t.resolve = async function (player) {
    // YouTube METADATA araması hâlâ çalışıyor (kırık olan yalnız playback).
    const yt = await player.search(
      { query: `${meta.title} ${meta.author}`.trim(), source: "ytsearch" },
      this.requester,
    );
    const ytTrack = yt?.tracks?.[0];
    if (!ytTrack?.info?.identifier) throw new Error("köprü: youtube arama sonucu yok");
    const id = ytTrack.info.identifier;
    await resolveViaBridge(this, player, id);
    Object.assign(this.info, {
      title: meta.title || ytTrack.info.title,
      author: meta.author || ytTrack.info.author,
      artworkUrl: meta.artworkUrl || ytTrack.info.artworkUrl,
      uri: ytTrack.info.uri,
      identifier: id,
      duration: (meta.duration || ytTrack.info.duration) ?? ytTrack.info.length,
      length: (meta.length || ytTrack.info.length) ?? ytTrack.info.duration,
    });
    return this;
  };
  return t;
}

/** Bir Lavalink track'i YouTube kaynaklı mı? (köprülenmeli mi) */
function isYouTubeTrack(track) {
  return track?.info?.sourceName === "youtube" && !!track?.info?.identifier;
}

module.exports = { bridgedFromInfo, bridgedFromQuery, isYouTubeTrack, BRIDGE };
