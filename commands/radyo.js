const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { errorEmbed, infoEmbed, successEmbed } = require("../utils/embeds");
const { emojis } = require("../config/emojis");
const { getAllStationsForGuild } = require("../utils/radioStorage");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyo")
    .setDescription("Popüler Türk radyo istasyonlarını listeler ve oynatır"),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    const guildId = interaction.guildId;

    const stations = getAllStationsForGuild(guildId);

    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [
          errorEmbed("Bu komutu kullanmak için bir ses kanalında olmalısınız!"),
        ],
        ephemeral: true,
      });
    }

    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            "Ses kanalınıza katılmak ve konuşmak için izinlere ihtiyacım var!",
          ),
        ],
        ephemeral: true,
      });
    }

    // Helper to generate components
    const generateComponents = (is247 = false) => {
      const rows = [];

      // 1. Select Menu (All Stations)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("radio_station_select")
        .setPlaceholder("Bir radyo istasyonu seçin...")
        .addOptions(
          ...stations.map((station, index) => {
            const option = new StringSelectMenuOptionBuilder()
              .setLabel(station.name)
              .setValue(index.toString()) // Use INDEX as value
              .setDescription(station.description);

            // Emoji geçerli görünüyorsa ekle (sade metinler hariç)
            if (station.emoji && !/^[\w-]+$/.test(station.emoji)) {
              option.setEmoji(station.emoji);
            }

            return option;
          }),
          new StringSelectMenuOptionBuilder()
            .setLabel("Menüyü Kapat")
            .setValue("close_menu")
            .setDescription("Radyo seçim menüsünü kapatır")
            .setEmoji("❌"),
        );

      rows.push(new ActionRowBuilder().addComponents(selectMenu));
      return rows;
    };

    // Initial state
    let is247Active = interaction.client.radioMode === true; // Check global state

    // Eski radyo menüsünü (varsa) pasifleştir
    if (!interaction.client.radioPanels) {
      interaction.client.radioPanels = new Map();
    }

    const previousPanel = interaction.client.radioPanels.get(guildId);
    if (previousPanel) {
      // Metni/embedi bırak, sadece etkileşimi kapat
      previousPanel
        .edit({ components: [] })
        .catch(() => previousPanel.delete().catch(() => {}));
    }

    // Initial Reply
    const response = await interaction.reply({
      embeds: [infoEmbed("Dinlemek istediğiniz radyo istasyonunu seçin.")],
      components: generateComponents(is247Active),
    });

    // Bu sunucu için son radyo panel mesajını kaydet
    interaction.client.radioPanels.set(guildId, response);

    const collector = response.createMessageComponentCollector({
      time: 300000,
    }); // 5 minutes

    collector.on("collect", async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "Bu menüyü sadece komutu kullanan kişi kullanabilir.",
            ephemeral: true,
          });
        }

        // Defer update immediately to prevent "Unknown interaction" errors
        await i.deferUpdate();

        // Handle 24/7 Toggle
        if (i.customId === "radio_247") {
          is247Active = !is247Active;
          i.client.radioMode = is247Active;
          await i.editReply({
            components: generateComponents(is247Active),
          });
          return;
        }

        // Handle Stop
        if (i.customId === "radio_stop") {
          const queue = i.client.distube.getQueue(i.guildId);
          if (queue) {
            await queue.stop();
            await i.followUp({ content: "Radyo durduruldu.", ephemeral: true });
          } else {
            await i.followUp({
              content: "Şu anda zaten bir şey çalmıyor.",
              ephemeral: true,
            });
          }
          return;
        }

        // Handle Station Selection
        if (i.customId === "radio_station_select") {
          const selectedValue = i.values[0];

          if (selectedValue === "close_menu") {
            await i
              .editReply({
                content: "Radyo menüsü kapatıldı.",
                components: [],
              })
              .catch(() => {});

            if (i.client.radioPanels) {
              i.client.radioPanels.delete(i.guildId);
            }

            return;
          }

          const selectedIndex = parseInt(selectedValue);
          const selectedStation = stations[selectedIndex];

          if (!selectedStation) {
            return i.followUp({
              content: "Seçilen radyo istasyonu bulunamadı.",
              ephemeral: true,
            });
          }
          const selectedUrl = selectedStation.value;

          try {
            const queue = i.client.distube.getQueue(i.guildId);

            // If a queue already exists, just play with skip: true to switch seamlessly
            if (queue) {
              await i.client.distube.play(voiceChannel, selectedUrl, {
                member: i.member,
                textChannel: i.channel,
                skip: true,
                metadata: {
                  interaction: i,
                  stationName: selectedStation.name,
                },
              });
            } else {
              // No queue, first time joining
              await i.client.distube.play(voiceChannel, selectedUrl, {
                member: i.member,
                textChannel: i.channel,
                metadata: {
                  interaction: i,
                  stationName: selectedStation.name,
                },
              });
            }

            // No editReply needed for play success, handled by distubeEvents
          } catch (error) {
            console.error(error);
            await i.followUp({
              embeds: [errorEmbed("Radyo oynatılırken bir hata oluştu.")],
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        console.error("Collector Error:", error);
        try {
          if (!i.replied && !i.deferred) {
            await i.reply({ content: "Bir hata oluştu.", ephemeral: true });
          }
        } catch (e) {
          /* ignore */
        }
      }
    });

    collector.on("end", async (collected, reason) => {
      // Süre dolunca sadece butonları/menüyü kaldır, metni bırak
      if (reason === "time") {
        await interaction
          .editReply({ components: [] })
          .catch(() => interaction.deleteReply().catch(() => {}));

        if (interaction.client.radioPanels) {
          interaction.client.radioPanels.delete(guildId);
        }
      }
    });
  },
};
