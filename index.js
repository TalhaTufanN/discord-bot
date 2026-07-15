require("node:dns").setDefaultResultOrder("ipv4first");
const net = require("node:net");
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
// const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YouTubePlugin } = require("@distube/youtube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { emojis } = require("./config/emojis");

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create collections for commands
client.commands = new Collection();

// --- Process seviyesi hata yakalayicilar ---
// Yakalanmayan bir promise reddi/hatasi tum botu dusurup pm2'yi crash-loop'a
// sokmasin diye burada logluyoruz. Bot cok sunucuya hizmet ettiginden basibos
// bir hata yuzunden komple olmesini istemiyoruz.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// --- Gateway saglik izleme ---
// "pm2'de online ama Discord'da offline" (donma) durumunu tespit/toparlamak icin.
client.on(Events.ShardError, (error, shardId) => {
  console.error(`[Gateway] Shard ${shardId} hata:`, error?.message || error);
});
client.on(Events.ShardDisconnect, (event, shardId) => {
  console.warn(
    `[Gateway] Shard ${shardId} baglanti kesildi (kod: ${event?.code}). Yeniden baglanmaya calisiliyor...`,
  );
});
client.on(Events.ShardReconnecting, (shardId) => {
  console.warn(`[Gateway] Shard ${shardId} yeniden baglaniyor...`);
});
client.on(Events.ShardResume, (shardId, replayed) => {
  console.log(`[Gateway] Shard ${shardId} oturum devam ettirildi (${replayed} olay tekrar oynatildi).`);
});
client.on("error", (error) => {
  console.error("[Client] Hata:", error?.message || error);
});
// Oturum kalici olarak gecersiz kilindiginda discord.js kendini toparlayamaz;
// temiz bir restart icin cikiyoruz (pm2 yeniden baslatir).
client.on(Events.Invalidated, () => {
  console.error("[Gateway] Oturum gecersiz kilindi. Temiz restart icin cikiliyor...");
  process.exit(1);
});

// Parse cookies from Netscape format (cookies.txt) for YouTubePlugin
function parseNetscapeCookies() {
  const possiblePaths = [
    path.join(__dirname, "cookies.txt"),
    "/root/.config/yt-dlp/cookies.txt",
    path.join("/root", ".config", "yt-dlp", "cookies.txt")
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        console.log(`[Cookies] Reading cookies from: ${filePath}`);
        const content = fs.readFileSync(filePath, "utf8");
        const cookies = [];
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const parts = trimmed.split("\t");
          if (parts.length < 7) continue;
          cookies.push({
            domain: parts[0],
            path: parts[2],
            secure: parts[3] === "TRUE",
            expirationDate: parseInt(parts[4], 10),
            name: parts[5],
            value: parts[6],
          });
        }
        if (cookies.length > 0) {
          console.log(`[Cookies] Successfully parsed ${cookies.length} cookies!`);
          return cookies;
        }
      } catch (err) {
        console.error(`[Cookies] Error parsing ${filePath}:`, err);
      }
    }
  }
  console.log("[Cookies] No valid cookies.txt found in search paths.");
  return undefined;
}

const ytCookies = parseNetscapeCookies();

const ytDlpPlugin = new YtDlpPlugin({ update: false });
const youtubePlugin = new YouTubePlugin({ cookies: ytCookies });

// Cookie'li YouTube instance'ini komutlarin ( or. /çal aramasi) yeniden
// kullanabilmesi icin client'a bagla. Boylece arama da cookie'den faydalanir
// ve YouTube bot-algilama/arama hatalarina daha az takilir.
client.youtubePlugin = youtubePlugin;

// Capture the original ytDlp getStreamURL method (guvenli fallback icin)
const originalYtDlpGetStreamURL = ytDlpPlugin.getStreamURL.bind(ytDlpPlugin);

// yt-dlp binary + cookies yolu
const { spawn } = require("node:child_process");
const YTDLP_BIN = path.join(
  __dirname,
  "node_modules",
  "@distube",
  "yt-dlp",
  "bin",
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
);
const YTDLP_COOKIES = (() => {
  const p = path.join(__dirname, "cookies.txt");
  return fs.existsSync(p) ? p : null;
})();

