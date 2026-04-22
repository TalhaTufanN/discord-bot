const { SlashCommandBuilder } = require("@discordjs/builders");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");

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
      let playQuery = query;

      // Clean YouTube Mix/Radio URLs (remove list & start_radio)
      // This ensures that if a user pastes a URL with a Mix attached, we play the specific song
      if (
        (query.includes("youtube.com") || query.includes("youtu.be")) &&
        (query.includes("list=") || query.includes("start_radio="))
      ) {
        try {
          const urlObj = new URL(query);
          const videoId = urlObj.searchParams.get("v");
          
          // If it's a specific video within a playlist/mix, just play that video
          if (videoId) {
            urlObj.searchParams.delete("list");
            urlObj.searchParams.delete("start_radio");
            urlObj.searchParams.delete("index");
            playQuery = urlObj.toString();
            console.log(`[YouTube] Cleaned URL for better playback: ${playQuery}`);
          }
        } catch (e) {
          // If URL parsing fails, just use original query
        }
      }

      // Special case: If it's a search term (not a URL), we can optionally tell DisTube
      // to prioritize videos over playlists if that's what the user prefers.
      // But usually, DisTube's default is good.

      await interaction.client.distube.play(voiceChannel, playQuery, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { interaction },
      });

      // Update the deferred reply
      await interaction.editReply({
        embeds: [infoEmbed(`${emojis.search} Aranıyor: \`${query}\``)],
      });
    } catch (error) {
      console.error("[Play Command Error]", error);
      
      let errorMessage = error.message;
      if (errorMessage.includes("canonicalBaseUrl")) {
        errorMessage = "YouTube bağlantı hatası. Botun bağımlılıkları güncellendi, lütfen botu yeniden başlatın.";
      }

      await interaction.editReply({
        embeds: [
          errorEmbed(
            `${emojis.error} Müzik çalarken hata oluştu: ${errorMessage}`,
          ),
        ],
      });
    }
  },
};
