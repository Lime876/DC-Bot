// events/guildBanAdd.js
const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        const guild = ban.guild;
        const user = ban.user;
        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'member_ban');

        if (!logChannelId) {
            // logger.debug(`[GuildBanAdd Event] Kein Log-Kanal für 'member_ban' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[GuildBanAdd Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let moderator = getTranslatedText(lang, 'guild_ban_add.UNKNOWN_MODERATOR');
        let reason = ban.reason || getTranslatedText(lang, 'guild_ban_add.NO_REASON_PROVIDED');

        // Versuche, den Moderator und den Grund aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 1,
            });
            const latestBanLog = auditLogs.entries.first();

            if (latestBanLog && latestBanLog.target.id === user.id && latestBanLog.executor) {
                // Überprüfe den Zeitstempel, um sicherzustellen, dass es sich um den aktuellen Bann handelt
                const timeDifference = Date.now() - latestBanLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    moderator = `${latestBanLog.executor.tag} (<@${latestBanLog.executor.id}>)`;
                    reason = latestBanLog.reason || reason;
                }
            }
        } catch (error) {
            logger.error(`[GuildBanAdd Event] Fehler beim Abrufen des Audit-Logs für Bann von ${user.tag}:`, error);
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF4500) // Orange-Rot für Bann
            .setTitle(getTranslatedText(lang, 'guild_ban_add.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'guild_ban_add.LOG_DESCRIPTION', { userTag: user.tag, userId: user.id }))
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: getTranslatedText(lang, 'guild_ban_add.FIELD_REASON'), value: reason, inline: false },
                { name: getTranslatedText(lang, 'guild_ban_add.FIELD_MODERATOR'), value: moderator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Benutzer ID: ${user.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[GuildBanAdd Event] Benutzer ${user.tag} in Gilde ${guild.name} gebannt. Moderator: ${moderator}, Grund: ${reason}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[GuildBanAdd Event] Fehler beim Senden des Bann-Logs für ${user.tag}:`, error);
        }
    },
};