// Bu VPS (datacenter IP) YouTube tarafindan throttle/PO-token dayatmasina
// takildigindan varsayilan client'lar googlevideo'dan 403 aliyor (FFmpeg code 8).
// Tek client kirilgan: bazi videolar web_safari'de "format yok", bazilari mweb/
// web_music'te calisiyor. Bu yuzden bir client ZINCIRI deniyoruz; ilk basariyla
// URL cikaran client'i kullaniyoruz. Yaygin videolar ilk client'ta (web_safari)
// cozuldugu icin ek gecikme olmaz.
const YTDLP_CLIENTS = ["web_safari", "web_music", "mweb"];

function ytdlpResolveStreamURL(songUrl) {
  return new Promise((resolve, reject) => {
    let idx = 0;
    let lastErr = null;

    const tryNext = () => {
      if (idx >= YTDLP_CLIENTS.length) {
        return reject(lastErr || new Error("yt-dlp: hiçbir client çözemedi"));
      }
      const client = YTDLP_CLIENTS[idx++];
      const ytdlpArgs = [
        songUrl,
        "--no-warnings",
        "--skip-download",
        "-f",
        "bestaudio/best",
        "-g",
        "--extractor-args",
        `youtube:player_client=${client}`,
      ];
      if (YTDLP_COOKIES) ytdlpArgs.push("--cookies", YTDLP_COOKIES);

      const proc = spawn(YTDLP_BIN, ytdlpArgs);
      let out = "";
      let err = "";
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", (d) => (err += d.toString()));
      proc.on("error", (e) => {
        lastErr = e;
        tryNext();
      });
      proc.on("close", (code) => {
        const url = out.trim().split("\n").filter(Boolean)[0];
        if (code === 0 && url && url.startsWith("http")) {
          if (client !== YTDLP_CLIENTS[0]) {
            console.log(`[Streaming] "${client}" client'i ile çözüldü.`);
          }
          resolve(url);
        } else {
          lastErr = new Error(err.trim() || `yt-dlp exited with code ${code}`);
          tryNext();
        }
      });
    };

    tryNext();
  });
}

// --- Stream URL prefetch ---
// Bir sarki calarken sonrakinin stream URL'ini arka planda cozup burada tutuyoruz
// (googlevideo URL'leri bir sure gecerli). Boylece sarki gecisleri anlik olur.
// Ayrica /cal bir link atildiginda play() ile PARALEL olarak burayi tetikliyor:
// metadata resolve'u ile stream cozumu ayni anda gidiyor.
const streamUrlCache = new Map(); // key -> { url?, promise, expires }
const STREAM_CACHE_TTL = 30 * 60 * 1000;

