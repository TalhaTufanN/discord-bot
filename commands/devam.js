const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devam')
    .setDescription('Duraklatılan şarkıyı devam ettir'),
  
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
      if (!queue.paused) {
        return interaction.reply({ 
          embeds: [errorEmbed(`${emojis.warning} Müzik zaten çalıyor!`)], 
          ephemeral: true 
        });
      }
      
      queue.resume();
      await interaction.reply({ 
        embeds: [successEmbed(`${emojis.play} Müzik devam ettirildi!`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Müzik devam ettirilirken hata oluştu: ${error.message}`)]
      });
    }
  },
}; 