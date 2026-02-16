const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const { YouTubePlugin } = require("@distube/youtube");

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

    // Defer reply since playing music might take some time
    await interaction.deferReply();

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

      let searchTerm = null;

      // If it's a Spotify link, get the song name and search YouTube
      if (isSpotify) {
        try {
          // Use Spotify oEmbed API to get track info (no API key needed)
          const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(query)}`;
          const response = await fetch(oEmbedUrl);

          if (!response.ok) {
            return await interaction.editReply({
              embeds: [
                errorEmbed(`${emojis.error} Spotify linki çözümlenemedi.`),
              ],
            });
          }

          const data = await response.json();
          // title format: "şarkı adı - sanatçı"
          searchTerm = data.title || null;

          if (!searchTerm) {
            return await interaction.editReply({
              embeds: [
                errorEmbed(
                  `${emojis.error} Spotify'dan şarkı bilgisi alınamadı.`,
                ),
              ],
            });
          }

          console.log(
            `[Spotify] "${query}" -> YouTube araması: "${searchTerm}"`,
          );
        } catch (spotifyError) {
          console.error("Spotify oEmbed error:", spotifyError);
          return await interaction.editReply({
            embeds: [
              errorEmbed(
                `${emojis.error} Spotify linki işlenirken hata oluştu: ${spotifyError.message}`,
              ),
            ],
          });
        }
      }

      // If not a URL or if it's a Spotify link, search YouTube
      if (!isUrl || isSpotify) {
        const youtubeSearchQuery = searchTerm || query;
        try {
          const searchResults = await youtubePlugin.search(youtubeSearchQuery, {
            limit: 1,
            type: "video",
          });

          if (searchResults && searchResults.length > 0) {
            playQuery = searchResults[0].url;
          } else {
            return await interaction.editReply({
              embeds: [
                errorEmbed(
                  `${emojis.error} YouTube'da "${youtubeSearchQuery}" için sonuç bulunamadı.`,
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
      }

      await interaction.client.distube.play(voiceChannel, playQuery, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { interaction },
      });

      // Edit the deferred reply
      await interaction.editReply({
        embeds: [infoEmbed(`${emojis.search} Aranıyor: \`${query}\``)],
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [
          errorEmbed(
            `${emojis.error} Müzik çalarken hata oluştu: ${error.message}`,
          ),
        ],
      });
    }
  },
};
