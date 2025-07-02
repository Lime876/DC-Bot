// events/messageDelete.js
const { Events, EmbedBuilder, AuditLogEvent, TextChannel, PermissionsBitField } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const { spamDeletedMessageIds } = require('../utils/sharedState'); // NEU: Importiere den Set aus utils/sharedState

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        console.log(`[Message Delete DEBUG] Event ausgelöst für Nachricht ID: ${message.id} im Kanal ${message.channel.id}.`);

        // Prüfe, ob diese Nachricht gerade vom Spam-Filter gelöscht wurde
        if (spamDeletedMessageIds.has(message.id)) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Wurde vom Spam-Filter gelöscht. Überspringe Log in messageDelete.`);
            spamDeletedMessageIds.delete(message.id);
            return;
        }

        if (message.partial) {
            try {
                message = await message.fetch();
                console.log(`[Message Delete DEBUG] Nachricht ${message.id} erfolgreich vollständig abgerufen.`);
            } catch (error) {
                console.warn(`[Message Delete] Konnte Nachricht ${message.id} nicht vollständig abrufen (partial). Grund: ${error.message}`);
            }
        }

        if (!message.guild || !message.channel.isTextBased()) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Ignoriert (keine Gilde oder kein Textkanal).`);
            return;
        }

        if (message.author?.bot) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Ignoriert (Bot-Nachricht).`);
            return;
        }

        const lang = getGuildLanguage(message.guild.id);
        const logChannelId = getLogChannelId(message.guild.id, 'message_delete');

        if (!logChannelId) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Kein Log-Kanal für 'message_delete' in Gilde ${message.guild.id} konfiguriert.`);
            return;
        }

        let logChannel;
        try {
            logChannel = await message.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[Message Delete] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${message.guild.id} ist kein Textkanal oder nicht mehr vorhanden.`);
                return;
            }
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return;
        }

        let embed;
        let deleter = null;
        let author = message.author;

        try {
            const auditLogs = await message.guild.fetchAuditLogs({
                type: AuditLogEvent.MessageDelete,
                limit: 10,
            });

            const relevantLog = auditLogs.entries.find(
                auditLog =>
                    auditLog.extra.channel.id === message.channel.id &&
                    (auditLog.target.id === (author ? author.id : auditLog.target.id)) &&
                    (Date.now() - auditLog.createdTimestamp < 5000)
            );

            if (relevantLog) {
                deleter = relevantLog.executor;
                if (!author && relevantLog.target) {
                    author = relevantLog.target;
                }
            }
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Abrufen des Audit Logs:`, error);
        }

        const channelMention = message.channel instanceof TextChannel ? message.channel.toString() : `#${message.channel.name}`;
        const messageContent = (message.content && message.content.length > 0)
            ? message.content.substring(0, 1024)
            : getTranslatedText(lang, 'message_delete.NO_CONTENT');

        const authorName = author ? (author.tag || author.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const authorId = author ? author.id : getTranslatedText(lang, 'general.UNKNOWN');
        const deleterName = deleter ? (deleter.tag || deleter.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const deleterId = deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN');

        if (deleter && deleter.id !== authorId) {
            embed = new EmbedBuilder()
                .setTitle(getTranslatedText(lang, 'message_delete.LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_MOD_DELETED', {
                    authorName: authorName,
                    channelMention: channelMention,
                    deleterName: deleterName
                }))
                .setColor(0xFF0000)
                .addFields(
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${authorName} (${authorId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: channelMention, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_DELETER'), value: `${deleterName} (${deleterId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: messageContent }
                )
                .setTimestamp();
        } else {
            embed = new EmbedBuilder()
                .setTitle(getTranslatedText(lang, 'message_delete.LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_USER_DELETED', {
                    authorName: authorName,
                    channelMention: channelMention
                }))
                .setColor(0xFFA500)
                .addFields(
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${authorName} (${authorId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: channelMention, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: messageContent }
                )
                .setTimestamp();
        }

        console.log(`[Message Delete DEBUG] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Senden des Embeds an den Log-Kanal:`, error);
        }
    },
};
