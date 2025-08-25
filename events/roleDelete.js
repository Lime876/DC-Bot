// events/roleDelete.js
import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
    name: Events.GuildRoleDelete,
    async execute(role) {
        const guild = role.guild;
        if (!guild) return;

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_delete');
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn(`[RoleDelete] Log-Kanal ${logChannelId} in Gilde ${guild.id} ungültig oder kein Textkanal.`);
            return;
        }

        let deleter = getTranslatedText(lang, 'role_delete.UNKNOWN_DELETER');

        try {
            const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
            const latestLog = auditLogs.entries.first();

            if (latestLog && latestLog.target.id === role.id && latestLog.executor) {
                const diff = Date.now() - latestLog.createdAt.getTime();
                if (diff < 5000) deleter = `${latestLog.executor.tag} (<@${latestLog.executor.id}>)`;
            }
        } catch (error) {
            logger.error(`[RoleDelete] Fehler beim Abrufen des Audit-Logs für Rolle ${role.name}:`, error);
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(getTranslatedText(lang, 'role_delete.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_delete.LOG_DESCRIPTION', { roleName: role.name, roleId: role.id }))
            .addFields(
                { name: getTranslatedText(lang, 'role_delete.FIELD_NAME'), value: role.name, inline: true },
                { name: getTranslatedText(lang, 'role_delete.FIELD_ID'), value: role.id, inline: true },
                { name: getTranslatedText(lang, 'role_delete.FIELD_DELETED_BY'), value: deleter, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: getTranslatedText(lang, 'role_delete.FOOTER_ROLE_ID', { roleId: role.id }) });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleDelete] Rolle '${role.name}' (${role.id}) in Gilde ${guild.name} gelöscht. Löschender: ${deleter}.`);
        } catch (error) {
            logger.error(`[RoleDelete] Fehler beim Senden des Logs für Rolle ${role.name}:`, error);
        }
    },
};
