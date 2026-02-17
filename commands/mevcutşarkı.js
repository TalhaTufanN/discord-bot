const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mevcutşarkı")
    .setDescription("Şu anda çalan şarkıyı göster"),

  async execute(interaction) {
    const queue = interaction.client.distube.getQueue(interaction.guildId);

    // Check if there's a queue
    if (!queue || !queue.songs || queue.songs.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true,
      });
    }

    try {
      const song = queue.songs[0];
      const currentTime = queue.currentTime;
      const duration = song.duration;
      const progress = createProgressBar(currentTime, duration);

      const stationName = song.metadata?.stationName;

      const embed = new EmbedBuilder()
        .setColor(stationName ? "#FF0000" : "#00FF00")
        .setTitle(
          stationName
            ? `${emojis.radio || "📻"} Canlı Radyo Yayını`
            : `${emojis.play} Şu Anda Çalıyor`,
        )
        .setDescription(
          stationName
            ? `**${stationName}**\n[Yayın Linki](${song.url})`
            : `[${song.name}](${song.url})`,
        )
        .addFields(
          {
            name: "Süre",
            value: stationName
              ? `\`🔴 CANLI\``
              : `\`${formatTime(currentTime)} / ${song.formattedDuration}\``,
            inline: true,
          },
          { name: "İsteyen", value: `${song.user}`, inline: true },
          {
            name: stationName ? "Durum" : "İlerleme",
            value: stationName ? `\`▶️ Oynatılıyor\`` : progress,
          },
        )
        .setThumbnail(song.thumbnail)
        .setFooter({
          text: `Ses: ${queue.volume}% | Filtre: ${queue.filters.names.join(", ") || "Kapalı"}`,
        });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Hata oluştu: ${error.message}`)],
      });
    }
  },
};

/**
 * Create a progress bar for the song
 * @param {number} currentTime - Current time in seconds
 * @param {number} duration - Total duration in seconds
 * @returns {string} - Progress bar string
 */
function createProgressBar(currentTime, duration) {
  const progressBarLength = 15;
  const percentage = Math.round((currentTime / duration) * 100);
  const progress = Math.round((currentTime / duration) * progressBarLength);

  let progressBar = "";

  for (let i = 0; i < progressBarLength; i++) {
    if (i < progress) {
      progressBar += "▰"; // Filled part
    } else {
      progressBar += "▱"; // Empty part
    }
  }

  return `${emojis.time} \`${progressBar}\` ${percentage}%`;
}

/**
 * Format time in seconds to MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}
