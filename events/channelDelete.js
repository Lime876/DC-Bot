// events/channelDelete.js
const { Events, EmbedBuilder, ChannelType, AuditLogEvent, TextChannel } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

// Ticket-Dateipfade
const activeTicketsPath = path.join(__dirname, '../data/activeTickets.json');
const ticketConfigPath = path.join(__dirname, '../data/ticketConfig.json'); // Annahme: ticketConfig.json ist die Datei für Ticket-Einstellungen

// Hilfsfunktion zum Umwandeln des numerischen Kanaltyps in einen lesbaren String (übersetzt)
const getChannelTypeName = (type, lang) => {
    switch (type) {
        case ChannelType.GuildText:
            return getTranslatedText(lang, 'channel_types.TEXT_CHANNEL');
        case ChannelType.GuildVoice:
            return getTranslatedText(lang, 'channel_types.VOICE_CHANNEL');
        case ChannelType.GuildCategory:
            return getTranslatedText(lang, 'channel_types.CATEGORY');
        case ChannelType.GuildAnnouncement:
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
            return getTranslatedText(lang, 'channel_types.UNKNOWN_TYPE', { type: type });
    }
};

// Laden der aktiven Tickets (für Ticket-spezifische Logik)
const loadActiveTickets = () => {
    if (fs.existsSync(activeTicketsPath)) {
        try {
            return JSON.parse(fs.readFileSync(activeTicketsPath, 'utf8'));
        } catch (e) {
            console.error(`[ChannelDelete] Fehler beim Parsen von ${activeTicketsPath}:`, e);
            return {};
        }
    }
    return {};
};

// Speichern der aktiven Tickets (für Ticket-spezifische Logik)
const saveActiveTickets = (tickets) => {
    try {
        fs.writeFileSync(activeTicketsPath, JSON.stringify(tickets, null, 2));
    } catch (e) {
        console.error(`[ChannelDelete] Fehler beim Speichern von ${activeTicketsPath}:`, e);
    }
};

// Laden der Ticket-Konfiguration (für Ticket-spezifische Logik)
const loadTicketConfig = () => { // Umbenannt von loadConfig, um Konflikte zu vermeiden
    if (fs.existsSync(ticketConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(ticketConfigPath, 'utf8'));
        } catch (e) {
            console.error(`[ChannelDelete] Fehler beim Parsen von ${ticketConfigPath}:`, e);
            return {};
        }
    }
    return {};
};


