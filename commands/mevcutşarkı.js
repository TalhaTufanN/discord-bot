const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { errorEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const { formatDuration, trackDisplay, getRequester } = require("../utils/lavalink");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mevcutşarkı")
    .setDescription("Şu anda çalan şarkıyı göster"),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);

    // Check if there's a queue
    if (!player || !player.queue.current) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true,
      });
    }

    try {
      const song = player.queue.current;
      const display = trackDisplay(song);
      // Ikisi de MILISANIYE (DisTube'da saniyeydi) — createProgressBar ve
      // formatDuration ayni birimi bekliyor.
      const currentTime = player.position;
      const duration = song.info.duration;
      const progress = createProgressBar(currentTime, duration);

      const stationName = song.userData?.stationName;

      const isWebUrl = display.url && (display.url.startsWith("http://") || display.url.startsWith("https://"));
      const songDisplay = isWebUrl ? `[${display.name}](${display.url})` : `**${display.name}**`;

      const embed = new EmbedBuilder()
        .setColor(stationName ? "#FF0000" : "#00FF00")
        .setTitle(
          stationName
            ? `${emojis.radio || "📻"} Canlı Radyo Yayını`
            : `${emojis.play} Şu Anda Çalıyor`,
        )
        .setDescription(
          stationName ? `**${stationName}**` : songDisplay,
        )
        .addFields(
          {
            name: "Süre",
            value: stationName
              ? `\`🔴 CANLI\``
              : `\`${formatDuration(currentTime)} / ${formatDuration(duration)}\``,
            inline: true,
          },
          { name: "İsteyen", value: `${getRequester(song)}`, inline: true },
          {
            name: stationName ? "Durum" : "İlerleme",
            value: stationName ? `\`▶️ Oynatılıyor\`` : progress,
          },
        )
        .setThumbnail(display.thumbnail)
        .setFooter({
          // Not: Lavalink'te queue.filters.names karsiligi yok, Filtre alani kaldirildi.
          text: `Ses: ${player.volume}%`,
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
 * @param {number} currentTime - Current time in milliseconds
 * @param {number} duration - Total duration in milliseconds
 * @returns {string} - Progress bar string
 */
function createProgressBar(currentTime, duration) {
  const progressBarLength = 15;
  // Canli yayinda duration 0/anlamsiz olabiliyor -> NaN yerine bos cubuk
  const ratio =
    duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0;
  const percentage = Math.round(ratio * 100);
  const progress = Math.round(ratio * progressBarLength);

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
