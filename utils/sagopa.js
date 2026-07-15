const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("url");
const { Song } = require("distube");

const FFPROBE_PATH = process.env.FFPROBE_PATH || "/usr/bin/ffprobe";

// Yerel bir ses dosyasinin suresini (saniye) ffprobe ile okur. Hata olursa 0.
function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE_PATH, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("error", () => resolve(0));
    proc.on("close", () => {
      const sec = parseFloat(out.trim());
      resolve(Number.isFinite(sec) ? Math.round(sec) : 0);
    });
  });
}

// Yerel Sagopa dosyalari icin gecici (bosluksuz) kopyalarin tutuldugu klasor.
// DisTube, file:// URL'lerindeki boslugu %20 encode edip FFmpeg'i "code 254"
// ile cokertiyor; bu yuzden bosluksuz bir hardlink/symlink kopyasi veriyoruz.
const tempDir = path.join(__dirname, "..", ".distube_temp");

// Modul ilk yuklendiginde eski gecici dosyalari temizle
try {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  } else {
    for (const f of fs.readdirSync(tempDir)) {
      try {
        fs.unlinkSync(path.join(tempDir, f));
      } catch (e) {}
    }
  }
} catch (e) {}

function getMusicPath() {
  return (
    process.env.SAGOPA_PATH ||
    path.join(__dirname, "..", "music", "Sagopa Kajmer")
  );
}

// Klasordeki (alt klasorler dahil) tum ses dosyalarini bulur
function getAllAudioFiles(dirPath, arrayOfFiles) {
  try {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllAudioFiles(fullPath, arrayOfFiles);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (ext === ".mp3" || ext === ".m4a" || ext === ".wav") {
          arrayOfFiles.push(fullPath);
        }
      }
    });
  } catch (error) {
    console.error("Klasör okuma hatası:", error.message);
  }
  return arrayOfFiles;
}

// Yerel bir dosya yolundan DisTube Song nesnesi olusturur (sure ffprobe ile okunur)
async function createLocalSong(filePath, { member, metadata } = {}) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const tempName = crypto.randomBytes(8).toString("hex") + ext;
  const tempPath = path.join(tempDir, tempName);

  let usePath = filePath;
  try {
    fs.linkSync(filePath, tempPath); // Hardlink (ayni diskteyse hizli, alan kaplamaz)
    usePath = tempPath;
  } catch (err) {
    try {
      fs.symlinkSync(filePath, tempPath); // Hardlink olmazsa symlink
      usePath = tempPath;
    } catch (err2) {
      // Ikisi de olmazsa orijinal yolu kullan
    }
  }

  const fileUrl = pathToFileURL(usePath).href;
  const duration = await getAudioDuration(filePath);

  const song = new Song(
    {
      id: filePath,
      name: fileName,
      url: fileUrl,
      source: "file",
      playFromSource: true,
      duration,
      uploader: { name: "Sagopa Kajmer", url: null },
    },
    { member, metadata },
  );

  // DisTube'un eklenti aramasini atlamak icin stream URL'ini dogrudan dosya yolu yap
  song.stream.url = fileUrl;

  return song;
}

// Koleksiyondan rastgele bir Sagopa sarkisi secip Song nesnesi dondurur (yoksa null)
async function getRandomSagopaSong({ member, metadata } = {}) {
  const musicPath = getMusicPath();
  if (!fs.existsSync(musicPath)) return null;
  const allFiles = getAllAudioFiles(musicPath);
  if (allFiles.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * allFiles.length);
  return await createLocalSong(allFiles[randomIndex], { member, metadata });
}

// Surekli mod aktifse, mevcut sarkiyi yeni bir rastgele Sagopa ile degistirir
// (skip = yeni rastgele). Islem yapildiysa true doner; mod aktif degilse false
// (cagiran taraf o zaman normal durdurma davranisini uygular).
async function skipToRandomSagopa(queue, client) {
  const guildId = queue.id;
  if (!client.sagopaGuilds || !client.sagopaGuilds.has(guildId)) return false;
  if (!queue.voiceChannel) return false;

  const ctx = client.sagopaGuilds.get(guildId);
  const song = await getRandomSagopaSong({
    member: ctx.member,
    metadata: { sagopaAuto: true },
  });
  if (!song) return false;

  // Yeni sarkiyi kuyruga ekleyip mevcut sarkidan ona atla
  await client.distube.play(queue.voiceChannel, song, {
    member: ctx.member,
    textChannel: queue.textChannel,
    metadata: { sagopaAuto: true },
  });
  await queue.skip();
  return true;
}

module.exports = {
  tempDir,
  getMusicPath,
  getAllAudioFiles,
  createLocalSong,
  getRandomSagopaSong,
  skipToRandomSagopa,
};
