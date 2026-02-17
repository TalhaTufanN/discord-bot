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

const stations = [
  {
    name: "Radyo 1959",
    value: "https://radyo1.radyo-dinle.tc/8108/stream",
    description: "Türkçe Karışık & Sohbet",
    emoji: "📻",
    category: "Karışık",
  },
  {
    name: "TRT Türkü",
    value: "https://rd-trtturku.medya.trt.com.tr/master_128.m3u8",
    description: "Türk Halk Müziği",
    emoji: "🎼",
    category: "Halk Müziği",
  },
  {
    name: "Kral FM",
    value: "https://dygedge2.radyotvonline.net/kralfm/playlist.m3u8",
    description: "Arabesk & Fantezi",
    emoji: "🥀",
    category: "Arabesk",
  },
  {
    name: "Arabesk FM",
    value: "https://yayin.arabeskfm.biz:8042//;type=mp3",
    description: "Arabesk Müzik",
    emoji: "🥀",
    category: "Arabesk",
  },
  {
    name: "Number1 Türk 90’lar",
    value: "https://eustr75.mediatriple.net/hls/turkce_90lar/aac_hifi.m3u8",
    description: "Türkçe 90’lar Hitleri",
    emoji: "📼",
    category: "Nostalji",
  },
  {
    name: "PowerTürk",
    value: "https://listen.powerapp.com.tr/powerturk/mpeg/icecast.audio",
    description: "Türkçe Pop Hitleri",
    emoji: "🎧",
    category: "Pop",
  },
  {
    name: "JoyTürk ROCK",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/JOYTURK_ROCK_SC",
    description: "Türkçe Rock",
    emoji: "🎸",
    category: "Rock",
  },
  {
    name: "Number1 Türk Rap",
    value:
      "https://eustr75.mediatriple.net/Number1Media/30_Number1_Turk_Rap.stream/playlist.m3u8",
    description: "Türkçe Rap & Hip-Hop",
    emoji: "🎤",
    category: "Rap",
  },
  {
    name: "JoyTürk",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_SC",
    description: "Türkçe Slow & Pop",
    emoji: "🎧",
    category: "Slow",
  },
  {
    name: "Kral Pop",
    value: "https://dygedge.radyotvonline.net/kralpop/playlist.m3u8",
    description: "Türkçe Pop",
    emoji: "🎧",
    category: "Pop",
  },
  {
    name: "Metro FM",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM_SC",
    description: "Yabancı Pop & Top 40",
    emoji: "🌍",
    category: "Yabancı",
  },
  {
    name: "Virgin Radio",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/VIRGIN_RADIO_SC",
    description: "Yabancı Rock & Pop",
    emoji: "🎸",
    category: "Yabancı",
  },
  {
    name: "Radyo Viva",
    value: "https://listen.radyotvonline.net/hls/play/adsonline_radyoviva.m3u8",
    description: "Türkçe Pop & Karışık",
    emoji: "🎧",
    category: "Pop",
  },
  {
    name: "Borusan Klasik",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/BORUSAN_KLASIK_SC",
    description: "Klasik Müzik",
    emoji: "🎻",
    category: "Klasik",
  },
  {
    name: "Dance Hits",
    value:
      "https://playerservices.streamtheworld.com/api/livestream-redirect/SC019_SO1_SC",
    description: "Dance & EDM Hitleri",
    emoji: "💃",
    category: "Yabancı",
  },
  {
    name: "Number1 Türk Eller Havaya",
    value:
      "https://eustr75.mediatriple.net/Number1Media/05_Number1_Turk_Eller_Havaya.stream/playlist.m3u8",
    description: "Türkçe Party Hitleri",
    emoji: "🎉",
    category: "Pop",
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyo")
    .setDescription("Popüler Türk radyo istasyonlarını listeler ve oynatır"),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;

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
          ...stations.map((station, index) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(station.name)
              .setValue(index.toString()) // Use INDEX as value
              .setDescription(station.description)
              .setEmoji(station.emoji),
          ),
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

    // Initial Reply
    const response = await interaction.reply({
      embeds: [infoEmbed("Dinlemek istediğiniz radyo istasyonunu seçin.")],
      components: generateComponents(is247Active),
    });

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
            await i.editReply({
              content: "Radyo menüsü kapatıldı.",
              embeds: [],
              components: [],
            });
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

            if (queue) {
              await queue.stop();
            }

            if (queue) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            const newQueue = i.client.distube.getQueue(i.guildId);
            if (!newQueue) {
              i.client.distube.voices.join(voiceChannel);
            }

            await i.client.distube.play(voiceChannel, selectedUrl, {
              member: i.member,
              textChannel: i.channel,
              metadata: {
                interaction: i,
                stationName: selectedStation.name,
              },
            });

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
      if (reason === "time" && collected.size === 0) {
        await interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
