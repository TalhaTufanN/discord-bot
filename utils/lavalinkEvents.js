// Lavalink olaylari — eski utils/distubeEvents.js'in yerine.
//
// DisTube'dan bicimsel farklar (sessiz hata kaynagi olduklari icin yazili):
//  - queue.textChannel (nesne) YOK -> player.textChannelId (id) var, kanali
//    client.channels'tan cozuyoruz.
//  - queue._lastRadio gibi ozel alanlar YOK -> player.set()/get() kullaniyoruz.
//  - "addSong" olayi YOK -> kuyruga ekleme mesajini komutlar announceAdded* ile
//    kendisi atiyor (Lavalink'te kuyruga eklemeyi biz yapiyoruz).
//  - "empty" (kanal bosaldi) olayi YOK -> voiceStateUpdate ile kendimiz bakiyoruz.
//  - sure MILISANIYE (DisTube saniyeydi) -> trackDisplay/formatDuration halleder.
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require("discord.js");
const { emojis } = require("../config/emojis");
const { getStationMetadata } = require("./radioMetadata");
const { getRandomSagopaTrack, resolveLocalTrack } = require("./sagopa");
const { trackDisplay, formatDuration, isRadioTrack, isSagopaAutoTrack, isLocalTrack, getRequester } = require("./lavalink");

// Guild basina radyo metadata guncelleme araligi
const radioUpdateIntervals = new Map();

// Guild basina son hata mesaji zamani — hata seli olunca kanali bogmamak icin
const errorNotifiedAt = new Map();

const clearRadioInterval = (guildId) => {
  if (radioUpdateIntervals.has(guildId)) {
    clearInterval(radioUpdateIntervals.get(guildId));
    radioUpdateIntervals.delete(guildId);
  }
};

/** player.textChannelId -> gercek kanal nesnesi */
const getTextChannel = (client, player) => {
  if (!player?.textChannelId) return null;
  return client.channels.cache.get(player.textChannelId) || null;
};

/**
 * "Simdi caliyor" mesajini gunceller: eskisini silip yenisini atiyor ki
 * mesaj her zaman kanalin en altinda kalsin (DisTube surumundeki davranis).
 */
const updateMusicMessage = async (client, player, embed, components = []) => {
  const guildId = player.guildId;
  const channel = getTextChannel(client, player);
  const lastMessage = client.musicMessages.get(guildId);

  if (lastMessage) {
    try {
      await lastMessage.delete();
    } catch (error) {
      // Zaten silinmis olabilir
    }
    client.musicMessages.delete(guildId);
  }

  if (!channel) return;
  try {
    const newMessage = await channel.send({ embeds: [embed], components });
    client.musicMessages.set(guildId, newMessage);
  } catch (error) {
    console.error("Failed to send music message:", error);
  }
};

/**
 * Kuyruga eklendiginde hemen calmaya baslayacak mi? (yani su an bos mu)
 * announceAdded* play()'den ONCE cagrildigi icin ilk sarki henuz tracks[] icinde
 * duruyor; "caliyor mu" sorusunun dogru olcusu current/playing.
 */
const willPlayImmediately = (player) => !player.playing && !player.queue.current;

/** Kuyruga eklendi mesaji — DisTube'un addSong olayinin yerine, komutlar cagirir */
const announceAddedTrack = async (client, player, track) => {
  // Radyo ve surekli-mod otomatik sarkilari icin mesaj atma (spam)
  if (isRadioTrack(track) || isSagopaAutoTrack(track)) return;

  // Hemen calacaksa "Kuyruga Eklendi" demek yaniltici ve gereksiz — hemen
  // ardindan zaten "Simdi Caliyor" gelecek.
  // NOT: Bu, DisTube surumunden BILINCLI bir davranis farki. DisTube
  // emitAddSongWhenCreatingQueue:true varsayilaniyla ilk sarkiya da "Kuyruga
  // Eklendi" atiyordu, yani bos kuyrukta iki (sagola'da uc) mesaj cikiyordu.
  if (willPlayImmediately(player)) return;

  const channel = getTextChannel(client, player);
  if (!channel) return;

  const d = trackDisplay(track);
  const desc = isLocalTrack(track) ? `**${d.name}**` : `[${d.name}](${d.url})`;

  // Kuyruk sirasi: DisTube "queue.songs.length - 1" yazardi, yani hemen calacak
  // ilk sarki icin 0. Bu fonksiyon play()'den ONCE cagriliyor, dolayisiyla ilk
  // sarki henuz tracks[] icinde duruyor ve duz tracks.length 1 gosterirdi.
  // Hicbir sey calmiyorsa bu sarki siraya girmiyor, hemen calacak -> 0.
  const position =
    player.playing || player.queue.current ? player.queue.tracks.length : 0;

  const embed = new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle(`${emojis.success} Kuyruğa Eklendi`)
    .setDescription(desc)
    .addFields(
      { name: "Süre", value: `${d.duration}`, inline: true },
      { name: "İsteyen", value: `${getRequester(track)}`, inline: true },
      { name: "Kuyruk sırası", value: `${position}`, inline: true },
    );
  if (d.thumbnail) embed.setThumbnail(d.thumbnail);

  await channel.send({ embeds: [embed] }).catch(() => {});
};

