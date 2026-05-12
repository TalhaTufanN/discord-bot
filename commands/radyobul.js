const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed, infoEmbed } = require("../utils/embeds");
const { searchStations, getStationById } = require("../utils/stationsSearch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyobul")
    .setDescription("Binlerce radyo arasından arama yapın ve çalın")
    .addStringOption(option =>
      option.setName("radyo")
        .setDescription("Çalmak istediğiniz radyo adı")
        .setAutocomplete(true)
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const results = searchStations(focusedValue);
    
    await interaction.respond(
      results.map(s => ({ name: `${s.name} (${s.state || 'TR'})`, value: s.id }))
    );
  },

  async execute(interaction) {
    const stationId = interaction.options.getString("radyo");
    const station = getStationById(stationId);

    if (!station) {
      return interaction.reply({
        embeds: [errorEmbed("Seçilen radyo bulunamadı!")],
        ephemeral: true
      });
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed("Bir ses kanalında olmalısınız!")],
        ephemeral: true
      });
    }

    await interaction.reply({
      embeds: [infoEmbed(`📡 **${station.name}** bağlanılıyor...`)]
    });

    try {
      // Get the current queue
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      
      // If something is playing, stop it first to switch immediately
      if (queue) {
        await queue.stop();
      }

      await interaction.client.distube.play(voiceChannel, station.url, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: {
          interaction: interaction,
          stationName: station.name
        }
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed(`Bağlantı hatası: ${error.message}`)]
      });
    }
  }
};
