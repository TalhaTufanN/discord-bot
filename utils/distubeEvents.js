const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis } = require('../config/emojis');

/**
 * Handles all DisTube events
 * @param {Client} client - Discord client
 */
exports.handleDistubeEvents = (client) => {
  const distube = client.distube;
  
  // When a song starts playing
  distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor('#2B2D31') // Discord dark theme background
      .setAuthor({ 
        name: 'Şimdi Çalıyor', 
        iconURL: 'https://cdn.discordapp.com/emojis/1136657993074352168.webp?size=96&quality=lossless', // Small play icon or bot avatar
        url: 'https://discord.gg/raadiotr' 
      })
      .setDescription(`**${song.name}**\n${song.uploader.name} • ${song.formattedDuration}`)
      .addFields(
        { name: 'Süre', value: `\`${song.formattedDuration}\``, inline: true },
        { name: 'İsteyen', value: `${song.user}`, inline: true },
        { name: 'Ses', value: `\`%${queue.volume}\``, inline: true },
        { name: 'Filtre', value: `\`${queue.filters.names.join(', ') || 'Kapalı'}\``, inline: true }
      )
      .setThumbnail(song.thumbnail)
      .setFooter({ text: 'RAADIO TR • Müzik Keyfi', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();
    
    // Row 1: Playback Controls
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('music_previous')
          .setLabel('Önceki')
          .setEmoji('<:previous:1472909791197139047>')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_stop')
          .setLabel('Durdur')
          .setEmoji('<:stop:1472909749707083816>')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_pause_resume')
          .setLabel('Duraklat')
          .setEmoji('<:pause:1472909990888214621>')
          .setStyle(ButtonStyle.Secondary), // Default state is Playing, so action is Pause
        new ButtonBuilder()
          .setCustomId('music_skip')
          .setLabel('Geç')
          .setEmoji('<:next2:1472909647282311229>')
          .setStyle(ButtonStyle.Secondary)
      );

    // Row 2: Volume & Extra Controls
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_vol_down')
                .setLabel('Azalt')
                .setEmoji('<:volumedown:1472909887301226589>')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_vol_up')
                .setLabel('Artır')
                .setEmoji('<:volumeup:1472909946193707038>')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_shuffle')
                .setLabel('Karıştır')
                .setEmoji('<:shuffle:1472910038975774790>')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_loop')
                .setLabel('Döngü')
                .setEmoji('<:loop:1472910079647813643>')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('music_leave')
                .setLabel('Terket')
                .setEmoji('<:leave:1472910117984010361>')
                .setStyle(ButtonStyle.Secondary)
        );

    queue.textChannel.send({ embeds: [embed], components: [row1, row2] });
  });

  // When a song is added to the queue
  distube.on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle(`${emojis.success} Kuyruğa Eklendi`)
      .setDescription(`[${song.name}](${song.url})`)
      .addFields(
        { name: 'Süre', value: `${song.formattedDuration}`, inline: true },
        { name: 'İsteyen', value: `${song.user}`, inline: true },
        { name: 'Kuyruk sırası', value: `${queue.songs.length - 1}`, inline: true }
      )
      .setThumbnail(song.thumbnail);
    
    queue.textChannel.send({ embeds: [embed] });
  });

  // When a playlist is added to the queue
  distube.on('addList', (queue, playlist) => {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle(`${emojis.playlist} Çalma Listesi Eklendi`)
      .setDescription(`[${playlist.name}](${playlist.url})`)
      .addFields(
        { name: 'Eklenen şarkı', value: `${playlist.songs.length}`, inline: true },
        { name: 'İsteyen', value: `${playlist.user}`, inline: true }
      )
      .setThumbnail(playlist.thumbnail);
    
    queue.textChannel.send({ embeds: [embed] });
  });

  // When an error occurs
  distube.on('error', (error, queue) => {
    console.error('DisTube Error:', error);
    if (queue && queue.textChannel) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`${emojis.error} Hata`)
        .setDescription(`Bir hata oluştu: ${error.message.substring(0, 2000)}`);
      
      queue.textChannel.send({ embeds: [embed] });
    } else {
       console.error('Error not sent to channel caused by:', error);
    }
  });

  // When the queue ends
  distube.on('finish', (queue) => {
    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle(`${emojis.info} Kuyruk Bitti`)
      .setDescription('Kuyrukta başka şarkı kalmadı.');
    
    queue.textChannel.send({ embeds: [embed] });
  });

  // When the bot disconnects from a voice channel
  distube.on('disconnect', (queue) => {
    const embed = new EmbedBuilder()
      .setColor('#FF9900')
      .setTitle(`${emojis.info} Bağlantı Kesildi`)
      .setDescription('Ses kanalından ayrıldım.');
    
    queue.textChannel.send({ embeds: [embed] });
  });

  // When the queue is empty
  distube.on('empty', (queue) => {
    const embed = new EmbedBuilder()
      .setColor('#FF9900')
      .setTitle(`${emojis.warning} Kanal Boş`)
      .setDescription('Ses kanalı boş! Kanaldan ayrılıyorum...');
    
    queue.textChannel.send({ embeds: [embed] });
  });
};