/** Calma listesi eklendi mesaji — DisTube'un addList olayinin yerine */
const announceAddedPlaylist = async (client, player, tracks, { name, url, thumbnail } = {}) => {
  // Tek parcali bir liste hemen calacaksa announceAddedTrack ile ayni sebeple
  // sessiz kal; cok parcali listede "N sarki eklendi" bilgisi hala degerli.
  if (willPlayImmediately(player) && tracks.length <= 1) return;

  const channel = getTextChannel(client, player);
  if (!channel) return;

  const listName = name || "Albüm";
  const isLocal = !url || url.startsWith("file:") || url.startsWith("/");
  const desc = isLocal ? `**${listName}**` : `[${listName}](${url})`;

  const embed = new EmbedBuilder()
    .setColor("#2B2D31")
    .setTitle("Çalma Listesi Eklendi")
    .setDescription(desc)
    .addFields(
      { name: "Eklenen şarkı", value: `${tracks.length}`, inline: true },
      { name: "İsteyen", value: `${getRequester(tracks[0])}`, inline: true },
    );
  if (thumbnail) embed.setThumbnail(thumbnail);

  await channel.send({ embeds: [embed] }).catch(() => {});
};

/**
 * Tum Lavalink olaylarini baglar
 * @param {import("discord.js").Client} client
 */
