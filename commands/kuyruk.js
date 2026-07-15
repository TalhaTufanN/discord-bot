const { SlashCommandBuilder } = require('@discordjs/builders');
const { errorEmbed } = require('../utils/embeds');
const { queueEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kuyruk')
    .setDescription('Mevcut müzik kuyruğunu göster'),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);

    // Check if there's a queue
    // Calan sarki (current) tracks dizisinde degil, ikisine de bakmak gerekiyor
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true
      });
    }

    try {
      await interaction.reply({
        embeds: [queueEmbed(player)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Kuyruğu gösterirken hata oluştu: ${error.message}`)]
      });
    }
  },
};