const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { emojis } = require('../config/emojis');

const commandCategories = {
  playback: {
    title: `${emojis.play} Çalma Kontrolleri`,
    description: 'Müzik çalma kontrolleri.',
    commands: [
      { name: '/çal <şarkı>', description: 'Bir şarkı veya çalma listesi çal', example: '/çal Despacito' },
      { name: '/duraklat', description: 'Çalan şarkıyı duraklat', example: '/duraklat' },
      { name: '/devam', description: 'Çalmaya devam et', example: '/devam' },
      { name: '/geç', description: 'Sonraki şarkıya geç', example: '/geç' },
      { name: '/durdur', description: 'Dur ve kuyruğu temizle', example: '/durdur' }
    ]
  },
  queue: {
    title: `${emojis.queue} Kuyruk Yönetimi`,
    description: 'Müzik kuyruğunu yönetme komutları.',
    commands: [
      { name: '/kuyruk', description: 'Mevcut kuyruğu görüntüle', example: '/kuyruk' },
      { name: '/mevcutşarkı', description: 'Çalan şarkı detaylarını göster', example: '/mevcutşarkı' },
      { name: '/karıştır', description: 'Kuyruğu karıştır', example: '/karıştır' }
    ]
  },
  settings: {
    title: `${emojis.settings} Ayarlar`,
    description: 'Ayarları değiştirme komutları.',
    commands: [
      { name: '/ses <0-100>', description: 'Ses seviyesini ayarla (0-100%)', example: '/ses 50' },
      { name: '/döngü <Kapalı/Şarkı/Kuyruk>', description: 'Döngü modunu ayarla', example: '/döngü Şarkı' },
      { name: '/yardım', description: 'Bu yardım menüsünü göster', example: '/yardım' }
    ]
  }
};

const createHelpEmbed = (interaction, page) => {
  const categoryKeys = Object.keys(commandCategories);
  const category = categoryKeys[page];

  const embed = new EmbedBuilder()
    .setColor('#0093ff')
    .setAuthor({
      name: 'Müzik Botu Yardım',
      iconURL: 'https://i.hizliresim.com/doc7olw.png'
    })
    .setTitle(commandCategories[category].title)
    .setDescription(commandCategories[category].description)
    .addFields(
      commandCategories[category].commands.map(cmd => ({
        name: cmd.name,
        value: `${cmd.description}\n*Örnek:* \`${cmd.example}\``,
        inline: false
      }))
    )
    .setFooter({
      text: `${interaction.user.username} tarafından istendi • Sayfa ${page + 1} / ${categoryKeys.length}`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp()
    .setThumbnail('https://i.hizliresim.com/doc7olw.png');

  return embed;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yardım')
    .setDescription('Tüm mevcut müzik komutlarını göster'),

  async execute(interaction) {
    let currentPage = 0;

    const embed = createHelpEmbed(interaction, currentPage);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Önceki')
          .setEmoji('<:back:1472922933788803244>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Sonraki')
          .setEmoji('<:forward:1472922950536663102>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === Object.keys(commandCategories).length - 1)
      );

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ 
      filter, 
      time: 60000 
    });

    collector.on('collect', async i => {
      const maxPage = Object.keys(commandCategories).length - 1;

      if (i.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(maxPage, currentPage + 1);
      }

      // Update button states BEFORE sending the update
      row.components[0].setDisabled(currentPage === 0);
      row.components[1].setDisabled(currentPage === maxPage);

      const newEmbed = createHelpEmbed(interaction, currentPage);
      await i.update({ 
        embeds: [newEmbed], 
        components: [row] 
      });
    });

    collector.on('end', async () => {
      const message = await interaction.fetchReply();
      if (message) {
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true),
            ButtonBuilder.from(row.components[1]).setDisabled(true)
          );
        await interaction.editReply({ components: [disabledRow] });
      }
    });
  },
};
