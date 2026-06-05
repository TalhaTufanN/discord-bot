const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const fs = require("fs");
const path = require("path");
const PerformanceTimer = require("../utils/timer");

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

// Ana dizindeki alt klasörleri (albümleri) bulur
function getDirectories(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  } catch (error) {
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sagola")
    .setDescription("Bilgisayardan/Sunucudan Sagopa Kajmer şarkıları çalar")
    .addStringOption((option) =>
      option
        .setName("arama")
        .setDescription("Rastgele için boş bırakın. Albüm veya şarkı adı yazabilirsiniz.")
        .setRequired(false),
    ),

  async execute(interaction) {
    const timer = new PerformanceTimer();
    const query = interaction.options.getString("arama");
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
      // Şarkıların bulunduğu klasör yolu (.env dosyasından alınır, yoksa varsayılan)
      const musicPath = process.env.SAGOPA_PATH || path.join(__dirname, "..", "music", "Sagopa Kajmer");

      if (!fs.existsSync(musicPath)) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              `${emojis.error} Şarkıların bulunduğu klasör bulunamadı!\nBeklenen yol: \`${musicPath}\`\nLütfen .env dosyasına \`SAGOPA_PATH\` ekleyin veya şarkıları bu yola yükleyin.`
            ),
          ],
        });
      }

      const normalizedQuery = normalize(query);

      // 1. Durum: Sorgu var ve albüm adı olarak eşleşiyor mu?
      if (normalizedQuery && normalizedQuery !== "rastgele") {
        const albums = getDirectories(musicPath);
        const matchedAlbum = albums.find(album => normalize(album).includes(normalizedQuery));

        if (matchedAlbum) {
          // Albüm bulundu! İçindeki tüm şarkıları bul ve sıraya ekle
          const albumPath = path.join(musicPath, matchedAlbum);
          let albumFiles = getAllAudioFiles(albumPath);
          
          if (albumFiles.length === 0) {
            return interaction.editReply({
              embeds: [errorEmbed(`${emojis.error} \`${matchedAlbum}\` albümünde hiç şarkı bulunamadı!`)]
            });
          }

          // Şarkıları isme göre sırala (Track number'a göre sıralanması için)
          albumFiles.sort();

          timer.mark("Albüm Bulma ve Sıralama");

          // DisTube Custom Playlist oluştur
          const playlist = await interaction.client.distube.createCustomPlaylist(albumFiles, {
            member: interaction.member,
            properties: { name: `Albüm: ${matchedAlbum}` }
          });

          await interaction.client.distube.play(voiceChannel, playlist, {
            member: interaction.member,
            textChannel: interaction.channel,
            metadata: { interaction },
          });

          timer.mark("DisTube Playlist Ekleme");

          return interaction.editReply({
            embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer**\n\`${matchedAlbum}\` albümündeki **${albumFiles.length}** şarkı sıraya eklendi!`)],
          });
        }

        // 2. Durum: Albüm eşleşmedi, şarkı adı olarak arayalım
        const allFiles = getAllAudioFiles(musicPath);
        const matchedSongPaths = allFiles.filter(f => normalize(path.basename(f)).includes(normalizedQuery));

        if (matchedSongPaths.length > 0) {
          // Şarkı bulundu! İlk eşleşeni çalalım
          const matchedSong = matchedSongPaths[0];
          const songName = path.basename(matchedSong, path.extname(matchedSong));

          timer.mark("Şarkı Bulma");

          await interaction.client.distube.play(voiceChannel, matchedSong, {
            member: interaction.member,
            textChannel: interaction.channel,
            metadata: { interaction },
          });

          timer.mark("DisTube Play");

          return interaction.editReply({
            embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songName}\``)],
          });
        }

        // 3. Durum: Ne albüm ne de şarkı bulunamadı
        return interaction.editReply({
          embeds: [errorEmbed(`${emojis.error} \`${query}\` ile eşleşen bir albüm veya şarkı bulunamadı.`)],
        });
      }

      // 4. Durum: Rastgele şarkı (Sorgu yok veya "rastgele")
      const allFiles = getAllAudioFiles(musicPath);

      if (allFiles.length === 0) {
        return interaction.editReply({
          embeds: [
            errorEmbed(
              `${emojis.error} Belirtilen klasörde hiç mp3 veya m4a dosyası bulunamadı!`
            ),
          ],
        });
      }

      const randomIndex = Math.floor(Math.random() * allFiles.length);
      const randomSongPath = allFiles[randomIndex];
      const songName = path.basename(randomSongPath, path.extname(randomSongPath));

      timer.mark("Şarkı Seçimi (Rastgele)");

      await interaction.client.distube.play(voiceChannel, randomSongPath, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { interaction },
      });
      
      timer.mark("DisTube Play");

      return interaction.editReply({
        embeds: [infoEmbed(`${emojis.music} **Sagopa Kajmer** çalınıyor:\n\`${songName}\``)],
      });

    } catch (error) {
      console.error(error);
      const embed = errorEmbed(`${emojis.error} Müzik çalarken hata oluştu: ${error.message}`);
      
      await interaction.editReply({
        embeds: [embed],
      });
    }
  },
};
