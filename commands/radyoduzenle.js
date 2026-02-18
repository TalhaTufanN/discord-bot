const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { errorEmbed, successEmbed } = require("../utils/embeds");
const { stations, saveStations } = require("../utils/radioStorage");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyoduzenle")
    .setDescription("Mevcut bir radyo istasyonunun bilgilerini düzenler")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("isim")
        .setDescription("Düzenlemek istediğiniz mevcut radyo adı")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("yeni_isim")
        .setDescription("Yeni radyo adı (boş bırakırsanız değişmez)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Yeni radyo URL'si (boş bırakırsanız değişmez)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("aciklama")
        .setDescription("Yeni açıklama (boş bırakırsanız değişmez)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("emoji")
        .setDescription("Yeni emoji (boş bırakırsanız değişmez)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("kategori")
        .setDescription("Yeni kategori (boş bırakırsanız değişmez)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const name = interaction.options.getString("isim", true);
    const newName = interaction.options.getString("yeni_isim");
    const url = interaction.options.getString("url");
    const description = interaction.options.getString("aciklama");
    const emoji = interaction.options.getString("emoji");
    const category = interaction.options.getString("kategori");

    const station = stations.find(
      (s) => s.name.toLowerCase() === name.toLowerCase(),
    );

    if (!station) {
      return interaction.reply({
        embeds: [errorEmbed("Belirtilen isimde bir radyo istasyonu bulunamadı.")],
        ephemeral: true,
      });
    }

    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      return interaction.reply({
        embeds: [errorEmbed("Lütfen geçerli bir URL girin (http/https ile başlamalı).")],
        ephemeral: true,
      });
    }

    if (!newName && !url && !description && !emoji && !category) {
      return interaction.reply({
        embeds: [errorEmbed("Düzenlemek için en az bir alan belirtmelisiniz.")],
        ephemeral: true,
      });
    }

    if (newName) station.name = newName;
    if (url) station.value = url;
    if (description) station.description = description;
    if (emoji) station.emoji = emoji;
    if (category) station.category = category;

    try {
      saveStations();
    } catch (e) {
      console.error("Radyo istasyonu düzenlenirken hata oluştu:", e);
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Değişiklikler bellekte uygulandı fakat dosyaya kaydedilemedi. Lütfen logları kontrol edin.",
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          `Radyo istasyonu güncellendi:\n**İsim:** ${station.name}\n**URL:** ${station.value}\n**Kategori:** ${station.category}\n**Emoji:** ${station.emoji}`,
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

