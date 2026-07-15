const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('durdur')
    .setDescription('Müziği durdur ve kuyruğu temizle'),

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

    try {
      // Bilerek durduruldugunu isaretle: queueEnd bunu gorup radyo retry /
      // surekli Sagopa modunu devreye sokmayacak.
      player.set("intentionalStop", true);
      await player.destroy();
      await interaction.reply({
        embeds: [successEmbed(`${emojis.stop} Müzik durduruldu ve kuyruk temizlendi!`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Müziği durdururken hata oluştu: ${error.message}`)]
      });
    }
  },
};