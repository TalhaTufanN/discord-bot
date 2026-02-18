const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { errorEmbed, successEmbed, infoEmbed } = require("../utils/embeds");
const { stations } = require("../config/radioStations");

const saveStations = () => {
  const filePath = path.join(__dirname, "..", "config", "radioStations.js");

  const content =
    "const stations = " +
    JSON.stringify(stations, null, 2) +
    ";\n\nmodule.exports = { stations };\n";

  fs.writeFileSync(filePath, content, "utf8");
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyoekle")
    .setDescription("Radyo listesine yeni bir istasyon ekler")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("isim")
        .setDescription("Radyo adı")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Radyo yayın URL'si (m3u8/mp3 vb.)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("aciklama")
        .setDescription("Kısa açıklama (örn: Türkçe Pop)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("emoji")
        .setDescription("Emoji (örn: 📻)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("kategori")
        .setDescription("Kategori (örn: Pop, Rock, Arabesk, Yabancı vb.)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const name = interaction.options.getString("isim", true);
    const url = interaction.options.getString("url", true);
    const description = interaction.options.getString("aciklama", true);
    const emoji = interaction.options.getString("emoji", true);
    const category = interaction.options.getString("kategori", true);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return interaction.reply({
        embeds: [errorEmbed("Lütfen geçerli bir URL girin (http/https ile başlamalı).")],
        ephemeral: true,
      });
    }

    const newStation = {
      name,
      value: url,
      description,
      emoji,
      category,
    };

    stations.push(newStation);
    try {
      saveStations();
    } catch (e) {
      console.error("Radyo istasyonu kaydedilirken hata oluştu:", e);

      // Bellekte dursun ama dosyaya yazılamadıysa kullanıcıyı uyar
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Radyo belleğe eklendi fakat dosyaya kaydedilemedi. Lütfen logları kontrol edin.",
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          `Yeni radyo istasyonu eklendi:\n**İsim:** ${name}\n**URL:** ${url}\n**Kategori:** ${category}\n**Emoji:** ${emoji}`,
        ),
      ],
    });
  },
};

