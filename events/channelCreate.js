// events/channelCreate.js
const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        const guild = channel.guild;
        if (!guild) {
            // Event außerhalb einer Gilde ignoriert (z.B. DM-Kanäle)
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'channel_create');

        if (!logChannelId) {
            // logger.debug(`[ChannelCreate Event] Kein Log-Kanal für 'channel_create' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[ChannelCreate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let creator = getTranslatedText(lang, 'channel_create.UNKNOWN_CREATOR');

        // Versuche, den Ersteller aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelCreate,
                limit: 1,
            });
            const latestChannelCreateLog = auditLogs.entries.first();

            if (latestChannelCreateLog && latestChannelCreateLog.target.id === channel.id && latestChannelCreateLog.executor) {
                const timeDifference = Date.now() - latestChannelCreateLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    creator = `${latestChannelCreateLog.executor.tag} (<@${latestChannelCreateLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[ChannelCreate Event] Fehler beim Abrufen des Audit-Logs für Kanalerstellung von ${channel.name}:`, error);
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
        const categoryName = channel.parent ? channel.parent.name : getTranslatedText(lang, 'channel_create.NO_CATEGORY');

        const embed = new EmbedBuilder()
            .setColor(0x00FF00) // Grün für Erstellung
            .setTitle(getTranslatedText(lang, 'channel_create.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'channel_create.LOG_DESCRIPTION', { channelName: channel.name, channelId: channel.id }))
            .addFields(
                { name: getTranslatedText(lang, 'channel_create.FIELD_TYPE'), value: channelType, inline: true },
                { name: getTranslatedText(lang, 'channel_create.FIELD_CATEGORY'), value: categoryName, inline: true },
                { name: getTranslatedText(lang, 'channel_create.FIELD_CREATED_BY'), value: creator, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${channel.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[ChannelCreate Event] Kanal '${channel.name}' (${channelType}) in Gilde ${guild.name} erstellt. Ersteller: ${creator}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[ChannelCreate Event] Fehler beim Senden des Kanal-Erstellungs-Logs für ${channel.name}:`, error);
        }
    },
};
