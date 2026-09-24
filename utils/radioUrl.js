// Radyo yayın adresini Lavalink'in çalabileceği hale getirir.
//
// Neden: bazı HLS radyolar (orn. Wowza ses-only: .../playlist.m3u8 ->
// chunklist -> media_*.aac) segmentleri MPEG-TS yerine ham ADTS .aac veriyor.
// Lavaplayer bu yayını "yükleniyor" gösterip hemen bitiriyor; bot da sonsuz
// "Bağlantı kesildi, tekrar bağlanılıyor" döngüsüne giriyordu. Bu tür yayınları
// VPS'teki köprünün /hls uç noktasına (ffmpeg -> düz ADTS akışı) yönlendiriyoruz.
// Normal (TS segmentli) HLS ve Icecast/Shoutcast adresleri olduğu gibi kalır.
const BRIDGE = process.env.YT_BRIDGE_URL || "http://127.0.0.1:2444";
const CACHE_MS = 6 * 60 * 60 * 1000;

const cache = new Map(); // url -> { needsBridge, at }

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { text: await res.text(), url: res.url || url };
}

/** m3u8 içindeki ilk URI satırı (yorum olmayan). */
function firstUri(text, base) {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
  return line ? new URL(line, base).href : null;
}

/** HLS yayınının segmentleri ham AAC/ADTS mi? (master -> media playlist'e iner) */
async function hasAdtsSegments(url) {
  let { text, url: base } = await fetchText(url);
  for (let depth = 0; depth < 3; depth++) {
    const uri = firstUri(text, base);
    if (!uri) return false;
    const path = new URL(uri).pathname.toLowerCase();
    if (path.endsWith(".m3u8")) {
      ({ text, url: base } = await fetchText(uri));
      continue;
    }
    return path.endsWith(".aac") || path.endsWith(".adts");
  }
  return false;
}

/**
 * Lavalink'e verilecek adresi döndürür. Tespit hata verirse orijinal adres.
 * @param {string} url
 */
async function resolveRadioUrl(url) {
  if (!/\.m3u8(\?|$)/i.test(url)) return url;
  const hit = cache.get(url);
  let needsBridge = hit && Date.now() - hit.at < CACHE_MS ? hit.needsBridge : undefined;
  if (needsBridge === undefined) {
    try {
      needsBridge = await hasAdtsSegments(url);
      cache.set(url, { needsBridge, at: Date.now() });
    } catch {
      needsBridge = false;
    }
  }
  return needsBridge ? `${BRIDGE}/hls?u=${encodeURIComponent(url)}` : url;
}

module.exports = { resolveRadioUrl };
