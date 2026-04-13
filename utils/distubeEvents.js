const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { emojis } = require("../config/emojis");

/**
 * Handles all DisTube events
 * @param {Client} client - Discord client
 */
exports.handleDistubeEvents = (client) => {
  const distube = client.distube;

  // Initialize music messages map
  client.musicMessages = client.musicMessages || new Map();

  const updateMusicMessage = async (queue, embed, components = []) => {
    const guildId = queue.textChannel.guild.id;
    const lastMessage = client.musicMessages.get(guildId);

    // Delete the old message so the new one is always at the bottom
    if (lastMessage) {
      try {
        await lastMessage.delete();
      } catch (error) {
        // Message already deleted or invalid, ignore
      }
      client.musicMessages.delete(guildId);
    }

    // Send a new message (always at the bottom of the channel)
    try {
      const newMessage = await queue.textChannel.send({
        embeds: [embed],
        components: components,
      });
      client.musicMessages.set(guildId, newMessage);
    } catch (error) {
      console.error("Failed to send music message:", error);
    }
  };

  // When a queue is initialized, monkey-patch stop() and skip() to track intentional stops
  distube.on("initQueue", (queue) => {
    const originalStop = queue.stop.bind(queue);
    queue.stop = async () => {
      console.log(`[Queue] Manual stop triggered for ${queue.guild.id}`);
      queue._intentionalStop = true;
      return originalStop();
    };

    const originalSkip = queue.skip.bind(queue);
    queue.skip = async () => {
      console.log(`[Queue] Manual skip triggered for ${queue.guild.id}`);
      queue._intentionalStop = true;
      return originalSkip();
    };
  });

  // When a song starts playing
  distube.on("playSong", (queue, song) => {
    // Check if it's a radio station
    const isRadio =
      song.metadata && song.metadata.stationName;
    
    // Store radio info for auto-retry if it's a radio
    if (isRadio) {
      queue._lastRadio = {
        url: song.url,
        name: song.metadata.stationName,
        user: song.user,
        member: song.member,
        metadata: song.metadata,
      };
    } else {
      delete queue._lastRadio;
    }

    const songName = isRadio ? song.metadata.stationName : song.name;
    const uploader = isRadio ? "Canlı Radyo" : song.uploader.name;
    const duration = isRadio ? "🔴 Canlı Yayın" : song.formattedDuration;

    const embed = new EmbedBuilder()
      .setColor("#2B2D31") // Discord dark theme background
      .setAuthor({
        name: "Şimdi Çalıyor",
      })
      .setDescription(`**${songName}**\n${uploader}`)
      .addFields(
        { name: "Süre", value: `\`${duration}\``, inline: true },
        { name: "İsteyen", value: `${song.user}`, inline: true },
        { name: "Ses", value: `\`%${queue.volume}\``, inline: true },
        {
          name: "Filtre",
          value: `\`${queue.filters.names.join(", ") || "Kapalı"}\``,
          inline: true,
        },
      )
      .setThumbnail(song.thumbnail)
      .setFooter({
        text: "RAADIO TR • Radyo/Müzik",
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Row 1: Playback Controls
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("music_previous")
        .setLabel("Önceki")
        .setEmoji("<:previous:1472909791197139047>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_stop")
        .setLabel("Durdur")
        .setEmoji("<:stop:1472909749707083816>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_pause_resume")
        .setLabel(isRadio ? "Durdur" : "Duraklat")
        .setEmoji("<:pause:1472909990888214621>")
        .setStyle(ButtonStyle.Secondary), // Default state is Playing, so action is Pause
      new ButtonBuilder()
        .setCustomId("music_skip")
        .setLabel("Geç")
        .setEmoji("<:next2:1472909647282311229>")
        .setStyle(ButtonStyle.Secondary),
    );

    // Row 2: Volume & Extra Controls
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("music_vol_down")
        .setLabel("Azalt")
        .setEmoji("<:volumedown:1472909887301226589>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_vol_up")
        .setLabel("Artır")
        .setEmoji("<:volumeup:1472909946193707038>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setLabel("Karıştır")
        .setEmoji("<:shuffle:1472910038975774790>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_loop")
        .setLabel("Döngü")
        .setEmoji("<:loop:1472910079647813643>")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_leave")
        .setLabel("Terket")
        .setEmoji("<:leave:1472910117984010361>")
        .setStyle(ButtonStyle.Secondary),
    );

    updateMusicMessage(queue, embed, [row1, row2]);
  });

  // When a song is added to the queue
  distube.on("addSong", (queue, song) => {
    // If it's a radio station, don't show "Added to Queue" message
    if (
      song.metadata &&
      song.metadata.stationName
    ) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#0099FF")
      .setTitle(`${emojis.success} Kuyruğa Eklendi`)
      .setDescription(`[${song.name}](${song.url})`)
      .addFields(
        { name: "Süre", value: `${song.formattedDuration}`, inline: true },
        { name: "İsteyen", value: `${song.user}`, inline: true },
        {
          name: "Kuyruk sırası",
          value: `${queue.songs.length - 1}`,
          inline: true,
        },
      )
      .setThumbnail(song.thumbnail);

    // Add song message is SEPARATE from the player message, so we just send it.
    // However, if we want strict single-player, we might want to edit.
    // But usually "Added to Queue" is a log. The USER asked for "Now Playing" to be edited.
    // So we keep this as send().
    queue.textChannel.send({ embeds: [embed] });
  });

  // When a playlist is added to the queue
  distube.on("addList", (queue, playlist) => {
    const embed = new EmbedBuilder()
      .setColor("#0099FF")
      .setTitle(`${emojis.playlist} Çalma Listesi Eklendi`)
      .setDescription(`[${playlist.name}](${playlist.url})`)
      .addFields(
        {
          name: "Eklenen şarkı",
          value: `${playlist.songs.length}`,
          inline: true,
        },
        { name: "İsteyen", value: `${playlist.user}`, inline: true },
      )
      .setThumbnail(playlist.thumbnail);

    queue.textChannel.send({ embeds: [embed] });
  });

  // When an error occurs
  distube.on("error", (error, queue) => {
    console.error("DisTube Error:", error);
    if (queue && queue.textChannel) {
      // If it's a radio station error, we might want to ignore the "user-facing" error message 
      // because the retry logic in 'finish' will try to fix it.
      if (queue._lastRadio) {
        console.log(`[Radio Error] ${queue.guild.name}: Stream error detected for ${queue._lastRadio.name}. Retry logic will follow.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle(`${emojis.error} Hata`)
        .setDescription(`Bir hata oluştu: ${error.message.substring(0, 2000)}`);

      queue.textChannel.send({ embeds: [embed] });
    } else {
      console.error("Error not sent to channel caused by:", error);
    }
  });

  // When the queue ends
  distube.on("finish", async (queue) => {
    // Check if this was an intentional stop or skip
    if (queue._intentionalStop) {
      console.log(`[Queue] Finish event: Intentional stop detected for ${queue.guild.id}. Resetting flag.`);
      queue._intentionalStop = false;
      
      // If 24/7 mode is active, don't say queue finished
      if (client.radioMode) return;

      const embed = new EmbedBuilder()
        .setColor("#FFFF00")
        .setTitle(`${emojis.info} Kuyruk Bitti`)
        .setDescription("Kuyrukta başka şarkı kalmadı.");

      updateMusicMessage(queue, embed);
      return;
    }

    // If it was a radio station and ended unexpectedly (e.g. stream dropped)
    if (queue._lastRadio) {
      console.log(`[Radio Retry] ${queue.guild.name}: Connection lost to ${queue._lastRadio.name}. Retrying in 3 seconds...`);
      
      try {
        // Wait a few seconds to avoid immediate loops if the stream is totally down
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Re-check if we still have a reason to play (bot might have been kicked or channel changed)
        if (!queue.voiceChannel) return;

        await distube.play(queue.voiceChannel, queue._lastRadio.url, {
          member: queue._lastRadio.member,
          textChannel: queue.textChannel,
          metadata: queue._lastRadio.metadata,
        });

        const retryEmbed = new EmbedBuilder()
          .setColor("#00FF00")
          .setDescription(`${emojis.success} Bağlantı kesildi, **${queue._lastRadio.name}** istasyonuna tekrar bağlanılıyor...`);
        
        queue.textChannel.send({ embeds: [retryEmbed] }).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 5000);
        });

        return;
      } catch (error) {
        console.error(`[Radio Retry Failed] ${queue.guild.name}:`, error);
      }
    }

    // Default behavior for normal songs or failed retries
    if (client.radioMode) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#FFFF00")
      .setTitle(`${emojis.info} Kuyruk Bitti`)
      .setDescription("Kuyrukta başka şarkı kalmadı.");

    updateMusicMessage(queue, embed);
  });

  // When the bot disconnects from a voice channel
  distube.on("disconnect", (queue) => {
    const embed = new EmbedBuilder()
      .setColor("#FF9900")
      .setTitle(`${emojis.info} Bağlantı Kesildi`)
      .setDescription("Ses kanalından ayrıldım.");

    updateMusicMessage(queue, embed);
  });

  // When the queue is empty
  distube.on("empty", (queue) => {
    // If 24/7 mode is active, don't leave the channel
    if (client.radioMode) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#FF9900")
      .setTitle(`${emojis.warning} Kanal Boş`)
      .setDescription("Ses kanalı boş! Kanaldan ayrılıyorum...");

    updateMusicMessage(queue, embed);
  });
};
