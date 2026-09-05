const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const PerformanceTimer = require("../utils/timer");
const { getOrCreatePlayer } = require("../utils/lavalink");
const {
  announceAddedTrack,
  announceAddedPlaylist,
} = require("../utils/lavalinkEvents");
const {
  isSpotifyUrl,
  resolveSpotify,
  toUnresolvedTracks,
  SpotifyUnsupportedError,
} = require("../utils/spotify");
const { bridgedFromInfo, isYouTubeTrack } = require("../utils/ytbridge");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("çal")
    .setDescription("Bir şarkı veya çalma listesi çal")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Şarkı URL'si veya arama terimi")
        .setRequired(true),
    ),

  async execute(interaction) {
    const timer = new PerformanceTimer();
    const query = interaction.options.getString("query");
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

    // Defer reply since playing music might take some time
    await interaction.deferReply();
    timer.mark("Yanıt Erteleme (Defer)");

    try {
      // Player'i al/olustur ve ses kanalina bagla. Eski surumdeki
      // "distube.voices.join + distube.play" ikilisinin yerine geciyor.
      const player = await getOrCreatePlayer(interaction.client, {
        guildId: interaction.guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
      });

      // --- Spotify: metadata Spotify'dan, ses YouTube'dan ---
      // Lavalink'e Spotify URL'i vermiyoruz; kendimiz cozuyoruz (sebep:
      // utils/spotify.js basindaki not — LavaSrc'nin multi-get cagrisi
      // Spotify tarafindan 403'leniyor).
      if (isSpotifyUrl(query)) {
        let sp;
        try {
          sp = await resolveSpotify(query);
        } catch (e) {
          if (e instanceof SpotifyUnsupportedError) {
            return await interaction.editReply({
              embeds: [errorEmbed(`${emojis.error} ${e.message}`)],
            });
          }
          console.error("[Çal] Spotify çözümlenemedi:", e?.message || e);
          return await interaction.editReply({
            embeds: [
              errorEmbed(`${emojis.error} Spotify bağlantısı çözülemedi: ${e?.message || "bilinmeyen hata"}`),
            ],
          });
        }
        timer.mark("Spotify Çözümleme");

        if (!sp.items.length) {
          return await interaction.editReply({
            embeds: [errorEmbed(`${emojis.error} \`${sp.name}\` içinde çalınacak parça bulunamadı.`)],
          });
        }

        // UnresolvedTrack: YouTube aramasi sirasi gelince yapiliyor, boylece
        // 50 parcalik album aninda kuyruga giriyor.
        const tracks = toUnresolvedTracks(interaction.client, sp.items, interaction.user);
        await player.queue.add(tracks);

        const isMulti = sp.type === "album" || sp.type === "playlist";
        if (isMulti) {
          await announceAddedPlaylist(interaction.client, player, tracks, {
            name: sp.name,
            url: sp.url,
            thumbnail: sp.thumbnail,
          });
        } else {
          await announceAddedTrack(interaction.client, player, tracks[0]);
        }
        if (!player.playing) await player.play();
        timer.mark("Lavalink Play");

        // Playlist'i embed sayfasindan okuyoruz ve o ilk 100 parcada kesiyor;
        // sessizce eksik calmak yerine soyleyelim.
        const kesildi = sp.truncated
          ? `\n*(Spotify kısıtlaması nedeniyle ilk ${tracks.length} parça alındı.)*`
          : "";

        let mesaj;
        if (sp.type === "album") {
          mesaj = `${emojis.music} **${sp.name}** albümü kuyruğa eklendi (${tracks.length} parça).`;
        } else if (sp.type === "playlist") {
          mesaj = `${emojis.music} **${sp.name}** çalma listesi kuyruğa eklendi (${tracks.length} parça).${kesildi}`;
        } else {
          mesaj = `${emojis.search} Aranıyor: \`${sp.items[0].author} - ${sp.items[0].title}\``;
        }

        return await interaction.editReply({ embeds: [infoEmbed(mesaj)] });
      }

      // URL temizleme / ayri YouTube aramasi YOK: Lavalink URL'yi de arama
      // terimini de kendi cozuyor, ikinci parametre isteyen kullanici.
      const res = await player.search({ query }, interaction.user);
      timer.mark("Lavalink Arama");

      // Lavalink cozemedigi kaynagi loadType:"error" ile bildiriyor (or. Spotify
      // kimlik bilgisi eksik/yanlis). Bunu "sonuc bulunamadi" diye yutarsak
      // gercek sebep gizlenir.
      if (res?.loadType === "error") {
        console.error(
          `[Çal] Lavalink hatasi (${query}):`,
          res.exception?.message,
          res.exception?.cause || "",
        );
        return await interaction.editReply({
          embeds: [
            errorEmbed(
              `${emojis.error} Bu bağlantı çözülemedi: ${res.exception?.message || "bilinmeyen hata"}`,
            ),
          ],
        });
      }

      if (!res || !res.tracks || res.tracks.length === 0) {
        // Artik sadece YouTube degil (Spotify linkleri de LavaSrc ile geliyor)
        return await interaction.editReply({
          embeds: [
            errorEmbed(`${emojis.error} \`${query}\` için sonuç bulunamadı.`),
          ],
        });
      }

      // YouTube parcalarini kopru (yt-dlp) uzerinden calacak sekilde ceviriyoruz;
      // YouTube SABR yuzunden dogrudan calamiyor (bkz. utils/ytbridge.js).
      // Kopruleme resolve aninda olur -> playlist toplu inmez, YouTube disi
      // (soundcloud/http) parcalar aynen kalir.
      const toPlayable = (t) =>
        isYouTubeTrack(t)
          ? bridgedFromInfo(interaction.client, t.info, interaction.user)
          : t;

      // Kuyruga ekleme mesajini komut atiyor (Lavalink'te addSong olayi yok)
      if (res.loadType === "playlist") {
        const tracks = res.tracks.map(toPlayable);
        await player.queue.add(tracks);
        await announceAddedPlaylist(interaction.client, player, tracks, {
          name: res.playlist?.name,
          url: res.playlist?.uri,
          thumbnail: res.playlist?.thumbnail,
        });
      } else {
        const track = toPlayable(res.tracks[0]);
        await player.queue.add(track);
        await announceAddedTrack(interaction.client, player, track);
      }

      // Zaten caliyorsa tekrar play() cagirma; yoksa siradaki sarki atlanir
      if (!player.playing) await player.play();

      timer.mark("Lavalink Play");

      // Edit the deferred reply
      const embed = infoEmbed(`${emojis.search} Aranıyor: \`${query}\``);
      // Performans raporunu deaktif ettik, ileride gerekirse açılabilir
      // embed.setDescription(embed.data.description + timer.getReport());

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error(error);
      const embed = errorEmbed(`${emojis.error} Müzik çalarken hata oluştu: ${error.message}`);
      // Performans raporunu deaktif ettik, ileride gerekirse açılabilir
      // embed.setDescription(embed.data.description + timer.getReport());

      await interaction.editReply({
        embeds: [embed],
      });
    }
  },
};

