const { SlashCommandBuilder } = require('@discordjs/builders');
const { infoEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('çal')
    .setDescription('Bir şarkı veya çalma listesi çal')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Şarkı URL\'si veya arama terimi')
        .setRequired(true)),
  
  async execute(interaction) {
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;
    
    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Bu komutu kullanmak için bir ses kanalında olmalısınız!`)], 
        ephemeral: true 
      });
    }
    
    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Ses kanalınıza katılmak ve konuşmak için izinlere ihtiyacım var!`)], 
        ephemeral: true 
      });
    }
    
    // Defer reply since playing music might take some time
    await interaction.deferReply();
    
    try {
      // Set textChannel for DisTube events
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) {
        interaction.client.distube.voices.join(voiceChannel);
      }
      
      await interaction.client.distube.play(voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { interaction }
      });
      
      // Edit the deferred reply
      await interaction.editReply({ 
        embeds: [infoEmbed(`${emojis.search} Aranıyor: \`${query}\``)]
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ 
        embeds: [errorEmbed(`${emojis.error} Müzik çalarken hata oluştu: ${error.message}`)]
      });
    }
  },
}; 