exports.handleLavalinkEvents = (client) => {
  const lavalink = client.lavalink;

  client.musicMessages = client.musicMessages || new Map();
  // Surekli Sagopa modu aktif olan guild'ler (guildId -> { requester, member })
  client.sagopaGuilds = client.sagopaGuilds || new Map();

  // --- Sarki calmaya basladi (eski: playSong) ---
  lavalink.on("trackStart", async (player, track) => {
    player.set("radioRetryCount", 0);
    clearRadioInterval(player.guildId);

    const isRadio = isRadioTrack(track);

    // Radyo bilgisini auto-retry icin sakla (eski: queue._lastRadio)
    if (isRadio) {
      player.set("lastRadio", {
        uri: track.info.uri,
        name: track.userData.stationName,
        requester: getRequester(track),
        userData: track.userData,
      });
    } else {
      player.set("lastRadio", null);
    }

    let lastArtist = "";
    let lastSong = "";
    let currentSongInfo = "";

    if (isRadio) {
      const meta = await getStationMetadata(track.userData.stationName);
      if (meta && meta.song) {
        lastArtist = meta.artist;
        lastSong = meta.song;
        currentSongInfo = `\n\n🎵 **Şu An Çalıyor:**\n> ${meta.artist} - ${meta.song}`;
      }
    }

    const d = trackDisplay(track);

    const createEmbed = (extraInfo = currentSongInfo) =>
      new EmbedBuilder()
        .setColor("#2B2D31")
        .setAuthor({ name: "Şimdi Çalıyor" })
        .setDescription(`**${d.name}**\n${d.uploader}${extraInfo}`)
        .addFields(
          { name: "Süre", value: `\`${d.duration}\``, inline: true },
          { name: "İsteyen", value: `${getRequester(track)}`, inline: true },
          { name: "Ses", value: `\`%${player.volume}\``, inline: true },
        )
        .setThumbnail(d.thumbnail)
        .setFooter({
          text: "RAADIO TR • Radyo/Müzik",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();

    // Row 1: oynatma kontrolleri
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
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_skip")
        .setLabel("Geç")
        .setEmoji("<:next2:1472909647282311229>")
        .setStyle(ButtonStyle.Secondary),
    );

    // Row 2: ses & ekstra kontroller
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

    await updateMusicMessage(client, player, createEmbed(), [row1, row2]);

    // Radyo metadata otomatik guncelleyici (5 sn)
    if (isRadio) {
      const interval = setInterval(async () => {
        const newMeta = await getStationMetadata(track.userData.stationName);
        if (newMeta && (newMeta.artist !== lastArtist || newMeta.song !== lastSong)) {
          lastArtist = newMeta.artist;
          lastSong = newMeta.song;
          const updatedInfo = `\n\n🎵 **Şu An Çalıyor:**\n> ${newMeta.artist} - ${newMeta.song}`;
          const currentMsg = client.musicMessages.get(player.guildId);
          if (currentMsg) {
            await currentMsg
              .edit({ embeds: [createEmbed(updatedInfo)] })
              .catch(() => clearRadioInterval(player.guildId));
          }
        }
      }, 5000);
      radioUpdateIntervals.set(player.guildId, interval);
    }
  });

  // --- Hata (eski: distube.on("error")) ---
  // Ucuncu argumanin sekli SABIT DEGIL: Lavalink olayindan gelirse
  // { exception: { message } }, resolve hatasindan gelirse duz bir Error
  // (dist/index.cjs:1185, :5704). Ikisini de okumazsak elimizde sadece
  // "trackError" kaliyor ve gercek sebep gizleniyor.
  const problemDetail = (payload, label) =>
    payload?.exception?.message ||
    payload?.message ||
    payload?.error?.message ||
    payload?.error ||
    label;

  const onTrackProblem = (label) => async (player, track, payload) => {
    const detail = problemDetail(payload, label);
    const name = track?.info?.title ? `"${track.info.title}"` : "(bilinmeyen parça)";
    console.error(`[Lavalink ${label}] ${name}:`, detail);

    // Radyo hatasiysa kullaniciya gosterme; asagidaki retry mantigi toparlayacak
    if (player.get("lastRadio")) {
      console.log(`[Radio Error] ${player.guildId}: ${detail}. Retry mantigi devreye girecek.`);
      return;
    }

    const channel = getTextChannel(client, player);
    if (!channel) return;

    // Bir albumun her parcasi patlarsa 50 ayri hata mesaji atmayalim: guild
    // basina 10 sn'de en fazla bir mesaj, gerisi sadece log.
    const now = Date.now();
    const lastAt = errorNotifiedAt.get(player.guildId) || 0;
    if (now - lastAt < 10000) return;
    errorNotifiedAt.set(player.guildId, now);

    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle(`${emojis.error} Hata`)
            .setDescription(`${name} çalınamadı: ${String(detail).substring(0, 1500)}`),
        ],
      })
      .catch(() => {});
  };
  lavalink.on("trackError", onTrackProblem("trackError"));
  lavalink.on("trackStuck", onTrackProblem("trackStuck"));

  // --- Kuyruk bitti (eski: distube.on("finish")) ---
  lavalink.on("queueEnd", async (player) => {
    clearRadioInterval(player.guildId);

    const finishedEmbed = () =>
      new EmbedBuilder()
        .setColor("#FFFF00")
        .setTitle(`${emojis.info} Kuyruk Bitti`)
        .setDescription("Kuyrukta başka şarkı kalmadı.");

    // Kullanici bilerek durdurduysa
    if (player.get("intentionalStop")) {
      player.set("intentionalStop", false);
      client.sagopaGuilds.delete(player.guildId);
      await updateMusicMessage(client, player, finishedEmbed());
      return;
    }

    // Radyo beklenmedik sekilde koptuysa: 5 denemeye kadar tekrar bagla
    const lastRadio = player.get("lastRadio");
    if (lastRadio) {
      const count = (player.get("radioRetryCount") || 0) + 1;
      player.set("radioRetryCount", count);
      const channel = getTextChannel(client, player);

      if (count <= 5) {
        console.log(
          `[Radio Retry #${count}] ${player.guildId}: ${lastRadio.name} baglantisi koptu. 3 sn sonra tekrar denenecek...`,
        );
        try {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          if (!player.voiceChannelId) return;

          const res = await player.search({ query: lastRadio.uri }, lastRadio.requester);
          const track = res?.tracks?.[0];
          if (track) {
            track.userData = { ...(track.userData || {}), ...lastRadio.userData };
            await player.queue.add(track);
            if (!player.playing) await player.play();

            channel
              ?.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#00FF00")
                    .setDescription(
                      `${emojis.success} Bağlantı kesildi, **${lastRadio.name}** istasyonuna tekrar bağlanılıyor... (Deneme ${count}/5)`,
                    ),
                ],
              })
              .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 5000))
              .catch(() => {});
            return;
          }
        } catch (error) {
          console.error(`[Radio Retry Failed] ${player.guildId}:`, error?.message || error);
        }
      } else {
        console.log(`[Radio Retry Aborted] ${player.guildId}: ${lastRadio.name} icin deneme hakki bitti.`);
        channel
          ?.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#FF0000")
                .setDescription(
                  `❌ **${lastRadio.name}** istasyonuna 5 kez bağlanılamadı. Yayın şu an çevrimdışı olabilir.`,
                ),
            ],
          })
          .catch(() => {});
        player.set("lastRadio", null);
        player.set("radioRetryCount", 0);
      }
    }

    // Surekli Sagopa modu: kuyruk dogal olarak bittiyse yeni rastgele sarki ekle
    if (client.sagopaGuilds.has(player.guildId)) {
      const ctx = client.sagopaGuilds.get(player.guildId);
      try {
        if (!player.voiceChannelId) {
          client.sagopaGuilds.delete(player.guildId);
        } else {
          const nextTrack = await getRandomSagopaTrack(player, ctx.requester, {
            sagopaAuto: true,
          });
          if (nextTrack) {
            await player.queue.add(nextTrack);
            if (!player.playing) await player.play();
            return;
          }
          client.sagopaGuilds.delete(player.guildId);
        }
      } catch (err) {
        console.error(`[Sagopa Autoplay] ${player.guildId}: ${err.message}`);
        client.sagopaGuilds.delete(player.guildId);
      }
    }

    await updateMusicMessage(client, player, finishedEmbed());
  });

  // --- Ses kanalindan koptu (eski: distube.on("disconnect")) ---
  lavalink.on("playerDisconnect", async (player) => {
    clearRadioInterval(player.guildId);
    client.sagopaGuilds.delete(player.guildId);
    await updateMusicMessage(
      client,
      player,
      new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`${emojis.info} Bağlantı Kesildi`)
        .setDescription("Ses kanalından ayrıldım."),
    );
  });

  lavalink.on("playerDestroy", (player) => {
    clearRadioInterval(player.guildId);
    client.sagopaGuilds.delete(player.guildId);
  });

  // --- Kanal bosaldi (eski: distube.on("empty")) ---
  // Lavalink'te boyle bir olay yok; ses durumundan kendimiz cikariyoruz.
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const guildId = oldState.guild?.id || newState.guild?.id;
    if (!guildId) return;
    const player = lavalink.getPlayer(guildId);
    if (!player?.voiceChannelId) return;

    // Sadece bot'un bulundugu kanalla ilgileniyoruz
    const channelId = player.voiceChannelId;
    if (oldState.channelId !== channelId && newState.channelId !== channelId) return;

    const channel = oldState.guild.channels.cache.get(channelId);
    if (!channel) return;

    const humans = channel.members.filter((m) => !m.user.bot).size;
    if (humans > 0) return;

    client.sagopaGuilds.delete(guildId);
    clearRadioInterval(guildId);

    await updateMusicMessage(
      client,
      player,
      new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`${emojis.warning} Kanal Boş`)
        .setDescription("Ses kanalı boş! Kanaldan ayrılıyorum..."),
    );
    await player.destroy().catch(() => {});
  });
};

exports.updateMusicMessage = updateMusicMessage;
exports.announceAddedTrack = announceAddedTrack;
exports.announceAddedPlaylist = announceAddedPlaylist;
