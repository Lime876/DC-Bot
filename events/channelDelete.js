// events/channelDelete.js
const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        const guild = channel.guild;
        if (!guild) {
            // Event außerhalb einer Gilde ignoriert (z.B. DM-Kanäle)
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'channel_delete');

        if (!logChannelId) {
            // logger.debug(`[ChannelDelete Event] Kein Log-Kanal für 'channel_delete' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[ChannelDelete Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let deleter = getTranslatedText(lang, 'channel_delete.UNKNOWN_DELETER');
        let categoryName = channel.parent ? channel.parent.name : getTranslatedText(lang, 'channel_delete.NO_CATEGORY');

        // Versuche, den Löschenden aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 1,
            });
            const latestChannelDeleteLog = auditLogs.entries.first();

            if (latestChannelDeleteLog && latestChannelDeleteLog.target.id === channel.id && latestChannelDeleteLog.executor) {
                const timeDifference = Date.now() - latestChannelDeleteLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    deleter = `${latestChannelDeleteLog.executor.tag} (<@${latestChannelDeleteLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[ChannelDelete Event] Fehler beim Abrufen des Audit-Logs für Kanallöschung von ${channel.name}:`, error);
        }

        const channelTypeMap = {
            [ChannelType.GuildText]: getTranslatedText(lang, 'channel_types.TEXT_CHANNEL'),
            [ChannelType.GuildVoice]: getTranslatedText(lang, 'channel_types.VOICE_CHANNEL'),
            [ChannelType.GuildCategory]: getTranslatedText(lang, 'channel_types.CATEGORY'),
            [ChannelType.GuildAnnouncement]: getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_CHANNEL'),
            [ChannelType.GuildForum]: getTranslatedText(lang, 'channel_types.FORUM_CHANNEL'),
            [ChannelType.GuildStageVoice]: getTranslatedText(lang, 'channel_types.STAGE_CHANNEL'),
            [ChannelType.GuildDirectory]: getTranslatedText(lang, 'channel_types.DIRECTORY_CHANNEL'),
            [ChannelType.GuildMedia]: getTranslatedText(lang, 'channel_types.MEDIA_CHANNEL'),
            [ChannelType.PrivateThread]: getTranslatedText(lang, 'channel_types.PRIVATE_THREAD'),
            [ChannelType.PublicThread]: getTranslatedText(lang, 'channel_types.PUBLIC_THREAD'),
            [ChannelType.AnnouncementThread]: getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_THREAD')
        };
        const channelType = channelTypeMap[channel.type] || getTranslatedText(lang, 'channel_types.UNKNOWN_TYPE', { type: channel.type });

        const embed = new EmbedBuilder()
            .setColor(0xFF0000) // Rot für Löschung
            .setTitle(getTranslatedText(lang, 'channel_delete.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'channel_delete.LOG_DESCRIPTION', { channelName: channel.name, channelId: channel.id }))
            .addFields(
                { name: getTranslatedText(lang, 'channel_delete.FIELD_TYPE'), value: channelType, inline: true },
                { name: getTranslatedText(lang, 'channel_delete.FIELD_CATEGORY'), value: categoryName, inline: true },
                { name: getTranslatedText(lang, 'channel_delete.FIELD_DELETED_BY'), value: deleter, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${channel.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[ChannelDelete Event] Kanal '${channel.name}' (${channelType}) in Gilde ${guild.name} gelöscht. Löschender: ${deleter}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[ChannelDelete Event] Fehler beim Senden des Kanal-Lösch-Logs für ${channel.name}:`, error);
        }
    },
};
