// events/messageDelete.js
const { Events, EmbedBuilder, AuditLogEvent, TextChannel } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // --- DEBUG: Dies wird IMMER geloggt, wenn das messageDelete Event ausgelöst wird ---
        console.log(`[Message Delete DEBUG] Event ausgelöst für Nachricht ID: ${message.id} im Kanal ${message.channel.id}.`);
        // --- END DEBUG ---

        // Prüfe, ob die Nachricht unvollständig ist (z.B. nicht im Cache des Bots).
        // Wenn ja, versuchen wir, sie vollständig abzurufen, um Author und Content zu erhalten.
        if (message.partial) {
            try {
                // Beachte, dass .fetch() fehlschlagen kann, wenn die Nachricht zu alt ist
                // oder wenn der Bot nicht die erforderlichen Intents hat (MESSAGE CONTENT INTENT).
                message = await message.fetch();
                console.log(`[Message Delete DEBUG] Nachricht ${message.id} erfolgreich vollständig abgerufen.`);
            } catch (error) {
                console.warn(`[Message Delete] Konnte Nachricht ${message.id} nicht vollständig abrufen (partial). Grund: ${error.message}`);
                // Wenn das Abrufen fehlschlägt, fahren wir mit den verfügbaren Daten fort,
                // was bedeutet, dass message.author und message.content möglicherweise nicht verfügbar sind.
            }
        }

        // Ignoriere private Nachrichten oder Nachrichten, die nicht in einem Guild-Textkanal sind
        if (!message.guild || !message.channel.isTextBased()) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Ignoriert (keine Gilde oder kein Textkanal).`);
            return;
        }

        // Ignoriere Nachrichten von Bots, um unnötige Logs zu vermeiden.
        // Dies geschieht NACH der partial-Prüfung, da der Author bei partial-Nachrichten anfangs null sein könnte.
        if (message.author?.bot) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Ignoriert (Bot-Nachricht).`);
            return;
        }

        const lang = getGuildLanguage(message.guild.id);
        const logChannelId = getLogChannelId(message.guild.id, 'message_delete');

        if (!logChannelId) {
            console.log(`[Message Delete DEBUG] Nachricht ID ${message.id}: Kein Log-Kanal für 'message_delete' in Gilde ${message.guild.id} konfiguriert.`);
            return; // Kein Log-Kanal konfiguriert
        }

        let logChannel;
        try {
            logChannel = await message.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[Message Delete] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${message.guild.id} ist kein Textkanal oder nicht mehr vorhanden.`);
                return; // Kanal nicht gefunden oder ist kein Textkanal
            }
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return; // Fehler beim Abrufen des Kanals
        }

        let embed;
        let deleter = null; // Wer die Nachricht gelöscht hat
        let author = message.author; // Autor der gelöschten Nachricht (kann null sein, wenn partial fetch fehlschlägt)

        // Versuche, den Löschenden und den ursprünglichen Autor über den Audit Log zu identifizieren
        try {
            const auditLogs = await message.guild.fetchAuditLogs({
                type: AuditLogEvent.MessageDelete,
                limit: 10, // Erhöhe das Limit, um auch Bulk-Löschungen oder kurz hintereinander folgende Löschungen zu erfassen
            });

            // Finde den relevanten Audit-Log-Eintrag
            // Wir suchen nach einem Eintrag, der den Kanal der gelöschten Nachricht betrifft
            // und innerhalb der letzten 5 Sekunden erstellt wurde.
            // Außerdem prüfen wir, ob die gelöschte Nachricht die Target-ID des Audit Logs ist,
            // oder ob es eine Massenlöschung im selben Kanal ist, die den Author matcht.
            const relevantLog = auditLogs.entries.find(
                auditLog =>
                    auditLog.extra.channel.id === message.channel.id &&
                    (auditLog.target.id === (author ? author.id : auditLog.target.id)) && // Prüft, ob der Target-User der Author ist (wenn bekannt), oder ignoriert diese Prüfung, wenn Author unbekannt
                    (Date.now() - auditLog.createdTimestamp < 5000) // Innerhalb von 5 Sekunden
            );

            if (relevantLog) {
                deleter = relevantLog.executor; // Der Benutzer, der die Aktion ausgeführt hat
                // Wenn der Autor der Nachricht nicht im Cache war (message.author ist null),
                // und der Audit Log einen Target-Benutzer hat, verwenden wir diesen als Autor.
                if (!author && relevantLog.target) {
                    author = relevantLog.target;
                }
            }
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Abrufen des Audit Logs:`, error);
            // In diesem Fall bleibt 'deleter' null und 'author' bleibt, was immer im 'message' Objekt war.
        }

        const channelMention = message.channel instanceof TextChannel ? message.channel.toString() : `#${message.channel.name}`;
        // Verwende den vollständigen Inhalt, wenn verfügbar, sonst den Fallback
        const messageContent = (message.content && message.content.length > 0)
            ? message.content.substring(0, 1024) // Begrenze auf 1024 Zeichen für Embed-Feld
            : getTranslatedText(lang, 'message_delete.NO_CONTENT');

        const authorName = author ? (author.tag || author.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const authorId = author ? author.id : getTranslatedText(lang, 'general.UNKNOWN');
        const deleterName = deleter ? (deleter.tag || deleter.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
        const deleterId = deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN');

        if (deleter && deleter.id !== authorId) { // Nachricht von einem Moderator/Admin gelöscht
            embed = new EmbedBuilder()
                .setTitle(getTranslatedText(lang, 'message_delete.LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_MOD_DELETED', {
                    authorName: authorName,
                    channelMention: channelMention,
                    deleterName: deleterName
                }))
                .setColor(0xFF0000) // Rot für Löschung
                .addFields(
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${authorName} (${authorId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: channelMention, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_DELETER'), value: `${deleterName} (${deleterId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: messageContent }
                )
                .setTimestamp();
        } else { // Nachricht vom Autor selbst oder unbekannter Löschvorgang
            embed = new EmbedBuilder()
                .setTitle(getTranslatedText(lang, 'message_delete.LOG_TITLE'))
                .setDescription(getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_USER_DELETED', {
                    authorName: authorName,
                    channelMention: channelMention
                }))
                .setColor(0xFFA500) // Orange für normale Löschung
                .addFields(
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${authorName} (${authorId})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: channelMention, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: messageContent }
                )
                .setTimestamp();
        }

        // --- DEBUG: Dies wird geloggt, wenn der Bot versucht, das Embed zu senden ---
        console.log(`[Message Delete DEBUG] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);
        // --- END DEBUG ---

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[Message Delete] Fehler beim Senden des Embeds an den Log-Kanal:`, error);
        }
    },
};
