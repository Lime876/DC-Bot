const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { getLogChannelId } = require('../utils/config');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember, client) {
    const changes = [];

    // Nickname Änderung
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**Nickname**: \`${oldMember.nickname || 'Keiner'}\` → \`${newMember.nickname || 'Keiner'}\``);
    }

    // Rollenänderung
    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);

    const addedRoles = newRoles.filter(id => !oldRoles.includes(id));
    const removedRoles = oldRoles.filter(id => !newRoles.includes(id));

    if (addedRoles.length) {
      const added = addedRoles.map(id => `<@&${id}>`).join(', ');
      changes.push(`**➕ Neue Rollen**: ${added}`);
    }

    if (removedRoles.length) {
      const removed = removedRoles.map(id => `<@&${id}>`).join(', ');
      changes.push(`**➖ Entfernte Rollen**: ${removed}`);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('🧑‍💼 Mitglied aktualisiert')
      .setColor(0x00ccff)
      .setDescription(changes.join('\n'))
      .addFields({ name: 'Benutzer', value: `${newMember.user.tag} (${newMember.id})` })
      .setTimestamp();

    const logChannelId = await getLogChannelId(newMember.guild.id);
    if (logChannelId) sendLog(client, logChannelId, { embeds: [embed] });
  },
};