// Ayni videoya farkli URL bicimleriyle gelinebiliyor (youtu.be/ID, watch?v=ID&t=30).
// Onbellegi video ID'sine gore anahtarliyoruz; yoksa prefetch ettigimiz URL ile
// playSong'daki song.url tutmayip onbellek isabetsiz kaliyor.
function youtubeVideoId(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (/^(music\.|m\.)?youtube(-nocookie)?\.com$/.test(host)) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const m = url.pathname.match(/^\/(?:shorts|embed|v|live)\/([^/?#]+)/);
      if (m) return m[1];
    }
  } catch (e) {}
  return null;
}

function streamCacheKey(u) {
  const id = youtubeVideoId(u);
  return id ? `yt:${id}` : u;
}

function pruneStreamCache() {
  if (streamUrlCache.size < 50) return;
  const now = Date.now();
  for (const [k, v] of streamUrlCache) if (v.expires <= now) streamUrlCache.delete(k);
}

function prefetchStreamURL(songUrl) {
  if (!songUrl || !/^https?:/i.test(songUrl)) return;
  // Saf playlist URL'i (tek video icermeyen): -g ile cozulemez, atla.
  if (isYouTubePlaylistUrl(songUrl) && !youtubeVideoId(songUrl)) return;
  const key = streamCacheKey(songUrl);
  if (streamUrlCache.has(key)) return;
  pruneStreamCache();
  const entry = { expires: Date.now() + STREAM_CACHE_TTL };
  entry.promise = ytdlpResolveStreamURL(songUrl)
    .then((url) => {
      entry.url = url;
      return url;
    })
    .catch(() => {
      streamUrlCache.delete(key);
      return null;
    });
  streamUrlCache.set(key, entry);
}

// /cal gibi komutlar play() cagirmadan hemen once bunu tetikleyip stream
// cozumunu metadata resolve'u ile paralel calistirabilsin diye disari aciyoruz.
client.prefetchStreamURL = prefetchStreamURL;

// Helper for self-healing streaming
async function getStreamURLWithFallback(song) {
  console.log(`[Streaming] Resolving stream for "${song.name}" (${song.url || "No URL"})`);

  // Yerel dosya / http olmayan kaynaklar: orijinal davranisa birak
  if (!song.url || !/^https?:/i.test(song.url)) {
    return await originalYtDlpGetStreamURL(song);
  }

  // Prefetch onbelleginde hazir (veya devam eden) bir cozum varsa onu kullan
  const cacheKey = streamCacheKey(song.url);
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    streamUrlCache.delete(cacheKey);
    try {
      const url = cached.url || (await cached.promise);
      if (url) {
        console.log(`[Streaming] Prefetch önbelleğinden alındı: "${song.name}"`);
        return url;
      }
    } catch (e) {
      /* prefetch basarisiz oldu, normal cozume devam */
    }
  }

  try {
    return await ytdlpResolveStreamURL(song.url);
  } catch (err) {
    const errMsg = err.message || String(err);
    const isBotOrRestrict =
      errMsg.includes("Sign in") ||
      errMsg.includes("LOGIN_REQUIRED") ||
      errMsg.includes("confirm you're not a bot") ||
      errMsg.includes("bot") ||
      errMsg.includes("Forbidden") ||
      errMsg.includes("403") ||
      errMsg.includes("format");

    if (isBotOrRestrict) {
      console.log(
        `[Streaming Alert] "${song.name}" engelli/kisitli görünüyor. Temiz alternatif aranıyor...`,
      );
      try {
        const query = `${song.name} Audio`;
        const results = await client.distube.search(query, { limit: 5 });
        for (const result of results) {
          if (result.id === song.id) continue;
          try {
            console.log(
              `[Streaming Fallback] Deneniyor: "${result.name}" (${result.url})`,
            );
            const fallbackUrl = await ytdlpResolveStreamURL(result.url);
            if (fallbackUrl) {
              console.log(`[Streaming Fallback] BAŞARILI: "${result.name}"`);
              return fallbackUrl;
            }
          } catch (fallbackErr) {
            console.log(
              `[Streaming Fallback] "${result.name}" başarısız: ${fallbackErr.message || fallbackErr}`,
            );
          }
        }
      } catch (searchErr) {
        console.error(
          "[Streaming Fallback] Arama başarısız:",
          searchErr.message || searchErr,
        );
      }
    }
    throw err;
  }
}

// Override getStreamURL for BOTH plugins to use our self-healing fallback mechanism
ytDlpPlugin.getStreamURL = getStreamURLWithFallback;
youtubePlugin.getStreamURL = getStreamURLWithFallback;

// --- Flat (lazy) playlist çözümü ---
// Büyük playlist'leri baştan tam çözmek (48 parçanın hepsinin bilgisini çekmek)
// datacenter IP'de dakikalarca sürüyordu. Bunun yerine playlist'i "flat" çözüyoruz:
// sadece ad + her parçanın başlık/URL/süresi (hızlı). İlk şarkı hemen çalar; her
// parçanın stream'i sırası gelince getStreamURL (web_safari) ile çözülür.
const { Song: DTSong, Playlist: DTPlaylist } = require("distube");

function isYouTubePlaylistUrl(u) {
  return (
    /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(u) &&
    (/[?&]list=/i.test(u) || /\/playlist/i.test(u))
  );
}

