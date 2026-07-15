/**
 * Embed utilities for the music bot
 * Made by Friday and Powered By Cortex Realm
 * Support Server: https://discord.gg/EWr3GgP6fe
 */

const { EmbedBuilder } = require('discord.js');
const { emojis } = require('../config/emojis');
const {
  trackDisplay,
  formatDuration,
  formatQueueDuration,
  getRequester,
} = require('./lavalink');

/**
 * Create a standard embed with consistent styling
 * @param {Object} options - Embed options
 * @returns {EmbedBuilder} - Configured embed
 */
exports.createEmbed = (options) => {
  const { 
    title, 
    description, 
    color = '#0099FF', 
    thumbnail = null, 
    fields = [], 
    footer = null,
    timestamp = true
  } = options;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title);
  
  if (description) embed.setDescription(description);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (fields.length > 0) embed.addFields(...fields);
  if (footer) embed.setFooter(footer);
  if (timestamp) embed.setTimestamp();
  
  return embed;
};

/**
 * Create an error embed
 * @param {string} message - Error message
 * @returns {EmbedBuilder} - Error embed
 */
exports.errorEmbed = (message) => {
  return exports.createEmbed({
    title: `${emojis.error} Hata`,
    description: message,
    color: '#FF0000'
  });
};

/**
 * Create a success embed
 * @param {string} message - Success message
 * @returns {EmbedBuilder} - Success embed
 */
exports.successEmbed = (message) => {
  return exports.createEmbed({
    title: `${emojis.success} Başarılı`,
    description: message,
    color: '#00FF00'
  });
};

/**
 * Create an info embed
 * @param {string} message - Info message
 * @returns {EmbedBuilder} - Info embed
 */
exports.infoEmbed = (message) => {
  return exports.createEmbed({
    title: `${emojis.info} Bilgi`,
    description: message,
    color: '#0099FF'
  });
};

/**
 * Create a warning embed
 * @param {string} message - Warning message
 * @returns {EmbedBuilder} - Warning embed
 */
exports.warningEmbed = (message) => {
  return exports.createEmbed({
    title: `${emojis.warning} Uyarı`,
    description: message,
    color: '#FFFF00'
  });
};

// Yardımcı fonksiyon: Yerel dosyaların bağlantılarını gizler
function formatTrackLink(track) {
  const d = trackDisplay(track);
  if (d.url && (d.url.startsWith("http://") || d.url.startsWith("https://"))) {
    return `[${d.name}](${d.url})`;
  }
  return `**${d.name}**`;
}

const REPEAT_LABEL = { queue: "Kuyruk", track: "Şarkı", off: "Kapalı" };

/**
 * Kuyruk embed'i.
 *
 * DisTube'da songs[0] CALAN sarkiydi, sirakiler songs.slice(1). Lavalink'te
 * calan sarki (queue.current) diziden AYRI, queue.tracks tamami sirada olanlar
 * — bu yuzden buradaki tum indis/uzunluk hesabi DisTube surumune gore kaydi.
 * @param {import("lavalink-client").Player} player
 */
exports.queueEmbed = (player) => {
  const current = player.queue.current;
  const upcoming = player.queue.tracks;

  let queueString = '';
  const displayed = upcoming.slice(0, 10);

  if (displayed.length === 0) {
    queueString = 'Kuyrukta şarkı yok';
  } else {
    queueString = displayed.map((track, index) =>
      `**${index + 1}.** ${formatTrackLink(track)} - \`${formatDuration(track.info.duration)}\` - İsteyen: ${getRequester(track)}`
    ).join('\n');

    if (upcoming.length > 10) {
      queueString += `\n\n*...ve ${upcoming.length - 10} daha fazla şarkı*`;
    }
  }

  const currentLine = current
    ? `${formatTrackLink(current)} - \`${trackDisplay(current).duration}\` - İsteyen: ${getRequester(current)}`
    : 'Şu anda bir şey çalmıyor';

  // Toplam sure: calan sarki + siradakiler
  const totalDuration = formatQueueDuration(current ? [current, ...upcoming] : upcoming);

  // Not: DisTube'un "Otomatik Oynatma" (queue.autoplay) ozelligi Lavalink'te
  // yok, o yuzden footer'dan kaldirildi.
  return exports.createEmbed({
    title: `${emojis.queue} Müzik Kuyruğu`,
    description: `**Şu Anda Çalıyor:**\n${currentLine}\n\n**Sırada:**\n${queueString}`,
    color: '#9B59B6',
    fields: [
      { name: 'Toplam Şarkı', value: `${upcoming.length + (current ? 1 : 0)}`, inline: true },
      { name: 'Toplam Süre', value: `${totalDuration}`, inline: true },
      { name: 'Ses', value: `${player.volume}%`, inline: true }
    ],
    footer: { text: `Döngü: ${REPEAT_LABEL[player.repeatMode] || 'Kapalı'}` }
  });
};  