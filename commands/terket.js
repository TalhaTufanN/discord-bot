const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, infoEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('terket')
    .setDescription('Botu ses kanalından ayırır ve kuyruğu temizler.'),
  async execute(interaction) {
    const { member, guild } = interaction;
    const voiceChannel = member.voice.channel;
    const player = interaction.client.lavalink.getPlayer(guild.id);

    if (!voiceChannel) {
      return interaction.reply({ embeds: [errorEmbed('Bir ses kanalında olmalısınız!')], ephemeral: true });
    }

    if (!player || !player.voiceChannelId) {
      return interaction.reply({ embeds: [errorEmbed('Bot zaten bir ses kanalında değil!')], ephemeral: true });
    }

    if (voiceChannel.id !== player.voiceChannelId) {
      return interaction.reply({ embeds: [errorEmbed('Bot ile aynı ses kanalında olmalısınız!')], ephemeral: true });
    }

    try {
      // Bilerek ayrilma: queueEnd radyo retry / surekli Sagopa'yi tetiklemesin
      player.set("intentionalStop", true);
      await player.destroy();
      await interaction.reply({ embeds: [successEmbed('Ses kanalından ayrıldım. 👋')] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ embeds: [errorEmbed('Kanaldan ayrılırken bir hata oluştu.')], ephemeral: true });
    }
  },
};
