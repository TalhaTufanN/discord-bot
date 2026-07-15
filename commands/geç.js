const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed, infoEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');
const { skipToRandomSagopa } = require('../utils/sagopa');
const { trackDisplay } = require('../utils/lavalink');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('geç')
    .setDescription('Mevcut şarkıyı atla'),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;

    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Bu komutu kullanmak için bir ses kanalında olmalısınız!`)],
        ephemeral: true
      });
    }

    const player = interaction.client.lavalink.getPlayer(interaction.guildId);

    // Check if there's a queue
    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)],
        ephemeral: true
      });
    }

    try {
      const song = trackDisplay(player.queue.current);

      // Sirada baska sarki varsa normal atla (calan sarki tracks dizisinde DEGIL)
      if (player.queue.tracks.length > 0) {
        await player.skip();
        return interaction.reply({
          embeds: [successEmbed(`${emojis.skip} Atlandı: \`${song.name}\``)]
        });
      }

      // Sirada sarki yok ama surekli Sagopa modu aktifse: yeni rastgele Sagopa'ya geç
      if (await skipToRandomSagopa(player, interaction.client)) {
        return interaction.reply({
          embeds: [successEmbed(`${emojis.skip} Atlandı — yeni rastgele Sagopa açılıyor.`)]
        });
      }

      // Surekli mod yoksa ve sirada sarki yoksa: calmayi sonlandir
      player.set("intentionalStop", true);
      // destroy() DEGIL: DisTube'un queue.stop()'u kanaldan cikmiyordu.
      await player.stopPlaying(true, false);
      return interaction.reply({
        embeds: [infoEmbed(`${emojis.skip} Atlandı. Sırada şarkı kalmadı, çalma sonlandırıldı.`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        embeds: [errorEmbed(`${emojis.error} Şarkı atlanırken hata oluştu: ${error.message}`)]
      });
    }
  },
};
