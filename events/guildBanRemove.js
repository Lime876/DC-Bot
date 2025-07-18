// events/guildBanRemove.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        const guild = ban.guild;
        const user = ban.user;
        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'member_unban');

        if (!logChannelId) {
            // logger.debug(`[GuildBanRemove Event] Kein Log-Kanal für 'member_unban' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[GuildBanRemove Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let moderator = getTranslatedText(lang, 'guild_ban_remove.UNKNOWN_MODERATOR');
        let reason = ban.reason || getTranslatedText(lang, 'guild_ban_remove.NO_REASON_PROVIDED');

        // Versuche, den Moderator und den Grund aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanRemove,
                limit: 1,
            });
            const latestUnbanLog = auditLogs.entries.first();

            if (latestUnbanLog && latestUnbanLog.target.id === user.id && latestUnbanLog.executor) {
                // Überprüfe den Zeitstempel, um sicherzustellen, dass es sich um den aktuellen Entbann handelt
                const timeDifference = Date.now() - latestUnbanLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    moderator = `${latestUnbanLog.executor.tag} (<@${latestUnbanLog.executor.id}>)`;
                    reason = latestUnbanLog.reason || reason;
                }
            }
        } catch (error) {
            logger.error(`[GuildBanRemove Event] Fehler beim Abrufen des Audit-Logs für Entbannung von ${user.tag}:`, error);
        }

        const embed = new EmbedBuilder()
            .setColor(0x32CD32) // Hellgrün für Entbannung
            .setTitle(getTranslatedText(lang, 'guild_ban_remove.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'guild_ban_remove.LOG_DESCRIPTION', { userTag: user.tag, userId: user.id }))
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: getTranslatedText(lang, 'guild_ban_remove.FIELD_REASON'), value: reason, inline: false },
                { name: getTranslatedText(lang, 'guild_ban_remove.FIELD_MODERATOR'), value: moderator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Benutzer ID: ${user.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[GuildBanRemove Event] Benutzer ${user.tag} in Gilde ${guild.name} entbannt. Moderator: ${moderator}, Grund: ${reason}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[GuildBanRemove Event] Fehler beim Senden des Entbann-Logs für ${user.tag}:`, error);
        }
    },
};
