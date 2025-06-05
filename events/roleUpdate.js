const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js'); // AuditLogEvent hinzugefügt
const { sendLog } = require('../utils/logger.js');
const { getLogChannelId } = require('../utils/config.js'); // Stelle sicher, dass diese Datei korrekt den Log-Kanal liefert

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole, client) { // client-Parameter hinzugefügt, falls benötigt (z.B. für sendLog über client)
    const changes = [];
    let responsibleUser = null; // Variable, um den verantwortlichen Benutzer zu speichern

    // Versuche, den Audit Log Eintrag für die Änderung zu finden
    // Dies funktioniert nicht immer zuverlässig, da Audit Log Einträge verzögert sein können oder es mehrere in kurzer Zeit gibt.
    try {
        const fetchedLogs = await newRole.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleUpdate,
        });
        const roleUpdateLog = fetchedLogs.entries.find(
            auditLog =>
                auditLog.target.id === newRole.id &&
                auditLog.action === AuditLogEvent.RoleUpdate &&
                Date.now() - auditLog.createdTimestamp < 5000 // Suche nach Einträgen der letzten 5 Sekunden
        );

        if (roleUpdateLog) {
            responsibleUser = roleUpdateLog.executor;
        }
    } catch (error) {
        console.error('Fehler beim Abrufen des Audit Logs für Rollen-Update:', error);
    }


    if (oldRole.name !== newRole.name) changes.push(`**Name**: \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.color !== newRole.color) changes.push(`**Farbe**: \`#${oldRole.color.toString(16).padStart(6, '0')}\` → \`#${newRole.color.toString(16).padStart(6, '0')}\``); // Farben immer 6-stellig formatieren
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Separater Anzeige** (Oben in der Liste): \`${oldRole.hoist ? 'Ja' : 'Nein'}\` → \`${newRole.hoist ? 'Ja' : 'Nein'}\``); // Verständlichere Beschriftung
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Erwähnbar**: \`${oldRole.mentionable ? 'Ja' : 'Nein'}\` → \`${newRole.mentionable ? 'Ja' : 'Nein'}\``); // Verständlichere Beschriftung
    if (oldRole.position !== newRole.position) changes.push(`**Position**: \`${oldRole.position}\` → \`${newRole.position}\``);
    if (oldRole.managed !== newRole.managed) changes.push(`**Vom Bot/Integration verwaltet**: \`${oldRole.managed ? 'Ja' : 'Nein'}\` → \`${newRole.managed ? 'Ja' : 'Nein'}\``); // Verständlichere Beschriftung
    if (oldRole.tags?.botId !== newRole.tags?.botId) changes.push(`**Bot-ID (verbunden)**: \`${oldRole.tags?.botId || 'Keine'}\` → \`${newRole.tags?.botId || 'Keine'}\``);
    if (oldRole.tags?.integrationId !== newRole.tags?.integrationId) changes.push(`**Integration-ID (verbunden)**: \`${oldRole.tags?.integrationId || 'Keine'}\` → \`${newRole.tags?.integrationId || 'Keine'}\``);


    // Detaillierte Berechtigungsänderungen
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const oldPerms = oldRole.permissions.toArray();
        const newPerms = newRole.permissions.toArray();

        const added = newPerms.filter(perm => !oldPerms.includes(perm));
        const removed = oldPerms.filter(perm => !newPerms.includes(perm));

        if (added.length) {
            changes.push(`**➕ Hinzugefügte Berechtigungen**:\n\`\`\`\n${added.join(', ')}\n\`\`\``);
        }
        if (removed.length) {
            changes.push(`**➖ Entfernte Berechtigungen**:\n\`\`\`\n${removed.join(', ')}\n\`\`\``);
        }
    }

    if (!changes.length) return; // Wenn keine Änderungen erkannt wurden, beenden

    const embed = new EmbedBuilder()
      .setTitle('🔧 Rolle aktualisiert')
      .setDescription(`**Rolle:** ${newRole.name} (<@&${newRole.id}>)`)
      .addFields(
        { name: 'Änderungen', value: changes.join('\n') }
      )
      .setColor(0xFFA500) // Eine passende Farbe für Updates (Orange)
      .setTimestamp();

    if (responsibleUser) {
        embed.setFooter({
            text: `Ausgeführt von ${responsibleUser.tag}`,
            iconURL: responsibleUser.displayAvatarURL(),
        });
    } else {
        embed.setFooter({
            text: 'Verantwortlicher Benutzer konnte nicht ermittelt werden (Audit Log möglicherweise verzögert oder nicht verfügbar).',
        });
    }

    const logChannelId = getLogChannelId(newRole.guild.id);
    if (logChannelId) {
      const logChannel = newRole.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] }).catch(error => {
          console.error(`Konnte Log-Nachricht nicht in Kanal ${logChannelId} senden:`, error);
        });
      } else {
          console.warn(`Log-Kanal mit ID ${logChannelId} nicht gefunden.`);
      }
    } else {
        console.warn(`Kein Log-Kanal für Gilde ${newRole.guild.name} (${newRole.guild.id}) konfiguriert.`);
    }
  },
};