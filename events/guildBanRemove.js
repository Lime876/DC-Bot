// events/guildBanRemove.js
import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

// Ein Event-Modul muss ein Standard-Export-Objekt haben,
// das die Eigenschaften 'name' und 'execute' enthält.
export default {
    name: Events.GuildBanRemove,
    async execute(ban) {
        const guild = ban.guild;
        const user = ban.user;
        if (!guild || !user) return; // Stellen Sie sicher, dass Guild und User existieren

        const lang = await getGuildLanguage(guild.id);

        const logChannelId = getLogChannelId(guild.id, 'member_unban');
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[GuildBanRemove Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let moderator = getTranslatedText(lang, 'guild_ban_remove.UNKNOWN_MODERATOR');
        let reason = ban.reason || getTranslatedText(lang, 'guild_ban_remove.NO_REASON_PROVIDED');

        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanRemove,
                limit: 1,
            });
            const latestUnbanLog = auditLogs.entries.first();

            if (latestUnbanLog && latestUnbanLog.target.id === user.id && latestUnbanLog.executor) {
                const timeDifference = Date.now() - latestUnbanLog.createdAt.getTime();
                if (timeDifference < 5000) {
                    moderator = `${latestUnbanLog.executor.tag} (<@${latestUnbanLog.executor.id}>)`;
                    reason = latestUnbanLog.reason || reason;
                }
            }
        } catch (error) {
            logger.error(`[GuildBanRemove Event] Fehler beim Abrufen des Audit-Logs für Entbannung von ${user.tag} (${user.id}):`, error);
        }

        const embed = new EmbedBuilder()
            .setColor(0x32CD32)
            .setTitle(getTranslatedText(lang, 'guild_ban_remove.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'guild_ban_remove.LOG_DESCRIPTION', { userTag: user.tag, userId: user.id }))
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: getTranslatedText(lang, 'guild_ban_remove.FIELD_REASON'), value: reason, inline: false },
                { name: getTranslatedText(lang, 'guild_ban_remove.FIELD_MODERATOR'), value: moderator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: getTranslatedText(lang, 'guild_ban_remove.FOOTER_USER_ID', { userId: user.id }) });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[GuildBanRemove Event] Benutzer ${user.tag} in Gilde ${guild.name} entbannt. Moderator: ${moderator}, Grund: ${reason}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[GuildBanRemove Event] Fehler beim Senden des Entbann-Logs für ${user.tag} (${user.id}):`, error);
        }
    }
};
