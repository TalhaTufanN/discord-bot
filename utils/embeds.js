/**
 * Embed utilities for the music bot
 * Made by Friday and Powered By Cortex Realm
 * Support Server: https://discord.gg/EWr3GgP6fe
 */

const { EmbedBuilder } = require('discord.js');
const { emojis } = require('../config/emojis');

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
function formatSongLink(song) {
  if (song.url && (song.url.startsWith("http://") || song.url.startsWith("https://"))) {
    return `[${song.name}](${song.url})`;
  }
  return `**${song.name}**`;
}

/**
 * Create a queue embed
 * @param {Queue} queue - DisTube queue
 * @returns {EmbedBuilder} - Queue embed
 */
exports.queueEmbed = (queue) => {
  const songs = queue.songs;
  const currentSong = songs[0];
  
  // Format queue songs
  let queueString = '';
  const displayedSongs = songs.slice(1, 11); // Display up to 10 songs
  
  if (displayedSongs.length === 0) {
    queueString = 'Kuyrukta şarkı yok';
  } else {
    queueString = displayedSongs.map((song, index) => 
      `**${index + 1}.** ${formatSongLink(song)} - \`${song.formattedDuration}\` - İsteyen: ${song.user}`
    ).join('\n');
    
    // Add message if there are more songs
    if (songs.length > 11) {
      queueString += `\n\n*...ve ${songs.length - 11} daha fazla şarkı*`;
    }
  }
  
  // Create embed
  return exports.createEmbed({
    title: `${emojis.queue} Müzik Kuyruğu`,
    description: `**Şu Anda Çalıyor:**\n${formatSongLink(currentSong)} - \`${currentSong.formattedDuration}\` - İsteyen: ${currentSong.user}\n\n**Sırada:**\n${queueString}`,
    color: '#9B59B6',
    fields: [
      { name: 'Toplam Şarkı', value: `${songs.length}`, inline: true },
      { name: 'Toplam Süre', value: `${queue.formattedDuration}`, inline: true },
      { name: 'Ses', value: `${queue.volume}%`, inline: true }
    ],
    footer: { text: `Döngü: ${queue.repeatMode ? (queue.repeatMode === 2 ? 'Kuyruk' : 'Şarkı') : 'Kapalı'} | Otomatik Oynatma: ${queue.autoplay ? 'Açık' : 'Kapalı'}` }
  });
};  