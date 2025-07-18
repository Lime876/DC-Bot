// events/roleUpdate.js
const { Events, EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        const guild = newRole.guild;
        if (!guild) {
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_update');

        if (!logChannelId) {
            // logger.debug(`[RoleUpdate Event] Kein Log-Kanal für 'role_update' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[RoleUpdate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let updater = getTranslatedText(lang, 'role_update.UNKNOWN_UPDATER');
        const changes = [];

        // Versuche, den Aktualisierenden aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.RoleUpdate,
                limit: 1,
            });
            const latestRoleUpdateLog = auditLogs.entries.first();

            if (latestRoleUpdateLog && latestRoleUpdateLog.target.id === newRole.id && latestRoleUpdateLog.executor) {
                const timeDifference = Date.now() - latestRoleUpdateLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    updater = `${latestRoleUpdateLog.executor.tag} (<@${latestRoleUpdateLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[RoleUpdate Event] Fehler beim Abrufen des Audit-Logs für Rollenaktualisierung von ${newRole.name}:`, error);
        }

        // Erkennung spezifischer Änderungen
        if (oldRole.name !== newRole.name) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_NAME', { oldName: oldRole.name, newName: newRole.name }));
        }
        if (oldRole.color !== newRole.color) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_COLOR', { oldColor: oldRole.hexColor, newColor: newRole.hexColor }));
        }
        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_MENTIONABLE', { oldValue: oldRole.mentionable ? 'Ja' : 'Nein', newValue: newRole.mentionable ? 'Ja' : 'Nein' }));
        }
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_HOISTED', { oldValue: oldRole.hoist ? 'Ja' : 'Nein', newValue: newRole.hoist ? 'Ja' : 'Nein' }));
        }

        // Berechtigungsänderungen
        if (!oldRole.permissions.equals(newRole.permissions)) {
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();

            const addedPerms = newPerms.filter(p => !oldPerms.includes(p));
            const removedPerms = oldPerms.filter(p => !newPerms.includes(p));

            let permChanges = [];
            if (addedPerms.length > 0) {
                permChanges.push(`+ ${addedPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')}`);
            }
            if (removedPerms.length > 0) {
                permChanges.push(`- ${removedPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')}`);
            }

            if (permChanges.length > 0) {
                changes.push(getTranslatedText(lang, 'role_update.CHANGE_PERMISSIONS', {
                    oldPermissions: oldPerms.length > 0 ? oldPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ') : getTranslatedText(lang, 'role_create.NO_PERMISSIONS'),
                    newPermissions: newPerms.length > 0 ? newPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ') : getTranslatedText(lang, 'role_create.NO_PERMISSIONS')
                }));
            }
        }

        if (changes.length === 0) {
            // Manchmal wird roleUpdate auch ohne erkennbare Änderungen ausgelöst (z.B. interne Discord-Updates)
            // logger.debug(`[RoleUpdate Event] Rolle '${newRole.name}' aktualisiert, aber keine spezifischen Änderungen erkannt. (PID: ${process.pid})`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(newRole.color || 0xFFA500) // Rolle Farbe oder Orange für Aktualisierung
            .setTitle(getTranslatedText(lang, 'role_update.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_update.LOG_DESCRIPTION', { roleName: newRole.name, roleId: newRole.id }))
            .addFields(
                { name: getTranslatedText(lang, 'role_update.FIELD_UPDATED_BY'), value: updater, inline: false },
                { name: getTranslatedText(lang, 'role_update.FIELD_CHANGES'), value: changes.join('\n') || getTranslatedText(lang, 'role_update.NO_CHANGES_DETECTED'), inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Rollen ID: ${newRole.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleUpdate Event] Rolle '${newRole.name}' in Gilde ${guild.name} aktualisiert. Aktualisierender: ${updater}. Änderungen: ${changes.join(', ')}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[RoleUpdate Event] Fehler beim Senden des Rollen-Update-Logs für ${newRole.name}:`, error);
        }
    },
};
