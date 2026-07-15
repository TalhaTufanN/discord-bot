// Yerel Sagopa koleksiyonu — Lavalink surumu.
//
// DisTube surumune gore cok sadelesti:
//  - ffprobe ile sure okuma YOK -> Lavalink dosyayi cozerken sureyi kendi veriyor
//  - hardlink/symlink .distube_temp numarasi YOK -> o numara DisTube+FFmpeg'in
//    file:// icindeki %20'de bogulmasi yuzundendi; Lavalink ham yolu
//    bosluklariyla birlikte kabul ediyor (VPS'te test edildi)
//  - new Song(...) / song.stream.url YOK -> track'i player.search donduruyor
const fs = require("fs");
const path = require("path");

function getMusicPath() {
  return (
    process.env.SAGOPA_PATH ||
    path.join(__dirname, "..", "music", "Sagopa Kajmer")
  );
}

/** Klasordeki (alt klasorler dahil) tum ses dosyalarini bulur */
function getAllAudioFiles(dirPath, arrayOfFiles) {
  arrayOfFiles = arrayOfFiles || [];
  try {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        getAllAudioFiles(fullPath, arrayOfFiles);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === ".mp3" || ext === ".m4a" || ext === ".wav") {
          arrayOfFiles.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error("Klasör okuma hatası:", error.message);
  }
  return arrayOfFiles;
}

/**
 * Yerel bir dosyayi Lavalink track'ine cevirir.
 *
 * ONEMLI: Lavalink'in yerel kaynagi HAM dosya yolu bekliyor — "file://" ve
 * "local:" onekleri loadType=empty donuyor (VPS'te test edildi). lavalink-client
 * yalnizca source:"local" verildiginde onek eklemiyor (dist/index.cjs:1515),
 * o yuzden source'u acikca gecmek ZORUNLU; aksi halde yol "ytsearch:" ile
 * oneklenip YouTube'da aranir.
 */
async function resolveLocalTrack(player, filePath, requester, userData = {}) {
  const res = await player.search({ query: filePath, source: "local" }, requester);
  const track = res?.tracks?.[0];
  if (!track) return null;

  // Sagopa dosyalarinin cogunda ID3 etiketi yok -> Lavalink "Unknown title" /
  // "Unknown artist" veriyor. Eski davranis dosya adini baslik yapmakti.
  const fileName = path.basename(filePath, path.extname(filePath));
  if (!track.info.title || /^unknown title$/i.test(track.info.title)) {
    track.info.title = fileName;
  }
  if (!track.info.author || /^unknown artist$/i.test(track.info.author)) {
    track.info.author = "Sagopa Kajmer";
  }

  track.userData = { ...(track.userData || {}), ...userData };
  return track;
}

/** Koleksiyondan rastgele bir Sagopa sarkisi (yoksa null) */
async function getRandomSagopaTrack(player, requester, userData = {}) {
  const musicPath = getMusicPath();
  if (!fs.existsSync(musicPath)) return null;
  const allFiles = getAllAudioFiles(musicPath);
  if (allFiles.length === 0) return null;
  const filePath = allFiles[Math.floor(Math.random() * allFiles.length)];
  return await resolveLocalTrack(player, filePath, requester, userData);
}

/**
 * Surekli mod aktifse mevcut sarkidan yeni bir rastgele Sagopa'ya gecer.
 * Islem yapildiysa true; mod aktif degilse false (cagiran taraf o zaman
 * normal durdurma davranisini uygular).
 */
async function skipToRandomSagopa(player, client) {
  const guildId = player?.guildId;
  if (!guildId || !client.sagopaGuilds?.has(guildId)) return false;
  if (!player.voiceChannelId) return false;

  const ctx = client.sagopaGuilds.get(guildId);
  const track = await getRandomSagopaTrack(player, ctx.requester, {
    sagopaAuto: true,
  });
  if (!track) return false;

  // Siranin basina ekleyip ona atla (add+skip mantigi DisTube surumuyle ayni)
  await player.queue.add(track, 0);
  await player.skip();
  return true;
}

module.exports = {
  getMusicPath,
  getAllAudioFiles,
  resolveLocalTrack,
  getRandomSagopaTrack,
  skipToRandomSagopa,
};
