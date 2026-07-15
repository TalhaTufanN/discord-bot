const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ses')
    .setDescription('Müzik ses seviyesini değiştir')
    .addIntegerOption(option =>
      option.setName('percentage')
        .setDescription('Ses yüzdesi (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;

    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Bu komutu kullanmak için bir ses kanalında olmalısınız!`)],
        ephemeral: true
      });
    }

    const player = interaction.client.lavalink.getPlayer(interaction.guildId);

    // Check if there's a queue
    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true
      });
    }

    const volumePercentage = interaction.options.getInteger('percentage');

    try {
      await player.setVolume(volumePercentage);

      // Choose appropriate emoji based on volume level
      let volumeEmoji = emojis.volume;
      if (volumePercentage === 0) {
        volumeEmoji = emojis.mute;
      } else if (volumePercentage < 50) {
        volumeEmoji = emojis.volume;
      }

      await interaction.reply({
        embeds: [successEmbed(`${volumeEmoji} Ses seviyesi ayarlandı: **${volumePercentage}%**`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Ses seviyesini değiştirirken hata oluştu: ${error.message}`)]
      });
    }
  },
};