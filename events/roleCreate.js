// events/roleCreate.js
import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
    name: Events.GuildRoleCreate,
    async execute(role) {
        const guild = role.guild;
        if (!guild) return;

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_create');
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn(`[RoleCreate] Log-Kanal ${logChannelId} in Gilde ${guild.id} ungültig oder kein Textkanal.`);
            return;
        }

        let creator = getTranslatedText(lang, 'role_create.UNKNOWN_CREATOR');

        try {
            const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
            const latestLog = auditLogs.entries.first();

            if (latestLog?.target.id === role.id && latestLog.executor) {
                const diff = Date.now() - latestLog.createdAt.getTime();
                if (diff < 5000) creator = `${latestLog.executor.tag} (<@${latestLog.executor.id}>)`;
            }
        } catch (error) {
            logger.error(`[RoleCreate] Fehler beim Abrufen des Audit-Logs für Rolle ${role.name}:`, error);
        }

        const permissions = role.permissions.toArray();
        const permissionNames = permissions.length > 0
            ? permissions.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')
            : getTranslatedText(lang, 'role_create.NO_PERMISSIONS');

        const embed = new EmbedBuilder()
            .setColor(role.color || 0x00FF00)
            .setTitle(getTranslatedText(lang, 'role_create.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_create.LOG_DESCRIPTION', { roleName: role.name, roleId: role.id }))
            .addFields(
                { name: getTranslatedText(lang, 'role_create.FIELD_NAME'), value: role.name, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_ID'), value: role.id, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_COLOR'), value: role.hexColor, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_MENTIONABLE'), value: role.mentionable ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'), inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_HOISTED'), value: role.hoist ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'), inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_PERMISSIONS'), value: permissionNames, inline: false },
                { name: getTranslatedText(lang, 'role_create.FIELD_CREATED_BY'), value: creator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: getTranslatedText(lang, 'role_create.FOOTER_ROLE_ID', { roleId: role.id }) });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleCreate] Rolle '${role.name}' (${role.id}) in Gilde ${guild.name} erstellt. Ersteller: ${creator}.`);
        } catch (error) {
            logger.error(`[RoleCreate] Fehler beim Senden des Logs für Rolle ${role.name}:`, error);
        }
    },
};