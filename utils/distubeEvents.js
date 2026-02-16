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

    if (lastMessage) {
      try {
        // Try to edit the existing message
        await lastMessage.edit({ embeds: [embed], components: components });
        return; // Success
      } catch (error) {
        // Message likely deleted or invalid, remove from map
        client.musicMessages.delete(guildId);
      }
    }

    // Send new message if no existing message or edit failed
    const newMessage = await queue.textChannel.send({
      embeds: [embed],
      components: components,
    });
    client.musicMessages.set(guildId, newMessage);
  };

  // When a song starts playing
  distube.on("playSong", (queue, song) => {
    // Check if it's a radio station
    const isRadio =
      song.metadata && song.metadata.interaction && song.metadata.stationName;
    const songName = isRadio ? song.metadata.stationName : song.name;
    const uploader = isRadio ? "Canlı Radyo" : song.uploader.name;
    const duration = isRadio ? "🔴 Canlı Yayın" : song.formattedDuration;

    const embed = new EmbedBuilder()
      .setColor("#2B2D31") // Discord dark theme background
      .setAuthor({
        name: "Şimdi Çalıyor",
        iconURL:
          "https://cdn.discordapp.com/emojis/1136657993074352168.webp?size=96&quality=lossless", // Small play icon or bot avatar
        url: "https://discord.gg/fKgRz26k3p",
      })
      .setDescription(`**${songName}**\n${uploader} • ${duration}`)
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
        .setLabel("Duraklat")
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
      song.metadata.interaction &&
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
  distube.on("finish", (queue) => {
    // If 24/7 mode is active, don't say queue finished, just stay connected
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
