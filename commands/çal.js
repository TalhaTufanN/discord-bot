const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const { YouTubePlugin } = require("@distube/youtube");
const PerformanceTimer = require("../utils/timer");

// Create YouTube plugin instance for search
const youtubePlugin = new YouTubePlugin();

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
      // Set textChannel for DisTube events
      const queue = interaction.client.distube.getQueue(interaction.guildId);

      if (!queue) {
        interaction.client.distube.voices.join(voiceChannel);
      }

      // Check if query is a URL
      const isUrl = query.startsWith("http://") || query.startsWith("https://");
      const isSpotify =
        isUrl &&
        (query.includes("spotify.com") || query.includes("open.spotify"));
      let playQuery = query;

      // Clean YouTube Mix/Radio URLs (remove list & start_radio)
      if (
        isUrl &&
        (query.includes("youtube.com") || query.includes("youtu.be"))
      ) {
        try {
          const urlObj = new URL(query);
          const videoId = urlObj.searchParams.get("v");
          if (videoId) {
            // Remove unnecessary parameters that cause issues
            urlObj.searchParams.delete("list");
            urlObj.searchParams.delete("start_radio");
            urlObj.searchParams.delete("index");
            playQuery = urlObj.toString();
            console.log(`[YouTube] Cleaned URL: ${query} -> ${playQuery}`);
          }
        } catch (e) {
          console.error("URL cleaning error:", e);
        }
      }
      
      timer.mark("URL Temizleme");

      // If not a URL, search YouTube
      if (!isUrl) {
        try {
          const searchResults = await youtubePlugin.search(query, {
            limit: 1,
            type: "video",
          });

          if (searchResults && searchResults.length > 0) {
            playQuery = searchResults[0].url;
          } else {
            return await interaction.editReply({
              embeds: [
                errorEmbed(
                  `${emojis.error} YouTube'da "${query}" için sonuç bulunamadı.`,
                ),
              ],
            });
          }
        } catch (searchError) {
          console.error("YouTube search error:", searchError);
          return await interaction.editReply({
            embeds: [
              errorEmbed(
                `${emojis.error} Arama sırasında hata oluştu: ${searchError.message}`,
              ),
            ],
          });
        }
        timer.mark("YouTube Arama");
      }

      await interaction.client.distube.play(voiceChannel, playQuery, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { interaction },
      });
      
      timer.mark("DisTube Play");

      // Edit the deferred reply
      const embed = infoEmbed(`${emojis.search} Aranıyor: \`${query}\``);
      embed.setDescription(embed.data.description + timer.getReport());
      
      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error(error);
      const embed = errorEmbed(`${emojis.error} Müzik çalarken hata oluştu: ${error.message}`);
      embed.setDescription(embed.data.description + timer.getReport());
      
      await interaction.editReply({
        embeds: [embed],
      });
    }
  },
};

