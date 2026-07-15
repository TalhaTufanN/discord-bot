// Spotify link cozucu (sarki + album).
//
// NEDEN KENDI KODUMUZ, LavaSrc DEGIL:
// LavaSrc album/playlist yuklerken parca detaylarini toplu cekmek icin
// /v1/tracks?ids=... (multi-get) cagiriyor. Spotify 27 Kasim 2024 sonrasi
// acilan app'lere TUM multi-get endpoint'lerini 403 ile kapatti
// (tracks?ids=, albums?ids=, artists?ids= — hepsi olculdu). Bu yuzden LavaSrc
// bu app ile album cozemiyor. Bize multi-get GEREKMIYOR: /albums/{id}/tracks
// zaten ad + sanatci + sure veriyor, YouTube'da aratmak icin bu yeterli.
//
// Spotify sadece METADATA kaynagi; ses YouTube'dan geliyor (eski
// @distube/spotify'in yaptigi isin aynisi).
//
// PLAYLIST DESTEKLENMIYOR: Spotify yeni app'lerde playlist parcalarini
// tamamen kapatmis — /playlists/{id} meta veriyor ama tracks alani hic yok,
// /playlists/{id}/tracks ise 403. Editoryal/algoritmik olanlar degil, ALTI
// farkli kullanici listesinde de ayni sonuc olculdu. Anonim token yolu da
// olu ("Spotify generated playlists are no longer accessible via anonymous
// tokens"), spDc ise yalnizca sarki sozleri icin.

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

/** Desteklenmeyen tur (playlist/artist) — cagiran taraf kullaniciya gosterir */
class SpotifyUnsupportedError extends Error {}
/** Kimlik bilgisi yok/yanlis */
class SpotifyAuthError extends Error {}

let tokenCache = { value: null, expiresAt: 0 };

function credentials() {
  return {
    id: process.env.SPOTIFY_CLIENT_ID,
    secret: process.env.SPOTIFY_CLIENT_SECRET,
  };
}

function isConfigured() {
  const { id, secret } = credentials();
  return Boolean(id && secret);
}

async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const { id, secret } = credentials();
  if (!id || !secret) {
    throw new SpotifyAuthError("Spotify kimlik bilgisi tanimli degil (.env: SPOTIFY_CLIENT_ID/SECRET)");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new SpotifyAuthError(
      `Spotify token alinamadi (HTTP ${res.status}): ${body.error_description || body.error || "bilinmeyen"}`,
    );
  }

  tokenCache = {
    value: body.access_token,
    // 60 sn pay birak, sinirda yenilenme yarisina girmeyelim
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return tokenCache.value;
}

async function api(path) {
  const token = await getToken();
  const res = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
  if (res.status === 401) {
    // Token suresi beklenenden once dolmus olabilir; bir kez tazeleyip dene
    tokenCache = { value: null, expiresAt: 0 };
    const retryToken = await getToken();
    const retry = await fetch(API + path, { headers: { Authorization: "Bearer " + retryToken } });
    if (!retry.ok) throw new Error(`Spotify API HTTP ${retry.status} (${path})`);
    return await retry.json();
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(`Spotify API HTTP ${res.status}: ${b.error?.message || "hata"} (${path})`);
  }
  return await res.json();
}

const SPOTIFY_HOSTS = /^(open|play)\.spotify\.com$/i;

