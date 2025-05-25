// events/channelDelete.js
const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { getLogChannelId } = require('../utils/config');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel, client) {
    const embed = new EmbedBuilder()
      .setTitle('📕 Kanal gelöscht')
      .setColor(0xed4245)
      .addFields(
        { name: 'Name', value: channel.name || 'Unbekannt', inline: true },
        { name: 'Typ', value: channel.type, inline: true },
        { name: 'ID', value: channel.id, inline: true }
      )
      .setTimestamp();

    const logChannelId = await getLogChannelId(channel.guild.id);
    if (logChannelId) sendLog(client, logChannelId, { embeds: [embed] });
  },
};