function ytdlpFlatPlaylist(url) {
  return new Promise((resolve, reject) => {
    const flatArgs = [
      url,
      "--flat-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--extractor-args",
      "youtube:player_client=web_safari",
    ];
    if (YTDLP_COOKIES) flatArgs.push("--cookies", YTDLP_COOKIES);

    const proc = spawn(YTDLP_BIN, flatArgs);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.trim() || `yt-dlp exited ${code}`));
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const originalYtDlpResolve = ytDlpPlugin.resolve.bind(ytDlpPlugin);
ytDlpPlugin.resolve = async function (url, options) {
  if (isYouTubePlaylistUrl(url)) {
    try {
      const info = await ytdlpFlatPlaylist(url);
      if (info && Array.isArray(info.entries) && info.entries.length > 0) {
        const source = info.extractor_key || info.extractor || "youtube";
        const songs = info.entries
          .filter((e) => e && (e.url || e.id))
          .map(
            (e) =>
              new DTSong(
                {
                  plugin: ytDlpPlugin,
                  source,
                  playFromSource: true,
                  id: e.id,
                  name: e.title || e.id,
                  url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
                  duration: e.duration || 0,
                  thumbnail: e.thumbnails?.[0]?.url || e.thumbnail,
                  uploader: {
                    name: e.uploader || e.channel,
                    url: e.uploader_url || e.channel_url,
                  },
                },
                options,
              ),
          );
        console.log(
          `[Flat Playlist] "${info.title || "Playlist"}" → ${songs.length} parça (hızlı çözüm)`,
        );
        return new DTPlaylist(
          {
            source,
            songs,
            id: info.id?.toString(),
            name: info.title || "Playlist",
            url: info.webpage_url || url,
            thumbnail: info.thumbnails?.[0]?.url,
          },
          options,
        );
      }
    } catch (e) {
      console.error(
        "[Flat Playlist] Başarısız, normal çözüme dönülüyor:",
        e.message,
      );
    }
  }
  return await originalYtDlpResolve(url, options);
};

// --- YouTube tek video resolve'u: yt-dlp yerine in-process ---
// YtDlpPlugin.validate() kosulsuz true donuyor, yani plugin sirasinda ondan once
// gelmezse youtubePlugin resolve tarafinda hic devreye girmiyordu. Sirayi
// duzelttik (youtubePlugin once, ytDlpPlugin en sonda -> plugin'in kendi
// "should be last" uyarisi da susuyor). Boylece tek video linkleri yt-dlp
// surecine gerek kalmadan ytdl-core'un getBasicInfo'su ile cozuluyor.
//
// Playlist'ler yine ytDlpPlugin'in flat cozumune gitsin diye youtubePlugin'i
// playlist URL'lerinde devre disi birakiyoruz.
const originalYouTubeValidate = youtubePlugin.validate.bind(youtubePlugin);
youtubePlugin.validate = function (url) {
  if (isYouTubePlaylistUrl(url) && !youtubeVideoId(url)) return false;
  return originalYouTubeValidate(url);
};

// Bu VPS'in datacenter IP'si YouTube bot-algilamasina takilabiliyor. ytdl-core
// resolve'u patlarsa play() komple hata verir (DisTube plugin secildikten sonra
// digerine dusmez), o yuzden eski yt-dlp yoluna kendimiz geri duselim.
const originalYouTubeResolve = youtubePlugin.resolve.bind(youtubePlugin);
youtubePlugin.resolve = async function (url, options) {
  try {
    return await originalYouTubeResolve(url, options);
  } catch (e) {
    console.warn(
      `[YouTube] Hizli resolve basarisiz (${e?.message || e}). yt-dlp'ye dusuluyor...`,
    );
    return await ytDlpPlugin.resolve(url, options);
  }
};

// Initialize DisTube
const ffmpegPath = require("ffmpeg-static");
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  ffmpeg: {
    path: "/usr/bin/ffmpeg"
  },
  plugins: [
    new SpotifyPlugin({}),
    youtubePlugin,
    ytDlpPlugin,
  ],
});

// Bir sarki calmaya baslayinca sonrakinin stream URL'ini prefetch et →
// gecisler neredeyse anlik olur (yerel dosyalar http olmadigi icin atlanir).
client.distube.on("playSong", (queue) => {
  try {
    const next = queue.songs && queue.songs[1];
    if (next) prefetchStreamURL(next.url);
  } catch (e) {}
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));
const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

// Deploy slash commands
const deployCommands = async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );
    console.log(`Commands to load: ${commands.map((c) => c.name).join(", ")}`);

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(process.env.TOKEN);

    // Support multiple Guild IDs (comma separated in .env)
    const guildIds = process.env.GUILD_ID.split(",").map((id) => id.trim());

    for (const guildId of guildIds) {
      if (!guildId) continue;

      // Deploy Guild Commands (Instant update)
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(
        `[${guildId}] Successfully reloaded ${data.length} guild application (/) commands.`,
      );
    }

    // Clear global commands (to prevent duplicates) - uncomment if needed
    // await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    //   body: [],
    // });
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
};

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// DisTube events
const { handleDistubeEvents } = require("./utils/distubeEvents");
handleDistubeEvents(client);

// Deploy commands and then log in to Discord
(async () => {
  await deployCommands();
  client.login(process.env.TOKEN);
})();
