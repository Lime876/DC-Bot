const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Geänderter Pfad

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      const logChannelId = getLogChannelId(member.guild.id);
      if (!logChannelId) return;

      const logChannel = member.guild.channels.cache.get(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({
          name: `${member.user.tag} ist dem Server beigetreten`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(`Willkommen!`)
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(error => {
        console.error('Failed to send join log message:', error);
      });
    } catch (error) {
      console.error('Error in guildMemberAdd event:', error);
    }
  },
};
