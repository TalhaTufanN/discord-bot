const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { errorEmbed, successEmbed } = require("../utils/embeds");
const { stations, saveStations } = require("../utils/radioStorage");

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
    const name = interaction.options.getString("isim", true);

    const index = stations.findIndex(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    if (index === -1) {
      return interaction.reply({
        embeds: [errorEmbed("Belirtilen isimde bir radyo istasyonu bulunamadı.")],
        ephemeral: true,
      });
    }

    const [removed] = stations.splice(index, 1);

    try {
      saveStations();
    } catch (e) {
      console.error("Radyo istasyonu silinirken hata oluştu:", e);
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Radyo listeden kaldırıldı fakat dosyaya kaydedilemedi. Lütfen logları kontrol edin.",
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
    const focused = interaction.options.getFocused();
    const query = focused.toLowerCase();

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

