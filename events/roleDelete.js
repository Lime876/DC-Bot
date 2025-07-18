// events/roleDelete.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        const guild = role.guild;
        if (!guild) {
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_delete');

        if (!logChannelId) {
            // logger.debug(`[RoleDelete Event] Kein Log-Kanal für 'role_delete' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[RoleDelete Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let deleter = getTranslatedText(lang, 'role_delete.UNKNOWN_DELETER');

        // Versuche, den Löschenden aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.RoleDelete,
                limit: 1,
            });
            const latestRoleDeleteLog = auditLogs.entries.first();

            if (latestRoleDeleteLog && latestRoleDeleteLog.target.id === role.id && latestRoleDeleteLog.executor) {
                const timeDifference = Date.now() - latestRoleDeleteLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    deleter = `${latestRoleDeleteLog.executor.tag} (<@${latestRoleDeleteLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[RoleDelete Event] Fehler beim Abrufen des Audit-Logs für Rollenlöschung von ${role.name}:`, error);
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // Rot für Löschung
            .setTitle(getTranslatedText(lang, 'role_delete.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_delete.LOG_DESCRIPTION', { roleName: role.name, roleId: role.id }))
            .addFields(
                { name: getTranslatedText(lang, 'role_delete.FIELD_NAME'), value: role.name, inline: true },
                { name: getTranslatedText(lang, 'role_delete.FIELD_ID'), value: role.id, inline: true },
                { name: getTranslatedText(lang, 'role_delete.FIELD_DELETED_BY'), value: deleter, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Rollen ID: ${role.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleDelete Event] Rolle '${role.name}' (${role.id}) in Gilde ${guild.name} gelöscht. Löschender: ${deleter}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[RoleDelete Event] Fehler beim Senden des Rollen-Lösch-Logs für ${role.name}:`, error);
        }
    },
};
