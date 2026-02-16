const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duraklat')
    .setDescription('Çalan şarkıyı duraklat'),
  
  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    
    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Bu komutu kullanmak için bir ses kanalında olmalısınız!`)], 
        ephemeral: true 
      });
    }
    
    const queue = interaction.client.distube.getQueue(interaction.guildId);
    
    // Check if there's a queue
    if (!queue) {
      return interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Şu anda çalan bir şey yok!`)], 
        ephemeral: true 
      });
    }
    
    try {
      if (queue.paused) {
        return interaction.reply({ 
          embeds: [errorEmbed(`${emojis.warning} Müzik zaten duraklatılmış!`)], 
          ephemeral: true 
        });
      }
      
      queue.pause();
      await interaction.reply({ 
        embeds: [successEmbed(`${emojis.pause} Müzik duraklatıldı!`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Müziği duraklatırken hata oluştu: ${error.message}`)]
      });
    }
  },
}; 