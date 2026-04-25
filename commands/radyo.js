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
const PerformanceTimer = require("../utils/timer");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyo")
    .setDescription("Popüler Türk radyo istasyonlarını listeler ve oynatır"),

  async execute(interaction) {
    const timer = new PerformanceTimer();
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

    timer.mark("İzin Kontrolleri");

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

    timer.mark("Menü Oluşturuldu");

    // Bu sunucu için son radyo panel mesajını kaydet
    interaction.client.radioPanels.set(guildId, response);

    const collector = response.createMessageComponentCollector({
      time: 300000,
    }); // 5 minutes

    collector.on("collect", async (i) => {
      const selectionTimer = new PerformanceTimer();
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "Bu menüyü sadece komutu kullanan kişi kullanabilir.",
            ephemeral: true,
          });
        }

        // Defer update immediately to prevent "Unknown interaction" errors
        await i.deferUpdate();
        selectionTimer.mark("Seçim Algılandı (Defer)");

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

          selectionTimer.mark("Veri Hazırlığı");

          // 1. AŞAMA: MENÜYÜ KALDIR VE BİLGİ VER
          await i.editReply({
            embeds: [infoEmbed(`${selectedStation.emoji || '📡'} **${selectedStation.name}** istasyonuna bağlanılıyor...\n` +
            `*Yayın hazırlanıyor, lütfen bekleyin. Bu işlem yayının türüne göre 5-10 saniye sürebilir.*`)],
            components: [] 
          });

          try {
            const queue = i.client.distube.getQueue(i.guildId);

            if (queue) {
              await queue.stop();
              selectionTimer.mark("Eski Kuyruk Temizlendi");
            }

            if (queue) {
              await new Promise((resolve) => setTimeout(resolve, 200));
              selectionTimer.mark("bekleme (0.2sn)");
            }

            const newQueue = i.client.distube.getQueue(i.guildId);
            if (!newQueue) {
              await i.client.distube.voices.join(voiceChannel);
              selectionTimer.mark("Kanala Katılım");
            }

            // 2. AŞAMA: YAYINI BAŞLAT
            await i.client.distube.play(voiceChannel, selectedUrl, {
              member: i.member,
              textChannel: i.channel,
              metadata: {
                interaction: i,
                stationName: selectedStation.name,
                timer: selectionTimer, // Pass timer to metadata
              },
            });

            selectionTimer.mark("DisTube Play");

// Performans raporlarını göster/gizle: 1 = Açık, 0 = Kapalı
const SHOW_PERFORMANCE = 0;

            // 3. AŞAMA: BAŞARILIYSA MENÜYÜ GERİ GETİR
            let successMsg = `${selectedStation.emoji || '📡'} **${selectedStation.name}** başarıyla başlatıldı!\n` +
                             `Dinlemek istediğiniz başka bir istasyon var mı?`;
            
            if (SHOW_PERFORMANCE) {
              const reports = selectionTimer.getReport();
              const total = selectionTimer.getTotal();
              successMsg += `\n\n**Performans Raporu:**\n` + 
                            reports.map(r => `• ${r.step}: \`${r.duration}ms\``).join("\n") + 
                            `\n🏁 **Toplam:** \`${total}ms\``;
            }

            await i.editReply({
              embeds: [infoEmbed(successMsg)],
              components: generateComponents(is247Active) 
            });

          } catch (error) {
            console.error(error);
            // 4. AŞAMA: HATA VARSA DA MENÜYÜ GERİ GETİR
            await i.editReply({
              embeds: [errorEmbed(`**${selectedStation.name}** bağlantı hatası: ${error.message}`)],
              components: generateComponents(is247Active)
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
