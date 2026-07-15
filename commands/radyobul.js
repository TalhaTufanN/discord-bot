const { SlashCommandBuilder } = require("discord.js");
const { errorEmbed, successEmbed, infoEmbed } = require("../utils/embeds");
const { searchStations, getStationById } = require("../utils/stationsSearch");
const { getOrCreatePlayer } = require("../utils/lavalink");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radyobul")
    .setDescription("Binlerce radyo arasından arama yapın ve çalın")
    .addStringOption(option =>
      option.setName("radyo")
        .setDescription("Çalmak istediğiniz radyo adı")
        .setAutocomplete(true)
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const results = searchStations(focusedValue);

    await interaction.respond(
      results.map(s => ({ name: `${s.name} (${s.state || 'TR'})`, value: s.id }))
    );
  },

  async execute(interaction) {
    const stationId = interaction.options.getString("radyo");
    const station = getStationById(stationId);

    if (!station) {
      return interaction.reply({
        embeds: [errorEmbed("Seçilen radyo bulunamadı!")],
        ephemeral: true
      });
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed("Bir ses kanalında olmalısınız!")],
        ephemeral: true
      });
    }

    await interaction.reply({
      embeds: [infoEmbed(`📡 **${station.name}** bağlanılıyor...`)]
    });

    try {
      // DisTube'da queue.stop() + play() vardi; Lavalink'te ayni player'i
      // tekrar kullaniyoruz (getOrCreatePlayer gerekirse kanala baglar/tasir).
      const player = await getOrCreatePlayer(interaction.client, {
        guildId: interaction.guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
      });

      // URL'yi Lavalink cozsun (source vermiyoruz; yayin adresini kendi tanir)
      const res = await player.search({ query: station.url }, interaction.user);
      const track = res?.tracks?.[0];
      if (!track) {
        return interaction.editReply({
          embeds: [errorEmbed(`**${station.name}** yayınına ulaşılamadı!`)]
        });
      }

      // Istasyon adi tasiyici isaret: isRadioTrack() ve simdi-caliyor/metadata/
      // auto-retry yolunun tamami buna bakiyor. Kuyruga eklemeden ONCE yazilmali.
      track.userData = {
        ...(track.userData || {}),
        stationName: station.name,
      };

      // Radyo kuyrugun tamaminin yerine gecer (eski davranis: queue.stop()).
      // DisTube'da stop() kuyrugu yok ettigi icin dongu modu da sifirlaniyordu;
      // Lavalink'te player kalici oldugundan dongu modunu elle kapatiyoruz,
      // yoksa "track" dongusu yeni istasyona gecmemizi engeller.
      if (player.repeatMode !== "off") {
        await player.setRepeatMode("off");
      }
      if (player.queue.tracks.length) {
        await player.queue.splice(0, player.queue.tracks.length);
      }

      await player.queue.add(track);

      // Calan bir sey varsa hemen yeni istasyona gec, yoksa baslat
      if (player.queue.current) {
        await player.skip(0, false);
      } else if (!player.playing) {
        await player.play();
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [errorEmbed(`Bağlantı hatası: ${error.message}`)]
      });
    }
  }
};
