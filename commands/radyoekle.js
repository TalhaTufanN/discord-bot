const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { errorEmbed, successEmbed } = require("../utils/embeds");
const { stations, saveStations } = require("../utils/radioStorage");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyoekle")
    .setDescription("Radyo listesine yeni bir istasyon ekler")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
        .setDescription("Emoji (örn: 📻) — boş bırakabilirsiniz")
        .setRequired(false),
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
    const emojiRaw = interaction.options.getString("emoji");
    const category = interaction.options.getString("kategori", true);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return interaction.reply({
        embeds: [errorEmbed("Lütfen geçerli bir URL girin (http/https ile başlamalı).")],
        ephemeral: true,
      });
    }

    // Emoji boş bırakılırsa veya "-" yazılırsa varsayılan 📻 kullan
    const finalEmoji = !emojiRaw || emojiRaw === "-" ? "📻" : emojiRaw;

    const newStation = {
      name,
      value: url,
      description,
      emoji: finalEmoji,
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

