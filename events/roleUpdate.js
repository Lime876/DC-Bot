// events/guildRoleUpdate.js
const { Events, EmbedBuilder, AuditLogEvent, TextChannel } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Stelle sicher, dass diese Datei korrekt den Log-Kanal liefert
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole, client) {
        // Ignoriere DM-Kontexte (Rollen existieren nur in Gilden)
        if (!newRole.guild) {
            console.log(`[RoleUpdate DEBUG] Rolle ID ${newRole.id}: Ignoriert (keine Gilde).`);
            return;
        }

        console.log(`[RoleUpdate DEBUG] Event ausgelöst für Rolle ID: ${newRole.id}, Name: ${newRole.name}.`);

        const lang = getGuildLanguage(newRole.guild.id);
        const logChannelId = getLogChannelId(newRole.guild.id, 'role_update'); // Verwende 'role_update' als Log-Typ

        if (!logChannelId) {
            console.log(`[RoleUpdate DEBUG] Rolle ID ${newRole.id}: Kein Log-Kanal für 'role_update' in Gilde ${newRole.guild.id} konfiguriert.`);
            return;
        }

        let logChannel;
        try {
            logChannel = await newRole.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[RoleUpdate] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${newRole.guild.name} ist kein Textkanal oder nicht mehr vorhanden.`);
                return;
            }
        } catch (error) {
            console.error(`[RoleUpdate] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return;
        }

        const changes = [];
        let responsibleUser = null; // Variable, um den verantwortlichen Benutzer zu speichern

        // Versuche, den Audit Log Eintrag für die Änderung zu finden
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
            console.error('[RoleUpdate] Fehler beim Abrufen des Audit Logs für Rollen-Update:', error);
        }

        const yesText = getTranslatedText(lang, 'general.YES');
        const noText = getTranslatedText(lang, 'general.NO');
        const noneText = getTranslatedText(lang, 'general.NONE');
        const notAvailableText = getTranslatedText(lang, 'general.NOT_AVAILABLE');


        if (oldRole.name !== newRole.name) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_NAME')}**: \`${oldRole.name}\` → \`${newRole.name}\``);
        if (oldRole.color !== newRole.color) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_COLOR')}**: \`#${oldRole.color.toString(16).padStart(6, '0').toUpperCase()}\` → \`#${newRole.color.toString(16).padStart(6, '0').toUpperCase()}\``);
        if (oldRole.hoist !== newRole.hoist) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_HOIST')}**: \`${oldRole.hoist ? yesText : noText}\` → \`${newRole.hoist ? yesText : noText}\``);
        if (oldRole.mentionable !== newRole.mentionable) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_MENTIONABLE')}**: \`${oldRole.mentionable ? yesText : noText}\` → \`${newRole.mentionable ? yesText : noText}\``);
        if (oldRole.position !== newRole.position) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_POSITION')}**: \`${oldRole.position}\` → \`${newRole.position}\``);
        if (oldRole.managed !== newRole.managed) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_MANAGED')}**: \`${oldRole.managed ? yesText : noText}\` → \`${newRole.managed ? yesText : noText}\``);
        if (oldRole.tags?.botId !== newRole.tags?.botId) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_BOT_ID')}**: \`${oldRole.tags?.botId || noneText}\` → \`${newRole.tags?.botId || noneText}\``);
        if (oldRole.tags?.integrationId !== newRole.tags?.integrationId) changes.push(`**${getTranslatedText(lang, 'role_update.LOG_FIELD_INTEGRATION_ID')}**: \`${oldRole.tags?.integrationId || noneText}\` → \`${newRole.tags?.integrationId || noneText}\``);

        // Detaillierte Berechtigungsänderungen
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();

            const added = newPerms.filter(perm => !oldPerms.includes(perm));
            const removed = oldPerms.filter(perm => !newPerms.includes(perm));

            if (added.length) {
                changes.push(`**➕ ${getTranslatedText(lang, 'role_update.LOG_FIELD_PERM_ADDED')}**:\n\`\`\`\n${added.join(', ')}\n\`\`\``);
            }
            if (removed.length) {
                changes.push(`**➖ ${getTranslatedText(lang, 'role_update.LOG_FIELD_PERM_REMOVED')}**:\n\`\`\`\n${removed.join(', ')}\n\`\`\``);
            }
        }

        if (!changes.length) {
            console.log(`[RoleUpdate DEBUG] Rolle ID ${newRole.id}: Keine Änderungen erkannt.`);
            return; // Wenn keine Änderungen erkannt wurden, beenden
        }

        const embed = new EmbedBuilder()
            .setTitle(getTranslatedText(lang, 'role_update.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_update.LOG_DESCRIPTION', {
                roleName: newRole.name,
                roleMention: newRole.toString(),
                roleId: newRole.id
            }))
            .addFields(
                { name: getTranslatedText(lang, 'role_update.LOG_FIELD_CHANGES'), value: changes.join('\n') }
            )
            .setColor(0xFFA500) // Eine passende Farbe für Updates (Orange)
            .setTimestamp();

        if (responsibleUser) {
            embed.setFooter({
                text: getTranslatedText(lang, 'role_update.LOG_FOOTER_EXECUTOR', { userName: responsibleUser.tag || responsibleUser.username }),
                iconURL: responsibleUser.displayAvatarURL(),
            });
        } else {
            embed.setFooter({
                text: getTranslatedText(lang, 'role_update.LOG_FOOTER_UNKNOWN_EXECUTOR'),
            });
        }

        // --- DEBUG: Dies wird geloggt, wenn der Bot versucht, das Embed zu senden ---
        console.log(`[RoleUpdate DEBUG] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);
        // --- END DEBUG ---

        try {
            await logChannel.send({ embeds: [embed] }).catch(error => {
                console.error(`[RoleUpdate] Konnte Log-Nachricht nicht in Kanal ${logChannelId} senden:`, error);
            });
        } catch (error) {
            console.error(`[RoleUpdate] Schwerwiegender Fehler beim Senden des Embeds an den Log-Kanal:`, error);
        }
    },
};
