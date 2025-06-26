// events/channelCreate.js
const { Events, EmbedBuilder, ChannelType, AuditLogEvent, TextChannel } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Importiere die Funktion aus config.js
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

// Funktion zum Umwandeln des numerischen Kanaltyps in einen lesbaren String (übersetzt)
const getChannelTypeName = (type, lang) => {
    switch (type) {
        case ChannelType.GuildText:
            return getTranslatedText(lang, 'channel_types.TEXT_CHANNEL');
        case ChannelType.GuildVoice:
            return getTranslatedText(lang, 'channel_types.VOICE_CHANNEL');
        case ChannelType.GuildCategory:
            return getTranslatedText(lang, 'channel_types.CATEGORY');
        case ChannelType.GuildAnnouncement: // früher NEWS
            return getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_CHANNEL');
        case ChannelType.GuildForum:
            return getTranslatedText(lang, 'channel_types.FORUM_CHANNEL');
        case ChannelType.GuildStageVoice:
            return getTranslatedText(lang, 'channel_types.STAGE_CHANNEL');
        case ChannelType.GuildDirectory:
            return getTranslatedText(lang, 'channel_types.DIRECTORY_CHANNEL');
        case ChannelType.GuildMedia:
            return getTranslatedText(lang, 'channel_types.MEDIA_CHANNEL');
        case ChannelType.PrivateThread:
            return getTranslatedText(lang, 'channel_types.PRIVATE_THREAD');
        case ChannelType.PublicThread:
            return getTranslatedText(lang, 'channel_types.PUBLIC_THREAD');
        case ChannelType.AnnouncementThread:
            return getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_THREAD');
        default:
            return getTranslatedText(lang, 'channel_types.UNKNOWN_TYPE', { type: type }); // Für den Fall, dass ein neuer Typ hinzugefügt wird
    }
};

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel, client) {
        // Ignoriere DM-Kanäle
        if (!channel.guild) {
            console.log(`[ChannelCreate DEBUG] Channel ID ${channel.id}: Ignoriert (keine Gilde).`);
            return;
        }

        console.log(`[ChannelCreate DEBUG] Event ausgelöst für Channel ID: ${channel.id}, Name: ${channel.name}.`);

        const lang = getGuildLanguage(channel.guild.id);
        const logChannelId = getLogChannelId(channel.guild.id, 'channel_create');

        if (!logChannelId) {
            console.log(`[ChannelCreate DEBUG] Channel ID ${channel.id}: Kein Log-Kanal für 'channel_create' in Gilde ${channel.guild.id} konfiguriert.`);
            return;
        }

        let logChannel;
        try {
            logChannel = await channel.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[ChannelCreate] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${channel.guild.name} ist kein Textkanal oder nicht mehr vorhanden.`);
                return;
            }
        } catch (error) {
            console.error(`[ChannelCreate] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return;
        }

        let creator = null; // Wer den Kanal erstellt hat

        // Versuche, den Ersteller über den Audit Log zu identifizieren
        try {
            const auditLogs = await channel.guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelCreate,
                limit: 1,
            });
            const latestLog = auditLogs.entries.first();

            // Prüfe, ob der Log-Eintrag aktuell ist und zu diesem Kanal passt
            if (latestLog &&
                latestLog.target.id === channel.id &&
                Date.now() - latestLog.createdTimestamp < 5000) // Innerhalb von 5 Sekunden
            {
                creator = latestLog.executor; // Der Benutzer, der die Aktion ausgeführt hat
            }
        } catch (error) {
            console.error(`[ChannelCreate] Fehler beim Abrufen des Audit Logs:`, error);
        }

        const creatorName = creator ? (creator.tag || creator.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const creatorId = creator ? creator.id : getTranslatedText(lang, 'general.UNKNOWN');

        const embed = new EmbedBuilder()
            .setTitle(getTranslatedText(lang, 'channel_create.LOG_TITLE'))
            .setColor(0x57f287) // Grün für Erstellung
            .setDescription(getTranslatedText(lang, 'channel_create.LOG_DESCRIPTION', {
                channelName: channel.name,
                channelMention: channel.toString(),
                channelId: channel.id
            }))
            .addFields(
                { name: getTranslatedText(lang, 'channel_create.LOG_FIELD_NAME'), value: channel.name || getTranslatedText(lang, 'general.UNNAMED'), inline: true },
                { name: getTranslatedText(lang, 'channel_create.LOG_FIELD_TYPE'), value: getChannelTypeName(channel.type, lang), inline: true },
                { name: getTranslatedText(lang, 'channel_create.LOG_FIELD_ID'), value: channel.id.toString(), inline: true },
                { name: getTranslatedText(lang, 'channel_create.LOG_FIELD_CREATOR'), value: `${creatorName} (${creatorId})`, inline: false }
            )
            .setTimestamp();
        
        // Füge Parent-Kategorie hinzu, falls vorhanden
        if (channel.parentId) {
            try {
                const parentChannel = await channel.guild.channels.fetch(channel.parentId);
                if (parentChannel) {
                    embed.addFields({ name: getTranslatedText(lang, 'channel_create.LOG_FIELD_PARENT'), value: `${parentChannel.name} (${parentChannel.id})`, inline: true });
                }
            } catch (e) {
                console.warn(`[ChannelCreate] Konnte Parent-Kanal ${channel.parentId} nicht abrufen.`);
            }
        }

        // --- DEBUG: Dies wird geloggt, wenn der Bot versucht, das Embed zu senden ---
        console.log(`[ChannelCreate DEBUG] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);
        // --- END DEBUG ---

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[ChannelCreate] Fehler beim Senden des Embeds an den Log-Kanal:`, error);
        }
    },
};
