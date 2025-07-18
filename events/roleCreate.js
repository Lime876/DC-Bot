// events/roleCreate.js
const { Events, EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildRoleCreate,
    async execute(role) {
        const guild = role.guild;
        if (!guild) {
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'role_create');

        if (!logChannelId) {
            // logger.debug(`[RoleCreate Event] Kein Log-Kanal für 'role_create' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[RoleCreate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let creator = getTranslatedText(lang, 'role_create.UNKNOWN_CREATOR');

        // Versuche, den Ersteller aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.RoleCreate,
                limit: 1,
            });
            const latestRoleCreateLog = auditLogs.entries.first();

            if (latestRoleCreateLog && latestRoleCreateLog.target.id === role.id && latestRoleCreateLog.executor) {
                const timeDifference = Date.now() - latestRoleCreateLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    creator = `${latestRoleCreateLog.executor.tag} (<@${latestRoleCreateLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[RoleCreate Event] Fehler beim Abrufen des Audit-Logs für Rollenerstellung von ${role.name}:`, error);
        }

        const permissions = role.permissions.toArray();
        const permissionNames = permissions.length > 0
            ? permissions.map(p => getTranslatedText(lang, `permissions.${p.toUpperCase()}`) || p).join(', ')
            : getTranslatedText(lang, 'role_create.NO_PERMISSIONS');

        const embed = new EmbedBuilder()
            .setColor(role.color || 0x00FF00) // Rolle Farbe oder Grün
            .setTitle(getTranslatedText(lang, 'role_create.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'role_create.LOG_DESCRIPTION', { roleName: role.name }))
            .addFields(
                { name: getTranslatedText(lang, 'role_create.FIELD_NAME'), value: role.name, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_ID'), value: role.id, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_COLOR'), value: role.hexColor, inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_MENTIONABLE'), value: role.mentionable ? 'Ja' : 'Nein', inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_HOISTED'), value: role.hoist ? 'Ja' : 'Nein', inline: true },
                { name: getTranslatedText(lang, 'role_create.FIELD_PERMISSIONS'), value: permissionNames, inline: false },
                { name: getTranslatedText(lang, 'role_create.FIELD_CREATED_BY'), value: creator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Rollen ID: ${role.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[RoleCreate Event] Rolle '${role.name}' in Gilde ${guild.name} erstellt. Ersteller: ${creator}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[RoleCreate Event] Fehler beim Senden des Rollen-Erstellungs-Logs für ${role.name}:`, error);
        }
    },
};
