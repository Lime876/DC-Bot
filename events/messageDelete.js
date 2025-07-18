// events/messageDelete.js
const { Events, AuditLogEvent } = require('discord.js');
const { getTranslatedText, getGuildLanguage } = require('../utils/languageUtils');
const { logEvent } = require('../utils/logUtils');
const logger = require('../utils/logger'); // Importiere den neuen Logger

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        logger.debug(`[Message Delete DEBUG] Event ausgelöst für Nachricht ID: ${message.id} im Kanal ${message.channel.id}.`);

        // Ignoriere DM-Nachrichten
        if (!message.guild) {
            logger.debug(`[Message Delete DEBUG] Nachricht ID ${message.id}: Ignoriert (keine Gilde).`);
            return;
        }

        const lang = await getGuildLanguage(message.guild.id);
        let deleter = null; // Der Benutzer, der die Nachricht gelöscht hat
        let reason = null; // Grund der Löschung

        // Wenn die Nachricht partiell ist, versuche, sie vollständig abzurufen
        if (message.partial) {
            try {
                // Versuche, die vollständige Nachricht abzurufen
                await message.fetch();
                logger.debug(`[Message Delete DEBUG] Nachricht ID ${message.id}: Erfolgreich vollständig abgerufen.`);
            } catch (error) {
                logger.error(`[Message Delete] Konnte Nachricht ${message.id} nicht vollständig abrufen (partial). Grund: ${error.message}`);
                // Wenn das Abrufen fehlschlägt, können wir nicht alle Details erhalten.
                // Wir loggen nur die verfügbaren Informationen und beenden die Funktion.
                await logEvent(message.guild.id, 'message_delete', {
                    logTitle: getTranslatedText(lang, 'message_delete.LOG_TITLE'),
                    logDescription: getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_USER_DELETED', {
                        authorTag: message.author ? message.author.tag : getTranslatedText(lang, 'general.UNKNOWN_USER'),
                        authorId: message.author ? message.author.id : getTranslatedText(lang, 'general.UNKNOWN_ID'),
                        channelMention: message.channel.toString()
                    }),
                    fields: [
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: message.author ? `${message.author.tag} (${message.author.id})` : getTranslatedText(lang, 'general.UNKNOWN'), inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false } // Inhalt ist bei partiellen Nachrichten oft nicht verfügbar
                    ]
                });
                return;
            }
        }

        // Versuche, den Löschenden über den Audit Log zu finden
        try {
            const auditLogs = await message.guild.fetchAuditLogs({
                type: AuditLogEvent.MessageDelete,
                limit: 1,
            });
            const entry = auditLogs.entries.find(
                (e) =>
                e.target.id === message.author.id &&
                e.extra.channel.id === message.channel.id &&
                Date.now() - e.createdTimestamp < 5000 // Innerhalb der letzten 5 Sekunden
            );

            if (entry) {
                deleter = entry.executor;
                reason = entry.reason;
            }
        } catch (error) {
            logger.error(`[Message Delete] Fehler beim Abrufen des Audit Logs:`, error);
        }

        // Bestimme den Typ der Löschung und logge entsprechend
        let logDescriptionKey = 'message_delete.LOG_DESCRIPTION_USER_DELETED';
        const fields = [
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
        ];

        if (deleter && deleter.id !== client.user.id && deleter.id !== message.author.id) {
            logDescriptionKey = 'message_delete.LOG_DESCRIPTION_MOD_DELETED';
            fields.push({ name: getTranslatedText(lang, 'message_delete.LOG_FIELD_DELETER'), value: `${deleter.tag} (${deleter.id})`, inline: true });
            if (reason) {
                fields.push({ name: getTranslatedText(lang, 'general.REASON'), value: reason, inline: false });
            }
        } else if (deleter && deleter.id === client.user.id) {
            logDescriptionKey = 'message_delete.LOG_DESCRIPTION_BOT_DELETED';
            if (reason) {
                fields.push({ name: getTranslatedText(lang, 'general.REASON'), value: reason, inline: false });
            }
        }

        await logEvent(message.guild.id, 'message_delete', {
            logTitle: getTranslatedText(lang, 'message_delete.LOG_TITLE'),
            logDescription: getTranslatedText(lang, logDescriptionKey, {
                authorTag: message.author.tag,
                authorId: message.author.id,
                channelMention: message.channel.toString(),
                deleterTag: deleter ? deleter.tag : getTranslatedText(lang, 'general.UNKNOWN'),
                deleterId: deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN_ID')
            }),
            fields: fields
        });
    },
};
