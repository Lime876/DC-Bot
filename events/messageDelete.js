const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Geänderter Pfad

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    try {
      if (message.author?.bot) return;

      const logChannelId = getLogChannelId(message.guild.id);
      if (!logChannelId) return;

      const logChannel = message.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const content = message.content || '*Kein Inhalt*';
      const author = message.author ? message.author.tag : 'Unbekannter Benutzer';

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setAuthor({
          name: `${author} hat eine Nachricht gelöscht`,
          iconURL: message.author?.displayAvatarURL() || undefined,
        })
        .setDescription(`**Nachricht von ${author} wurde gelöscht** in <#${message.channel.id}>`)
        .addFields({ name: 'Inhalt:', value: content })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(error => {
        console.error('Failed to send message delete log:', error);
      });
    } catch (error) {
      console.error('Error in messageDelete event:', error);
    }
  },
};
