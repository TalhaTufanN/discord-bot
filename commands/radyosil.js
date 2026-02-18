const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { errorEmbed, successEmbed } = require("../utils/embeds");
const {
  getGuildStations,
  removeGuildStationByName,
} = require("../utils/radioStorage");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyosil")
    .setDescription("Radyo listesinden bir istasyonu siler")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("isim")
        .setDescription("Silmek istediğiniz radyo istasyonunun adı")
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const name = interaction.options.getString("isim", true);

    const removed = removeGuildStationByName(guildId, name);
    if (!removed) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Belirtilen isimde bir radyo istasyonu bulunamadı veya varsayılan listede olabilir.",
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          `Radyo istasyonu silindi:\n**İsim:** ${removed.name}\n**URL:** ${removed.value}`,
        ),
      ],
    });
  },

  async autocomplete(interaction) {
    const guildId = interaction.guildId;
    const focused = interaction.options.getFocused();
    const query = focused.toLowerCase();

    const stations = getGuildStations(guildId);
    const matched = stations
      .filter((s) => !query || s.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((s) => ({
        name: s.name,
        value: s.name,
      }));

    await interaction.respond(matched);
  },
};

