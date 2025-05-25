const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger.js');
const { getLogChannelId } = require('../utils/config.js');

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole, client) {
    const changes = [];

    if (oldRole.name !== newRole.name) changes.push(`**Name**: \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.color !== newRole.color) changes.push(`**Farbe**: \`#${oldRole.color.toString(16)}\` → \`#${newRole.color.toString(16)}\``);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoist**: \`${oldRole.hoist}\` → \`${newRole.hoist}\``);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Erwähnbar**: \`${oldRole.mentionable}\` → \`${newRole.mentionable}\``);
    if (oldRole.position !== newRole.position) changes.push(`**Position**: \`${oldRole.position}\` → \`${newRole.position}\``);
    if (oldRole.managed !== newRole.managed) changes.push(`**Managed (Bot-Rolle)**: \`${oldRole.managed}\` → \`${newRole.managed}\``);
    if (oldRole.tags?.botId !== newRole.tags?.botId) changes.push(`**Bot-ID**: \`${oldRole.tags?.botId || 'Keine'}\` → \`${newRole.tags?.botId || 'Keine'}\``);
    if (oldRole.tags?.integrationId !== newRole.tags?.integrationId) changes.push(`**Integration-ID**: \`${oldRole.tags?.integrationId || 'Keine'}\` → \`${newRole.tags?.integrationId || 'Keine'}\``);

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      const added = newRole.permissions.toArray().filter(perm => !oldRole.permissions.has(perm));
      const removed = oldRole.permissions.toArray().filter(perm => !newRole.permissions.has(perm));
      if (added.length) changes.push(`**➕ Neue Rechte**: \`${added.join(', ')}\``);
      if (removed.length) changes.push(`**➖ Entfernte Rechte**: \`${removed.join(', ')}\``);
    }

    if (!changes.length) return;

    const embed = new EmbedBuilder()
      .setTitle('🔧 Rolle geändert')
      .setColor(0xff9900)
      .setDescription(changes.join('\n'))
      .setTimestamp()
      .addFields({ name: 'Rolle', value: `${newRole.name} (\`${newRole.id}\`)` });

    const logChannelId = await getLogChannelId(newRole.guild.id);
    if (logChannelId) sendLog(client, logChannelId, { embeds: [embed] });
  },
};
