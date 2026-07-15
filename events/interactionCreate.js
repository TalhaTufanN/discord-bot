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

// Debounce timers for volume updates per guild
const volumeUpdateTimers = new Map();

const debounceVolumeUpdate = (interaction, queue) => {
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
          if (sesField) sesField.value = `\`%${queue.volume}\``;
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

          // Music Control Buttons
          // Music Control Buttons requiring Queue
          case "music_pause_resume":
          case "music_stop":
          case "music_skip":
          case "music_previous":
          case "music_vol_down":
          case "music_vol_up":
          case "music_shuffle":
          case "music_loop": {
            const queue = interaction.client.distube.getQueue(
              interaction.guildId,
            );

            if (!queue) {
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

                const song = queue.songs[0];
                const isRadio = song.metadata && song.metadata.stationName;
                console.log(
                  `[PAUSE/RESUME] Processing. Current paused: ${queue.paused}, Radio: ${!!isRadio}`,
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

                if (queue.paused) {
                  queue.resume();
                  pauseButton.setLabel(isRadio ? "Durdur" : "Duraklat");
                  pauseButton.setEmoji("<:pause:1472909990888214621>");
                  pauseButton.setStyle(ButtonStyle.Secondary);
                } else {
                  queue.pause();
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
                queue.shuffle();
                await interaction.reply({
                  embeds: [infoEmbed("Kuyruk karıştırıldı.")],
                  ephemeral: true,
                });
                break;

              case "music_loop":
                const mode = queue.repeatMode === 2 ? 0 : 2; // Toggle between Queue (2) and Off (0) for simplicity on button
                queue.setRepeatMode(mode);
                await interaction.reply({
                  embeds: [
                    infoEmbed(
                      `Döngü modu: ${mode === 2 ? "Kuyruk" : "Kapalı"}`,
                    ),
                  ],
                  ephemeral: true,
                });
                break;

              case "music_stop":
                queue.stop();
                await interaction.reply({
                  embeds: [infoEmbed("Müzik durduruldu ve kuyruk temizlendi.")],
                  ephemeral: true,
                });
                break;

              case "music_previous":
                try {
                  await queue.previous();
                  await interaction.deferUpdate();
                } catch (e) {
                  await interaction.reply({
                    embeds: [errorEmbed("Önceki şarkı bulunamadı!")],
                    ephemeral: true,
                  });
                }
                break;

              case "music_skip": {
                // Sirada baska sarki yoksa ama surekli Sagopa modu aktifse
                // durdurmak yerine yeni rastgele Sagopa'ya gec.
                const endOrContinue = async () => {
                  if (await skipToRandomSagopa(queue, interaction.client)) {
                    await interaction.deferUpdate();
                  } else {
                    queue.stop();
                    await interaction.reply({
                      embeds: [
                        infoEmbed(
                          "Sırada şarkı olmadığı için müzik sonlandırıldı.",
                        ),
                      ],
                      ephemeral: true,
                    });
                  }
                };

                if (queue.songs.length > 1 || queue.autoplay) {
                  try {
                    await queue.skip();
                    await interaction.deferUpdate();
                  } catch (e) {
                    await endOrContinue();
                  }
                } else {
                  await endOrContinue();
                }
                break;
              }

              case "music_vol_down":
                const newVolDown = Math.max(0, queue.volume - 10);
                queue.setVolume(newVolDown);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
                debounceVolumeUpdate(interaction, queue);
                break;

              case "music_vol_up":
                const newVolUp = Math.min(100, queue.volume + 10);
                queue.setVolume(newVolUp);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
                debounceVolumeUpdate(interaction, queue);
                break;
            }
            break;
          }

          // Leave Button logic (Does NOT require active queue, just voice connection)
          case "music_leave": {
            const distube = interaction.client.distube;
            const botVoice = distube.voices.get(interaction.guildId);
            const memberVoice = interaction.member.voice.channel;

            if (!botVoice) {
              return interaction.reply({
                embeds: [errorEmbed("Bot zaten bir ses kanalında değil!")],
                ephemeral: true,
              });
            }

            if (!memberVoice || memberVoice.id !== botVoice.channelId) {
              return interaction.reply({
                embeds: [errorEmbed("Bot ile aynı ses kanalında olmalısınız!")],
                ephemeral: true,
              });
            }

            distube.voices.leave(interaction.guildId);
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
