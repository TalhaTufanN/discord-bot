const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('karıştır')
    .setDescription('Mevcut kuyruğu karıştır'),
  
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
    
    // Check if there are enough songs to shuffle
    if (queue.songs.length < 3) {
      return interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Karıştırmak için kuyrukta en az 3 şarkı olmalı!`)], 
        ephemeral: true 
      });
    }
    
    try {
      queue.shuffle();
      await interaction.reply({ 
        embeds: [successEmbed(`${emojis.shuffle} Kuyruk karıştırıldı!`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Kuyruğu karıştırırken hata oluştu: ${error.message}`)]
      });
    }
  },
}; 