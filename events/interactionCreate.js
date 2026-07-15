const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { getSettings } = require("../utils/settings");
const { emojis } = require("../config/emojis");
const { skipToRandomSagopa } = require("../utils/sagopa");
const { isRadioTrack } = require("../utils/lavalink");

// Debounce timers for volume updates per guild
const volumeUpdateTimers = new Map();

const debounceVolumeUpdate = (interaction, player) => {
  const guildId = interaction.guildId;

  // Clear previous timer
  if (volumeUpdateTimers.has(guildId)) {
    clearTimeout(volumeUpdateTimers.get(guildId));
  }

  // Set new timer - update embed after 500ms of no more presses
  volumeUpdateTimers.set(
    guildId,
    setTimeout(async () => {
      volumeUpdateTimers.delete(guildId);
      try {
        const msg = interaction.client.musicMessages?.get(guildId);
        if (msg && msg.embeds.length > 0) {
          const updatedEmbed = EmbedBuilder.from(msg.embeds[0]);
          const fields = updatedEmbed.data.fields;
          const sesField = fields?.find((f) => f.name === "Ses");
          if (sesField) sesField.value = `\`%${player.volume}\``;
          await msg.edit({ embeds: [updatedEmbed] });
        }
      } catch (e) {}
    }, 500),
  );
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Autocomplete interactions
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Error running autocomplete for ${interaction.commandName}`, error);
      }
      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      try {
        const { customId } = interaction;

        switch (customId) {
          // Ignore help command buttons (handled by collector in command file)
          case "prev":
          case "next":
            return;

          case "support":
            await interaction.reply({
              embeds: [
                infoEmbed(
                  "Bot ile ilgili yardım almak için destek sunucumuza katılın!",
                ),
              ],
              ephemeral: true,
            });
            break;

          case "invite":
            await interaction.reply({
              embeds: [
                infoEmbed(
                  "Botu sunucunuza davet etmek istediğiniz için teşekkürler!",
                ),
              ],
              ephemeral: true,
            });
            break;

          // Music Control Buttons requiring an active player
          case "music_pause_resume":
          case "music_stop":
          case "music_skip":
          case "music_previous":
          case "music_vol_down":
          case "music_vol_up":
          case "music_shuffle":
          case "music_loop": {
            const player = interaction.client.lavalink.getPlayer(
              interaction.guildId,
            );

            if (!player || !player.queue.current) {
              return interaction.reply({
                embeds: [errorEmbed("Şu anda çalan bir müzik yok!")],
                ephemeral: true,
              });
            }

            // Check if user is in the same voice channel
            const memberVoice = interaction.member.voice.channel;
            const botVoice = interaction.guild.members.me.voice.channel;

            if (!memberVoice || (botVoice && memberVoice.id !== botVoice.id)) {
              return interaction.reply({
                embeds: [errorEmbed("Bot ile aynı ses kanalında olmalısınız!")],
                ephemeral: true,
              });
            }

            switch (customId) {
              case "music_pause_resume": {
                // Buying time with deferUpdate to avoid 10062 timeouts
                try {
                  await interaction.deferUpdate();
                } catch (e) {
                  console.error("[PAUSE/RESUME] Defer failed:", e.message);
                }

                const isRadio = isRadioTrack(player.queue.current);
                console.log(
                  `[PAUSE/RESUME] Processing. Current paused: ${player.paused}, Radio: ${isRadio}`,
                );

                // Find the pause/resume button in any row
                const rows = interaction.message.components.map((row) =>
                  ActionRowBuilder.from(row.toJSON()),
                );

                let pauseButton = null;
                for (const row of rows) {
                  pauseButton = row.components.find(
                    (c) => c.data.custom_id === "music_pause_resume",
                  );
                  if (pauseButton) break;
                }

                if (!pauseButton) {
                  return interaction.followUp({
                    embeds: [errorEmbed("Kontrol butonu bulunamadı!")],
                    ephemeral: true,
                  });
                }

                if (player.paused) {
                  await player.resume();
                  pauseButton.setLabel(isRadio ? "Durdur" : "Duraklat");
                  pauseButton.setEmoji("<:pause:1472909990888214621>");
                  pauseButton.setStyle(ButtonStyle.Secondary);
                } else {
                  await player.pause();
                  pauseButton.setLabel(isRadio ? "Oynat" : "Devam Et");
                  pauseButton.setEmoji("▶️");
                  pauseButton.setStyle(ButtonStyle.Secondary);
                }

                console.log(
                  `[PAUSE/RESUME] State toggled. New label: ${pauseButton.data.label}`,
                );
                await interaction.editReply({ components: rows }).catch((e) => {
                  console.error("[PAUSE/RESUME] Update failed:", e.message);
                });
                break;
              }

              case "music_shuffle":
                await player.queue.shuffle();
                await interaction.reply({
                  embeds: [infoEmbed("Kuyruk karıştırıldı.")],
                  ephemeral: true,
                });
                break;

              case "music_loop": {
                // Lavalink'te repeat modu STRING ("off"/"track"/"queue"), DisTube'daki
                // 0/1/2 degil. Buton eskiden oldugu gibi Kuyruk <-> Kapali arasinda gecer.
                const next = player.repeatMode === "queue" ? "off" : "queue";
                await player.setRepeatMode(next);
                await interaction.reply({
                  embeds: [
                    infoEmbed(
                      `Döngü modu: ${next === "queue" ? "Kuyruk" : "Kapalı"}`,
                    ),
                  ],
                  ephemeral: true,
                });
                break;
              }

              case "music_stop":
                // Kuyruk bitisinin BILEREK oldugunu queueEnd'e bildir; aksi halde
                // radyo retry / surekli Sagopa mantigi devreye girer.
                player.set("intentionalStop", true);
                // destroy() DEGIL: DisTube'un queue.stop()'u kanaldan cikmiyordu.
                await player.stopPlaying(true, false);
                await interaction.reply({
                  embeds: [infoEmbed("Müzik durduruldu ve kuyruk temizlendi.")],
                  ephemeral: true,
                });
                break;

              case "music_previous": {
                // Discord'a ONCE cevap ver. Asagidaki skip() trackStart'i
                // tetikliyor, trackStart da "Simdi Caliyor" mesajini silip
                // yenisini atiyor — yani butonun uzerinde durdugu mesaj yok
                // oluyor. Isten SONRA deferUpdate cagirinca 40060 aliyorduk.
                try {
                  await interaction.deferUpdate();
                } catch (e) {}

                // Lavalink'te hazir bir "onceki" yok. DisTube'un previous()'i
                // iki is birden yapiyordu:
                //   previousSongs.pop()  -> gecmisten TUKET
                //   songs.unshift(song)  -> calani KAYBETMEDEN onune ekle
                // Ikisi de sart:
                //  - calani geri koymazsak kuyruktan duser
                //    (1 -> gec -> 2 -> onceki -> 1 -> gec -> 3 olur, 2 atlanir)
                //  - gecmisi tuketmezsek "onceki"ye tekrar basinca ILERI gidilir
                const prev = await player.queue.shiftPrevious();
                if (!prev) {
                  await interaction
                    .followUp({
                      embeds: [errorEmbed("Önceki şarkı bulunamadı!")],
                      ephemeral: true,
                    })
                    .catch(() => {});
                  break;
                }
                const cur = player.queue.current;
                try {
                  // Sira: [prev(calacak), cur, ...kalanlar]
                  if (cur) await player.queue.add(cur, 0);
                  await player.queue.add(prev, 0);
                  await player.skip();

                  // skip() calan parcayi previous'a itiyor (queueTrackEnd ->
                  // previous.unshift). Geriye gittigimiz icin bunu istemiyoruz;
                  // ama yalnizca gercekten o parcaysa geri al.
                  if (cur && player.queue.previous?.[0]?.encoded === cur.encoded) {
                    await player.queue.shiftPrevious();
                  }
                } catch (e) {
                  console.error("[PREVIOUS] Hata:", e?.message || e);
                  await interaction
                    .followUp({
                      embeds: [errorEmbed("Önceki şarkı çalınamadı!")],
                      ephemeral: true,
                    })
                    .catch(() => {});
                }
                break;
              }

              case "music_skip": {
                // music_previous ile ayni sebep: once cevapla, sonra calis.
                try {
                  await interaction.deferUpdate();
                } catch (e) {}

                // Sirada baska sarki yoksa ama surekli Sagopa modu aktifse
                // durdurmak yerine yeni rastgele Sagopa'ya gec.
                const endOrContinue = async () => {
                  if (await skipToRandomSagopa(player, interaction.client)) return;
                  player.set("intentionalStop", true);
                  // DisTube'un queue.stop()'u voice.stop()+remove() idi, yani
                  // muzigi durdurup kuyrugu temizliyor ama kanaldan CIKMIYORDU.
                  // destroy() cikarir; stopPlaying eski davranisin karsiligi.
                  await player.stopPlaying(true, false);
                  await interaction
                    .followUp({
                      embeds: [
                        infoEmbed(
                          "Sırada şarkı olmadığı için müzik sonlandırıldı.",
                        ),
                      ],
                      ephemeral: true,
                    })
                    .catch(() => {});
                };

                // DisTube'da queue.songs calan sarkiyi da iceriyordu (>1 kontrolu);
                // Lavalink'te queue.tracks SADECE siradakiler.
                if (player.queue.tracks.length > 0) {
                  // ONEMLI: skip()'in hatasi ile Discord'a cevap verme hatasi
                  // AYRI seyler. Eskiden ikisi ayni catch'teydi: deferUpdate
                  // patlayinca endOrContinue calisip botu kanaldan atiyordu —
                  // halbuki sarki zaten basariyla gecilmisti.
                  try {
                    await player.skip();
                  } catch (e) {
                    console.error("[SKIP] Hata:", e?.message || e);
                    await endOrContinue();
                  }
                } else {
                  await endOrContinue();
                }
                break;
              }

              case "music_vol_down": {
                const newVolDown = Math.max(0, player.volume - 10);
                await player.setVolume(newVolDown);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
                debounceVolumeUpdate(interaction, player);
                break;
              }

              case "music_vol_up": {
                const newVolUp = Math.min(100, player.volume + 10);
                await player.setVolume(newVolUp);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
                debounceVolumeUpdate(interaction, player);
                break;
              }
            }
            break;
          }

          // Leave Button logic (Does NOT require an active queue, just a voice connection)
          case "music_leave": {
            const player = interaction.client.lavalink.getPlayer(
              interaction.guildId,
            );
            const memberVoice = interaction.member.voice.channel;

            if (!player || !player.voiceChannelId) {
              return interaction.reply({
                embeds: [errorEmbed("Bot zaten bir ses kanalında değil!")],
                ephemeral: true,
              });
            }

            if (!memberVoice || memberVoice.id !== player.voiceChannelId) {
              return interaction.reply({
                embeds: [errorEmbed("Bot ile aynı ses kanalında olmalısınız!")],
                ephemeral: true,
              });
            }

            player.set("intentionalStop", true);
            await player.destroy();
            await interaction.reply({
              embeds: [infoEmbed("Kanaldan ayrıldım. 👋")],
              ephemeral: true,
            });
            break;
          }

          default:
            await interaction.reply({
              embeds: [errorEmbed("Bu buton henüz uygulanmadı.")],
              ephemeral: true,
            });
        }

        return;
      } catch (error) {
        console.error("Error handling button interaction:", error);

        const responseData = {
          embeds: [errorEmbed("Bu buton işlenirken bir hata oluştu!")],
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(responseData).catch(() => {});
        } else {
          await interaction.reply(responseData).catch(() => {});
        }
        return;
      }
    }

    // Only process command interactions
    if (!interaction.isChatInputCommand()) return;

    // Check channel restrictions
    const settings = getSettings(interaction.guildId);
    if (
      settings.allowedChannelId &&
      interaction.channelId !== settings.allowedChannelId &&
      interaction.commandName !== "kur"
    ) {
      const msg = await interaction.reply({
        embeds: [
          errorEmbed(
            `${emojis.error} Bu bot sadece <#${settings.allowedChannelId}> kanalında kullanılabilir!`,
          ),
        ],
        fetchReply: true,
      });

      // Delete message after 10 seconds
      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 10000);

      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);

      const errorMessage = "Bu komut çalıştırılırken bir hata oluştu!";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [errorEmbed(errorMessage)],
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          embeds: [errorEmbed(errorMessage)],
          ephemeral: true,
        });
      }
    }
  },
};
