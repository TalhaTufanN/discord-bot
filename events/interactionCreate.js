const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { errorEmbed, infoEmbed } = require("../utils/embeds");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
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
              case "music_pause_resume":
                // Get the current rows from the message
                const rows = interaction.message.components.map((row) =>
                  ActionRowBuilder.from(row),
                );
                const buttonRow = rows[0];
                const pauseButton = buttonRow.components.find(
                  (c) => c.data.custom_id === "music_pause_resume",
                );

                if (queue.paused) {
                  queue.resume();
                  // Update button to "Duraklat" state (Music is playing)
                  pauseButton.setLabel("Duraklat");
                  pauseButton.setEmoji("<:pause:1472909990888214621>");
                  pauseButton.setStyle(ButtonStyle.Secondary);
                } else {
                  queue.pause();
                  // Update button to "Oynat" state (Music is paused)
                  pauseButton.setLabel("Oynat");
                  pauseButton.setEmoji("<:play:1472914201117982847>");
                  pauseButton.setStyle(ButtonStyle.Secondary); // Blue when paused/active state
                }

                await interaction.update({ components: rows });
                break;

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

              case "music_skip":
                if (queue.songs.length > 1 || queue.autoplay) {
                  try {
                    await queue.skip();
                    await interaction.deferUpdate();
                  } catch (e) {
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
                break;

              case "music_vol_down":
                const newVolDown = Math.max(0, queue.volume - 10);
                queue.setVolume(newVolDown);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
                break;

              case "music_vol_up":
                const newVolUp = Math.min(100, queue.volume + 10);
                queue.setVolume(newVolUp);
                try {
                  await interaction.deferUpdate();
                } catch (e) {}
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
        await interaction.reply({
          embeds: [errorEmbed("Bu buton işlenirken bir hata oluştu!")],
          ephemeral: true,
        });
        return;
      }
    }

    // Only process command interactions
    if (!interaction.isChatInputCommand()) return;

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