/** Spotify baglantisi mi? (URL veya spotify:track:ID bicimi) */
function isSpotifyUrl(input) {
  if (typeof input !== "string") return false;
  if (/^spotify:(track|album|playlist|artist):[A-Za-z0-9]+/i.test(input.trim())) return true;
  try {
    return SPOTIFY_HOSTS.test(new URL(input.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * URL -> { type, id }. Bolge onekini de kaldirir (/intl-tr/track/ID).
 */
function parseSpotifyUrl(input) {
  const raw = input.trim();

  const uri = raw.match(/^spotify:(track|album|playlist|artist):([A-Za-z0-9]+)/i);
  if (uri) return { type: uri[1].toLowerCase(), id: uri[2] };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!SPOTIFY_HOSTS.test(url.hostname)) return null;

  // /intl-tr/track/ID gibi bolge oneklerini at
  const parts = url.pathname.split("/").filter(Boolean).filter((p) => !/^intl-[a-z]{2}$/i.test(p));
  const i = parts.findIndex((p) => ["track", "album", "playlist", "artist"].includes(p.toLowerCase()));
  if (i === -1 || !parts[i + 1]) return null;

  return { type: parts[i].toLowerCase(), id: parts[i + 1].split("?")[0] };
}

const artistNames = (artists) => (artists || []).map((a) => a.name).filter(Boolean).join(", ");

function toItem(track) {
  return {
    title: track.name,
    author: artistNames(track.artists),
    durationMs: track.duration_ms || 0,
    isrc: track.external_ids?.isrc || undefined,
    uri: track.external_urls?.spotify || undefined,
    artworkUrl: track.album?.images?.[0]?.url || undefined,
  };
}

/**
 * Spotify baglantisini metadata'ya cevirir.
 * @returns {Promise<{type:"track"|"album", name:string, url?:string, thumbnail?:string, items:Array}>}
 * @throws {SpotifyUnsupportedError} playlist/artist icin
 */
async function resolveSpotify(input) {
  const parsed = parseSpotifyUrl(input);
  if (!parsed) throw new Error("Spotify bağlantısı çözümlenemedi.");

  if (parsed.type === "playlist") {
    throw new SpotifyUnsupportedError(
      "Spotify **playlist** bağlantıları desteklenmiyor — Spotify bu erişimi yeni uygulamalara kapattı. Şarkı ve albüm bağlantıları çalışıyor.",
    );
  }
  if (parsed.type === "artist") {
    throw new SpotifyUnsupportedError(
      "Spotify **sanatçı** bağlantıları desteklenmiyor. Şarkı veya albüm bağlantısı gönder.",
    );
  }

  if (parsed.type === "track") {
    const t = await api(`/tracks/${parsed.id}`);
    return {
      type: "track",
      name: t.name,
      url: t.external_urls?.spotify,
      thumbnail: t.album?.images?.[0]?.url,
      items: [toItem(t)],
    };
  }

  // album
  const album = await api(`/albums/${parsed.id}`);
  const cover = album.images?.[0]?.url;
  const items = [];

  // Sayfalama: Spotify album parcalarinda limit ust siniri 50 (100 -> 400 Invalid limit)
  let offset = 0;
  const LIMIT = 50;
  for (;;) {
    const page = await api(`/albums/${parsed.id}/tracks?limit=${LIMIT}&offset=${offset}`);
    for (const t of page.items || []) {
      // Album parca nesneleri "simplified": album/gorsel/ISRC icermiyor.
      // Gorseli albumden, kalanini oldugu gibi aliyoruz — YouTube'da aratmak
      // icin ad + sanatci yeterli. (ISRC icin multi-get gerekirdi, o da 403.)
      items.push({ ...toItem(t), artworkUrl: cover });
    }
    offset += LIMIT;
    if (!page.next || offset >= (page.total || 0)) break;
  }

  return {
    type: "album",
    name: album.name,
    url: album.external_urls?.spotify,
    thumbnail: cover,
    items,
  };
}

/**
 * Spotify metadata -> lavalink-client UnresolvedTrack.
 * Cozum (YouTube aramasi) sirasi gelince yapiliyor; boylece 50 parcalik album
 * aninda kuyruga giriyor, bot beklemiyor.
 *
 * DIKKAT — info'ya "uri" ve "sourceName" KOYMA:
 * lavalink-client'in getClosestTrack'i (dist/index.cjs:1221-1230) aramayi
 * bu alanlardan kuruyor:
 *   - info.uri varsa ONCE onu Lavalink'e soruyor -> Spotify URL'i verirsek
 *     Spotify kaynagi arar; bizde LavaSrc yok, her parca trackError olur.
 *   - info.sourceName'i arama kaynagi olarak geciyor -> "spotify" dersek
 *     yine ayni sey.
 * Bos birakinca: source undefined -> defaultSearchPlatform ("ytsearch") ve
 * sorgu "<baslik> by <sanatci>" olarak kuruluyor. Istedigimiz tam da bu.
 * Cozulen YouTube parcasina bizim baslik/sanatci/gorsel bilgimiz zaten
 * applyUnresolvedData ile geri isleniyor.
 */
function toUnresolvedTracks(client, items, requester) {
  return items.map((it) =>
    client.lavalink.utils.buildUnresolvedTrack(
      {
        title: it.title,
        author: it.author,
        duration: it.durationMs,
        artworkUrl: it.artworkUrl,
      },
      requester,
    ),
  );
}

module.exports = {
  isSpotifyUrl,
  parseSpotifyUrl,
  resolveSpotify,
  toUnresolvedTracks,
  isConfigured,
  SpotifyUnsupportedError,
  SpotifyAuthError,
};
