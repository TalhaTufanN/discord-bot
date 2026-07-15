const { SlashCommandBuilder } = require("@discordjs/builders");
const { successEmbed, errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("devam")
    .setDescription("Duraklatılan şarkıyı devam ettir"),

  async execute(interaction) {
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

    const player = interaction.client.lavalink.getPlayer(interaction.guildId);

    // Check if there's a queue
    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true,
      });
    }

    try {
      if (!player.paused) {
        return interaction.reply({
          embeds: [errorEmbed(`${emojis.warning} Müzik zaten çalıyor!`)],
          ephemeral: true,
        });
      }

      const song = player.queue.current;
      const isRadio = song?.userData?.stationName;

      await player.resume();

      const embed = successEmbed(`${emojis.play} Müzik devam ettirildi!`);
      if (isRadio) {
        embed.setDescription(
          `${emojis.radio || "📻"} **${isRadio}** yayınına kaldığı yerden (canlı) devam ediliyor.`,
        );
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.error} Müzik devam ettirilirken hata oluştu: ${error.message}`,
          ),
        ],
      });
    }
  },
};
