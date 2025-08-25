// events/roleUpdate.js
import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        const guild = newRole.guild;
        if (!guild) return; // Nur in Gilden reagieren

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_update');
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn(`[RoleUpdate] Log-Kanal ${logChannelId} in Gilde ${guild.id} ungültig oder kein Textkanal.`);
            return;
        }

        let updater = getTranslatedText(lang, 'role_update.UNKNOWN_UPDATER');

        try {
            const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
            const latestLog = auditLogs.entries.first();

            if (latestLog && latestLog.target.id === newRole.id && latestLog.executor) {
                const diff = Date.now() - latestLog.createdAt.getTime();
                if (diff < 5000) updater = `${latestLog.executor.tag} (<@${latestLog.executor.id}>)`;
            }
        } catch (error) {
            logger.error(`[RoleUpdate] Fehler beim Abrufen des Audit-Logs für Rolle ${newRole.name}:`, error);
        }

        const changes = [];

        if (oldRole.name !== newRole.name) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_NAME', { oldName: oldRole.name, newName: newRole.name }));
        }
        if (oldRole.color !== newRole.color) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_COLOR', { oldColor: oldRole.hexColor, newColor: newRole.hexColor }));
        }
        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_MENTIONABLE', {
                oldValue: oldRole.mentionable ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'),
                newValue: newRole.mentionable ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO')
            }));
        }
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(getTranslatedText(lang, 'role_update.CHANGE_HOISTED', {
                oldValue: oldRole.hoist ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'),
                newValue: newRole.hoist ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO')
            }));
        }

        if (!oldRole.permissions.equals(newRole.permissions)) {
            const oldPerms = oldRole.permissions.toArray();
            const newPerms = newRole.permissions.toArray();

            const addedPerms = newPerms.filter(p => !oldPerms.includes(p));
            const removedPerms = oldPerms.filter(p => !newPerms.includes(p));

            const permChanges = [];
            if (addedPerms.length) {
                permChanges.push(`+ ${addedPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')}`);
            }
            if (removedPerms.length) {
                permChanges.push(`- ${removedPerms.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')}`);
            }

            if (permChanges.length) {
                changes.push(getTranslatedText(lang, 'role_update.CHANGE_PERMISSIONS_SUMMARY', { changes: permChanges.join('\n') }));
            }
        }

        if (changes.length === 0) return;

        const embed = new EmbedBuilder()
            .setColor(newRole.color || 0xFFA500)
            .setTitle(getTranslatedText(lang, 'role_update.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_update.LOG_DESCRIPTION', { roleName: newRole.name, roleId: newRole.id }))
            .addFields(
                { name: getTranslatedText(lang, 'role_update.FIELD_UPDATED_BY'), value: updater, inline: false },
                { name: getTranslatedText(lang, 'role_update.FIELD_CHANGES'), value: changes.join('\n'), inline: false }
            )
            .setTimestamp()
            .setFooter({ text: getTranslatedText(lang, 'role_update.FOOTER_ROLE_ID', { roleId: newRole.id }) });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleUpdate] Rolle '${newRole.name}' in Gilde ${guild.name} aktualisiert von ${updater}. Änderungen: ${changes.join(', ')}.`);
        } catch (error) {
            logger.error(`[RoleUpdate] Fehler beim Senden des Logs für Rolle ${newRole.name}:`, error);
        }
    },
};
