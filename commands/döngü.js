const { SlashCommandBuilder } = require('@discordjs/builders');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { emojis } = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('döngü')
    .setDescription('Kuyruk için döngü modunu ayarla')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Döngü modu')
        .setRequired(true)
        .addChoices(
          { name: 'Kapalı', value: 'off' },
          { name: 'Şarkı', value: 'song' },
          { name: 'Kuyruk', value: 'queue' }
        )),
  
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
    
    const mode = interaction.options.getString('mode');
    let loopMode = 0;
    let modeText = 'Kapalı';
    let modeEmoji = emojis.stop;
    
    switch (mode) {
      case 'off':
        loopMode = 0;
        modeText = 'Kapalı';
        modeEmoji = emojis.stop;
        break;
      case 'song':
        loopMode = 1;
        modeText = 'Şarkı';
        modeEmoji = emojis.repeatOne;
        break;
      case 'queue':
        loopMode = 2;
        modeText = 'Kuyruk';
        modeEmoji = emojis.repeat;
        break;
    }
    
    try {
      queue.setRepeatMode(loopMode);
      await interaction.reply({ 
        embeds: [successEmbed(`${modeEmoji} Döngü modu ayarlandı: **${modeText}**`)]
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({ 
        embeds: [errorEmbed(`${emojis.error} Döngü modu ayarlanırken hata oluştu: ${error.message}`)]
      });
    }
  },
}; 