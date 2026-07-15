const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const fs = require("fs");
const path = require("path");
const PerformanceTimer = require("../utils/timer");
const { getSettings, setSettings } = require("../utils/settings");
const {
  getMusicPath,
  getAllAudioFiles,
  createLocalSong,
  getRandomSagopaSong,
} = require("../utils/sagopa");

// Autocomplete cache
let cache = {
  albums: [],
  songs: [],
  lastUpdated: 0,
};

function updateCache(musicPath) {
  const now = Date.now();
  // 60 saniyede bir klasoru taramak yeterli
  if (now - cache.lastUpdated < 60000) return;
  if (!fs.existsSync(musicPath)) return;

  try {
    cache.albums = fs
      .readdirSync(musicPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const allFiles = getAllAudioFiles(musicPath);
    cache.songs = allFiles.map((f) => ({
      name: path.basename(f, path.extname(f)),
      path: f,
      album: path.basename(path.dirname(f)),
    }));

    cache.lastUpdated = now;
  } catch (err) {
    console.error("Cache update error:", err);
  }
}

// Turkce karakter / buyuk-kucuk harf duyarsiz karsilastirma
function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .trim();
}

// Bu guild icin surekli mod acik mi (varsayilan: acik)
function isAutoplayEnabled(guildId) {
  return getSettings(guildId).sagopaAutoplay !== false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sagola")
    .setDescription("Bilgisayardan/Sunucudan Sagopa Kajmer şarkıları çalar")
    .addStringOption((option) =>
      option
        .setName("arama")
        .setDescription("Rastgele için boş bırakın veya açılır pencereden seçin.")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("surekli")
        .setDescription(
          "Sürekli rastgele Sagopa modunu aç/kapat (varsayılan: açık)",
        )
        .setRequired(false)
        .addChoices(
          { name: "Aç", value: "ac" },
          { name: "Kapat", value: "kapat" },
        ),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const normalizedFocused = normalize(focusedValue);

    const musicPath = getMusicPath();
    updateCache(musicPath);

    const choices = [];

    if (!normalizedFocused) {
      choices.push({ name: "🎲 Rastgele (Karışık Çal)", value: "rastgele" });
    }

    // Albumler
    cache.albums.forEach((album) => {
      if (normalize(album).includes(normalizedFocused)) {
        let nameStr = `💿 Albüm: ${album}`;
        if (nameStr.length > 100) nameStr = nameStr.substring(0, 97) + "...";
        choices.push({ name: nameStr, value: `album:${album}` });
      }
    });

    // Sarkilar
    cache.songs.forEach((song) => {
      if (normalize(song.name).includes(normalizedFocused)) {
        let nameStr = `🎵 ${song.name} (${song.album})`;
        if (nameStr.length > 100) nameStr = nameStr.substring(0, 97) + "...";

        const valueStr = `sarki:${song.path}`;
        if (valueStr.length <= 100) {
          choices.push({ name: nameStr, value: valueStr });
        } else {
          choices.push({ name: nameStr, value: `isim:${song.name}` });
        }
      }
    });

    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    // --- Sadece ayar degistir: /sagola surekli:Aç|Kapat ---
    const toggle = interaction.options.getString("surekli");
    if (toggle) {
      const on = toggle === "ac";
      setSettings(interaction.guildId, { sagopaAutoplay: on });
      // Kapatilirsa aktif surekli modu da durdur
      if (!on && interaction.client.sagopaGuilds) {
        interaction.client.sagopaGuilds.delete(interaction.guildId);
      }
      return interaction.reply({
        embeds: [
          infoEmbed(
            on
              ? `${emojis.success} Sürekli Sagopa modu **açıldı**. \`/sagola\` (rastgele) ile başlatınca kimse durdurmadıkça çalmaya devam eder.`
              : `${emojis.info} Sürekli Sagopa modu **kapatıldı**. \`/sagola\` artık tek şarkı çalıp durur.`,
          ),
        ],
        ephemeral: true,
      });
    }

    const timer = new PerformanceTimer();
    const query = interaction.options.getString("arama") || "rastgele";
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.error} Bu komutu kullanmak için bir ses kanalında olmalısınız!`,
          ),
        ],
        ephemeral: true,
      });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.error} Ses kanalınıza katılmak ve konuşmak için izinlere ihtiyacım var!`,
          ),
        ],
        ephemeral: true,
      });
    }

    timer.mark("İzin Kontrolleri");

    await interaction.deferReply();
    timer.mark("Yanıt Erteleme");

    try {
      const musicPath = getMusicPath();

      if (!fs.existsSync(musicPath)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              `${emojis.error} Şarkıların bulunduğu klasör bulunamadı!\nBeklenen yol: \`${musicPath}\``,
            ),
          ],
        });
      }

      // Oynatmadan ONCE kuyruk durumu: zaten calan bir sey varsa yeni sarki
      // hemen calmaz, kuyruga eklenir. Mesaji buna gore ayarlariz.
      const existingQueue = interaction.client.distube.getQueue(
        interaction.guildId,
      );
      const willQueue = !!(existingQueue && existingQueue.songs.length > 0);

      // Rastgele + ayar acik => surekli mod
      const isRandom = query === "rastgele";
      const continuous = isRandom && isAutoplayEnabled(interaction.guildId);

      // Oynatma sonrasi tek noktadan yanit ver (tekrar mesajlari onler)
      const finishReply = (name, isAlbum = false) => {
        if (continuous) {
          // Surekli modu bu guild icin aktiflestir
          interaction.client.sagopaGuilds =
            interaction.client.sagopaGuilds || new Map();
          interaction.client.sagopaGuilds.set(interaction.guildId, {
            member: interaction.member,
          });
          return interaction.editReply({
            embeds: [
              infoEmbed(
                `${emojis.music} **Sürekli Sagopa modu** başladı 🎶\nKimse durdurmadıkça rastgele Sagopa çalmaya devam edecek.\n*(Kapatmak için \`/sagola surekli:Kapat\`)*`,
              ),
            ],
          });
        }
        if (willQueue) {
          // DisTube'un "Kuyruğa Eklendi"/"Çalma Listesi Eklendi" embed'i zaten
          // bilgi veriyor; komutun kendi yanitini silip tekrari onle.
          return interaction.deleteReply().catch(() => {});
        }
        return interaction.editReply({
          embeds: [
            infoEmbed(
              isAlbum
                ? `${emojis.music} **Sagopa Kajmer**\n\`${name}\` albümü çalınıyor!`
                : `${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${name}\``,
            ),
          ],
        });
      };

      // 1. Durum: Albüm seçilmiş
      if (query.startsWith("album:")) {
        const albumName = query.substring(6);
        const albumPath = path.join(musicPath, albumName);
        let albumFiles = getAllAudioFiles(albumPath);

        if (albumFiles.length === 0) {
          return interaction.editReply({
            embeds: [errorEmbed(`${emojis.error} Albüm boş!`)],
          });
        }

        albumFiles.sort();
        const songs = await Promise.all(
          albumFiles.map((filePath) =>
            createLocalSong(filePath, {
              member: interaction.member,
              metadata: { interaction },
            }),
          ),
        );

        const playlist = await interaction.client.distube.createCustomPlaylist(
          songs,
          {
            member: interaction.member,
            properties: { name: `Albüm: ${albumName}` },
          },
        );

        await interaction.client.distube.play(voiceChannel, playlist, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });

        return finishReply(albumName, true);
      }

      // 2. Durum: Belirli dosya yolu (sarki:...)
      if (query.startsWith("sarki:")) {
        const filePath = query.substring(6);
        if (fs.existsSync(filePath)) {
          const songObj = await createLocalSong(filePath, {
            member: interaction.member,
            metadata: { interaction },
          });
          await interaction.client.distube.play(voiceChannel, songObj, {
            member: interaction.member,
            textChannel: interaction.channel,
            metadata: { interaction },
          });
          return finishReply(songObj.name);
        }
      }

      // 3. Durum: Isimle (uzun yollar icin fallback)
      if (query.startsWith("isim:")) {
        const songName = query.substring(5);
        const allFiles = getAllAudioFiles(musicPath);
        const matched = allFiles.find(
          (f) => path.basename(f, path.extname(f)) === songName,
        );
        if (matched) {
          const songObj = await createLocalSong(matched, {
            member: interaction.member,
            metadata: { interaction },
          });
          await interaction.client.distube.play(voiceChannel, songObj, {
            member: interaction.member,
            textChannel: interaction.channel,
            metadata: { interaction },
          });
          return finishReply(songObj.name);
        }
      }

      // 4. Durum: Rastgele
      if (isRandom) {
        const songObj = await getRandomSagopaSong({
          member: interaction.member,
          metadata: { interaction },
        });
        if (!songObj) {
          return interaction.editReply({
            embeds: [errorEmbed(`${emojis.error} Dosya bulunamadı!`)],
          });
        }

        await interaction.client.distube.play(voiceChannel, songObj, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });

        return finishReply(songObj.name);
      }

      // 5. Durum: Düz metin arama
      const normalizedQuery = normalize(query);
      const allFiles = getAllAudioFiles(musicPath);
      const matchedSongPaths = allFiles.filter((f) =>
        normalize(path.basename(f)).includes(normalizedQuery),
      );

      if (matchedSongPaths.length > 0) {
        const songObj = await createLocalSong(matchedSongPaths[0], {
          member: interaction.member,
          metadata: { interaction },
        });
        await interaction.client.distube.play(voiceChannel, songObj, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });
        return finishReply(songObj.name);
      }

      return interaction.editReply({
        embeds: [errorEmbed(`${emojis.error} \`${query}\` bulunamadı.`)],
      });
    } catch (error) {
      console.error(error);
      const embed = errorEmbed(
        `${emojis.error} Müzik çalarken hata oluştu: ${error.message}`,
      );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
