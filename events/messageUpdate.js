const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Geänderter Pfad

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    try {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (oldMessage.content === newMessage.content) return;

      const logChannelId = getLogChannelId(newMessage.guild.id);
      if (!logChannelId) return;

      const logChannel = newMessage.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setAuthor({
          name: `${newMessage.author.tag} hat eine Nachricht bearbeitet`,
          iconURL: newMessage.author.displayAvatarURL(),
        })
        .setDescription(`Nachricht bearbeitet in <#${newMessage.channel.id}>`)
        .addFields(
          { name: 'Vorher:', value: oldMessage.content || '*Kein alter Inhalt*' },
          { name: 'Nachher:', value: newMessage.content || '*Kein neuer Inhalt*' },
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(error => {
        console.error('Failed to send message update log:', error);
      });
    } catch (error) {
      console.error('Error in messageUpdate event:', error);
    }
  },
};
