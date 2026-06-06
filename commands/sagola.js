const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const fs = require("fs");
const path = require("path");
const { Song } = require("distube");
const PerformanceTimer = require("../utils/timer");

// Cache for autocomplete
let cache = {
  albums: [],
  songs: [],
  lastUpdated: 0
};

function updateCache(musicPath) {
  const now = Date.now();
  // Saniyede bir güncellemeye gerek yok, 60 saniyede bir klasörü taramak yeterli
  if (now - cache.lastUpdated < 60000) return;
  
  if (!fs.existsSync(musicPath)) return;
  
  try {
    cache.albums = fs.readdirSync(musicPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
      
    const allFiles = getAllAudioFiles(musicPath);
    cache.songs = allFiles.map(f => ({
      name: path.basename(f, path.extname(f)),
      path: f,
      album: path.basename(path.dirname(f))
    }));
    
    cache.lastUpdated = now;
  } catch (err) {
    console.error("Cache update error:", err);
  }
}

// Türkçe karakterleri ve büyük/küçük harf duyarlılığını temizleyen yardımcı fonksiyon
function normalize(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .trim();
}

// Klasördeki tüm ses dosyalarını (alt klasörler dahil) bulan yardımcı fonksiyon
function getAllAudioFiles(dirPath, arrayOfFiles) {
  try {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
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

// Yerel dosyalar için özel DisTube Song nesnesi oluşturan fonksiyon
function createLocalSong(filePath, interaction) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const song = new Song({
    id: filePath,
    name: fileName,
    url: filePath,
    source: "file",
    playFromSource: true,
  }, { member: interaction.member, metadata: { interaction } });
  
  // DisTube'un eklenti aramasını atlamak için doğrudan stream URL'ini dosya yolu olarak ayarlıyoruz
  song.stream.url = filePath;
  
  return song;
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
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const normalizedFocused = normalize(focusedValue);
    
    const musicPath = process.env.SAGOPA_PATH || path.join(__dirname, "..", "music", "Sagopa Kajmer");
    updateCache(musicPath);
    
    const choices = [];
    
    if (!normalizedFocused) {
      choices.push({ name: "🎲 Rastgele (Karışık Çal)", value: "rastgele" });
    }
    
    // Albümleri eşleştir
    cache.albums.forEach(album => {
      if (normalize(album).includes(normalizedFocused)) {
        let nameStr = `💿 Albüm: ${album}`;
        if (nameStr.length > 100) nameStr = nameStr.substring(0, 97) + "...";
        choices.push({ name: nameStr, value: `album:${album}` });
      }
    });
    
    // Şarkıları eşleştir
    cache.songs.forEach(song => {
      if (normalize(song.name).includes(normalizedFocused)) {
        let nameStr = `🎵 ${song.name} (${song.album})`;
        // Discord API 100 karakter sınırı
        if (nameStr.length > 100) nameStr = nameStr.substring(0, 97) + "...";

        // Değer (value) kısmı 100 karakteri geçemez (Discord limiti). Dosya yolu uzunsa sadece ismini verip execute'da bulalım.
        const valueStr = `sarki:${song.path}`;
        if (valueStr.length <= 100) {
            choices.push({ name: nameStr, value: valueStr });
        } else {
            choices.push({ name: nameStr, value: `isim:${song.name}` });
        }
      }
    });
    
    // En fazla 25 sonuç (Discord limiti)
    await interaction.respond(
      choices.slice(0, 25)
    );
  },

  async execute(interaction) {
    const timer = new PerformanceTimer();
    const query = interaction.options.getString("arama") || "rastgele";
    const voiceChannel = interaction.member.voice.channel;

    // Check if user is in a voice channel
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

    // Check bot permissions
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

    // Defer reply
    await interaction.deferReply();
    timer.mark("Yanıt Erteleme");

    try {
      const musicPath = process.env.SAGOPA_PATH || path.join(__dirname, "..", "music", "Sagopa Kajmer");

      if (!fs.existsSync(musicPath)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              `${emojis.error} Şarkıların bulunduğu klasör bulunamadı!\nBeklenen yol: \`${musicPath}\``
            ),
          ],
        });
      }

      // 1. Durum: Autocomplete'ten "album:..." seçilmiş
      if (query.startsWith("album:")) {
        const albumName = query.substring(6);
        const albumPath = path.join(musicPath, albumName);
        let albumFiles = getAllAudioFiles(albumPath);
        
        if (albumFiles.length === 0) {
          return interaction.editReply({ embeds: [errorEmbed(`${emojis.error} Albüm boş!`)] });
        }
        
        albumFiles.sort();
        const songs = albumFiles.map(filePath => createLocalSong(filePath, interaction));
        
        const playlist = await interaction.client.distube.createCustomPlaylist(songs, {
          member: interaction.member,
          properties: { name: `Albüm: ${albumName}` }
        });

        await interaction.client.distube.play(voiceChannel, playlist, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });

        return interaction.editReply({
          embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer**\n\`${albumName}\` albümü sıraya eklendi!`)],
        });
      }
      
      // 2. Durum: Autocomplete'ten "sarki:..." (dosya yolu) seçilmiş
      if (query.startsWith("sarki:")) {
        const filePath = query.substring(6);
        if (fs.existsSync(filePath)) {
          const songObj = createLocalSong(filePath, interaction);
          await interaction.client.distube.play(voiceChannel, songObj, {
            member: interaction.member,
            textChannel: interaction.channel,
            metadata: { interaction },
          });
          return interaction.editReply({
            embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songObj.name}\``)],
          });
        }
      }

      // 3. Durum: Autocomplete'ten "isim:..." seçilmiş (uzun dosya yolları için fallback)
      if (query.startsWith("isim:")) {
        const songName = query.substring(5);
        const allFiles = getAllAudioFiles(musicPath);
        const matched = allFiles.find(f => path.basename(f, path.extname(f)) === songName);
        if (matched) {
          const songObj = createLocalSong(matched, interaction);
          await interaction.client.distube.play(voiceChannel, songObj, {
            member: interaction.member,
            textChannel: interaction.channel,
          });
          return interaction.editReply({ embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songObj.name}\``)] });
        }
      }

      // 4. Durum: Rastgele
      if (query === "rastgele") {
        const allFiles = getAllAudioFiles(musicPath);
        if (allFiles.length === 0) {
          return interaction.editReply({ embeds: [errorEmbed(`${emojis.error} Dosya bulunamadı!`)] });
        }
        const randomIndex = Math.floor(Math.random() * allFiles.length);
        const randomSongPath = allFiles[randomIndex];
        const songObj = createLocalSong(randomSongPath, interaction);

        await interaction.client.distube.play(voiceChannel, songObj, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });
        
        return interaction.editReply({
          embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songObj.name}\``)],
        });
      }

      // 5. Durum: Normal düz metin aranmış (Autocomplete kullanılmamış)
      const normalizedQuery = normalize(query);
      const allFiles = getAllAudioFiles(musicPath);
      const matchedSongPaths = allFiles.filter(f => normalize(path.basename(f)).includes(normalizedQuery));

      if (matchedSongPaths.length > 0) {
        const matchedSong = matchedSongPaths[0];
        const songObj = createLocalSong(matchedSong, interaction);

        await interaction.client.distube.play(voiceChannel, songObj, {
          member: interaction.member,
          textChannel: interaction.channel,
          metadata: { interaction },
        });
        return interaction.editReply({
          embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songObj.name}\``)],
        });
      }

      return interaction.editReply({
        embeds: [errorEmbed(`${emojis.error} \`${query}\` bulunamadı.`)],
      });

    } catch (error) {
      console.error(error);
      const embed = errorEmbed(`${emojis.error} Müzik çalarken hata oluştu: ${error.message}`);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

