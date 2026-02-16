const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { infoEmbed, errorEmbed } = require("../utils/embeds");
const { setSettings } = require("../utils/settings");
const { emojis } = require("../config/emojis");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kur")
    .setDescription("Botun sadece bu kanalda çalışmasını sağlar")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.channel;
    const guildId = interaction.guildId;

    try {
      // Save the channel ID to settings
      setSettings(guildId, { allowedChannelId: channel.id });

      await interaction.reply({
        embeds: [
          infoEmbed(
            `${emojis.success} **Kurulum Başarılı!**\n\nBot artık sadece ${channel} kanalında çalışacak.\nDiğer kanallardan gelen komutlar (yöneticiler hariç) görmezden gelinecek.`,
          ),
        ],
      });
    } catch (error) {
      console.error("Error setting up bot channel:", error);
      await interaction.reply({
        embeds: [
          errorEmbed(`${emojis.error} Ayarlar kaydedilirken bir hata oluştu.`),
        ],
        ephemeral: true,
      });
    }
  },
};
