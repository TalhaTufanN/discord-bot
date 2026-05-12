const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { errorEmbed, successEmbed } = require("../utils/embeds");
const { addGuildStation } = require("../utils/radioStorage");
const { searchStations, getStationById } = require("../utils/stationsSearch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyoekle")
    .setDescription("Radyo listesine yeni bir istasyon ekler")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // SUBCOMMAND: LISTE (From massive stations.js)
    .addSubcommand(subcommand =>
      subcommand
        .setName("liste")
        .setDescription("Hazır radyo listesinden seçim yaparak ekleyin")
        .addStringOption(option =>
          option.setName("radyo")
            .setDescription("Eklenecek radyo adı")
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    // SUBCOMMAND: MANUEL (Custom URL)
    .addSubcommand(subcommand =>
      subcommand
        .setName("manuel")
        .setDescription("Kendi radyo isminizi ve URL'inizi girerek ekleyin")
        .addStringOption(option => option.setName("isim").setDescription("Radyo adı").setRequired(true))
        .addStringOption(option => option.setName("url").setDescription("Yayın URL'si").setRequired(true))
        .addStringOption(option => option.setName("aciklama").setDescription("Kısa açıklama").setRequired(true))
        .addStringOption(option => option.setName("kategori").setDescription("Kategori").setRequired(true))
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const results = searchStations(focusedValue);
    await interaction.respond(
      results.map(s => ({ name: s.name, value: s.id }))
    );
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    let newStation = null;

    if (subcommand === "liste") {
      const stationId = interaction.options.getString("radyo");
      const station = getStationById(stationId);

      if (!station) {
        return interaction.reply({ embeds: [errorEmbed("Seçilen radyo bulunamadı!")], ephemeral: true });
      }

      newStation = {
        name: station.name,
        value: station.url,
        description: station.tags || "Radyo İstasyonu",
        emoji: "📡",
        category: "Eklenenler"
      };
    } else {
      const name = interaction.options.getString("isim", true);
      const url = interaction.options.getString("url", true);
      const description = interaction.options.getString("aciklama", true);
      const category = interaction.options.getString("kategori", true);

      if (!url.startsWith("http")) {
        return interaction.reply({ embeds: [errorEmbed("Geçerli bir URL girin!")], ephemeral: true });
      }

      newStation = { name, value: url, description, emoji: "📻", category };
    }

    try {
      addGuildStation(guildId, newStation);
      await interaction.reply({
        embeds: [successEmbed(`**${newStation.name}** başarıyla radyo listenize eklendi! artık /radyo menüsünde görebilirsiniz.`) ]
      });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed("Kaydedilirken bir hata oluştu.")], ephemeral: true });
    }
  },
};