module.exports = {
    name: Events.ChannelDelete,
    async execute(channel, client) {
        // Ignoriere DM-Kanäle
        if (!channel.guild) {
            console.log(`[ChannelDelete DEBUG] Channel ID ${channel.id}: Ignoriert (keine Gilde).`);
            return;
        }

        console.log(`[ChannelDelete DEBUG] Event ausgelöst für Channel ID: ${channel.id}, Name: ${channel.name}.`);

        const guildId = channel.guild.id;
        const lang = getGuildLanguage(guildId);

        // --- Ticket-spezifische Logik ---
        let activeTickets = loadActiveTickets();
        if (activeTickets[channel.id]) {
            const ticketInfo = activeTickets[channel.id];
            delete activeTickets[channel.id];
            saveActiveTickets(activeTickets);

            console.log(`[ChannelDelete DEBUG] Gelöschtes Ticket ${channel.name} (${channel.id}) aus der aktiven Liste entfernt.`);

            // Logge die Ticket-Löschung im allgemeinen Kanal-Delete-Log
            // (oder sende es an einen spezifischen Ticket-Log-Kanal, falls konfiguriert)
            const ticketGuildConfig = loadTicketConfig()[guildId]; // Lade Ticket-Konfig der Gilde
            const ticketLogChannelId = ticketGuildConfig?.logChannelId; // Annahme: logChannelId für Tickets in ticketConfig

            if (ticketLogChannelId) {
                let ticketLogChannel;
                try {
                    ticketLogChannel = await channel.guild.channels.fetch(ticketLogChannelId);
                    if (ticketLogChannel && ticketLogChannel instanceof TextChannel) {
                        const ticketEmbed = new EmbedBuilder()
                            .setColor(0xFF0000) // Rot für Löschung
                            .setTitle(getTranslatedText(lang, 'channel_delete.TICKET_LOG_TITLE'))
                            .setDescription(getTranslatedText(lang, 'channel_delete.TICKET_LOG_DESCRIPTION'))
                            .addFields(
                                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_NAME'), value: `${channel.name}`, inline: true },
                                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_ID'), value: `\`${channel.id}\``, inline: true },
                                { name: getTranslatedText(lang, 'channel_delete.TICKET_LOG_FIELD_OPENER'), value: `<@${ticketInfo.userId}>`, inline: true },
                                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_TYPE'), value: getChannelTypeName(channel.type, lang), inline: true },
                                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_POSITION'), value: `\`${channel.rawPosition || getTranslatedText(lang, 'general.NOT_AVAILABLE')}\``, inline: true },
                                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_PARENT'), value: channel.parent ? channel.parent.name : getTranslatedText(lang, 'general.NONE'), inline: true },
                            )
                            .setTimestamp();
                        await ticketLogChannel.send({ embeds: [ticketEmbed] }).catch(console.error);
                        console.log(`[ChannelDelete DEBUG] Ticket-Löschung an spezifischen Ticket-Log-Kanal gesendet: ${ticketLogChannelId}`);
                    }
                } catch (error) {
                    console.error(`[ChannelDelete] Fehler beim Senden des Ticket-Lösch-Logs an ${ticketLogChannelId}:`, error);
                }
            } else {
                 console.log(`[ChannelDelete DEBUG] Kein spezifischer Ticket-Log-Kanal konfiguriert für Gilde ${guildId}.`);
            }
        }

        // --- Allgemeine Kanal-Lösch-Logik ---
        const logChannelId = getLogChannelId(guildId, 'channel_delete'); // Holt den allgemeinen Kanal-Lösch-Log-Kanal

        if (!logChannelId) {
            console.log(`[ChannelDelete DEBUG] Channel ID ${channel.id}: Kein allgemeiner Log-Kanal für 'channel_delete' in Gilde ${guildId} konfiguriert.`);
            return;
        }

        let logChannel;
        try {
            logChannel = await channel.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[ChannelDelete] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${channel.guild.name} ist kein Textkanal oder nicht mehr vorhanden.`);
                return;
            }
        } catch (error) {
            console.error(`[ChannelDelete] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return;
        }

        let deleter = null; // Wer den Kanal gelöscht hat

        // Versuche, den Löschenden über den Audit Log zu identifizieren
        try {
            const auditLogs = await channel.guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 1,
            });
            const latestLog = auditLogs.entries.first();

            // Prüfe, ob der Log-Eintrag aktuell ist und zu diesem Kanal passt
            // (Die target.id des Audit Logs ist hier die ID des gelöschten Kanals)
            if (latestLog &&
                latestLog.target.id === channel.id &&
                Date.now() - latestLog.createdTimestamp < 5000) // Innerhalb von 5 Sekunden
            {
                deleter = latestLog.executor; // Der Benutzer, der die Aktion ausgeführt hat
            }
        } catch (error) {
            console.error(`[ChannelDelete] Fehler beim Abrufen des Audit Logs:`, error);
        }

        const deleterName = deleter ? (deleter.tag || deleter.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const deleterId = deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN');

        const embed = new EmbedBuilder()
            .setTitle(getTranslatedText(lang, 'channel_delete.LOG_TITLE'))
            .setColor(0xFF0000) // Rot für Löschung
            .setDescription(getTranslatedText(lang, 'channel_delete.LOG_DESCRIPTION', {
                channelName: channel.name,
                channelId: channel.id,
                deleterName: deleterName
            }))
            .addFields(
                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_NAME'), value: channel.name || getTranslatedText(lang, 'general.UNNAMED'), inline: true },
                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_TYPE'), value: getChannelTypeName(channel.type, lang), inline: true },
                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_ID'), value: channel.id.toString(), inline: true },
                { name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_DELETER'), value: `${deleterName} (${deleterId})`, inline: false }
            )
            .setTimestamp();
        
        // Füge Parent-Kategorie hinzu, falls vorhanden
        if (channel.parentId) {
            try {
                const parentChannel = await channel.guild.channels.fetch(channel.parentId);
                if (parentChannel) {
                    embed.addFields({ name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_PARENT'), value: `${parentChannel.name} (${parentChannel.id})`, inline: true });
                }
            } catch (e) {
                console.warn(`[ChannelDelete] Konnte Parent-Kanal ${channel.parentId} nicht abrufen.`);
            }
        }

        // Füge Position hinzu
        embed.addFields({ name: getTranslatedText(lang, 'channel_delete.LOG_FIELD_POSITION'), value: `\`${channel.rawPosition || getTranslatedText(lang, 'general.NOT_AVAILABLE')}\``, inline: true });

        // --- DEBUG: Dies wird geloggt, wenn der Bot versucht, das allgemeine Embed zu senden ---
        console.log(`[ChannelDelete DEBUG] Versuche allgemeines Embed an Log-Kanal ${logChannel.id} zu senden.`);
        // --- END DEBUG ---

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[ChannelDelete] Fehler beim Senden des allgemeinen Kanal-Lösch-Embeds an den Log-Kanal:`, error);
        }
    },
};
