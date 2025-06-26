// events/messageUpdate.js
const { Events, EmbedBuilder, TextChannel, GatewayIntentBits } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

// Hilfsfunktion zum Kürzen von Texten
const truncate = (str, len) => {
    if (!str) return ''; // Standardwert, wenn str null oder undefined ist
    if (str.length > len) {
        return `${str.substring(0, len - 3)}...`;
    }
    return str;
};

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // --- DEBUG: Dies wird IMMER geloggt, wenn das messageUpdate Event ausgelöst wird ---
        console.log(`[Message Update DEBUG] Event ausgelöst für Nachricht ID: ${newMessage.id} im Kanal ${newMessage.channel.id}.`);
        // --- END DEBUG ---

        // Ignoriere Nachrichten, die vom Bot selbst stammen, oder wenn sie nicht in einem Guild-Kanal sind.
        if (!newMessage.guild || newMessage.author?.bot) {
            console.log(`[Message Update DEBUG] Nachricht ID ${newMessage.id}: Ignoriert (keine Gilde oder Bot-Nachricht).`);
            return;
        }

        // --- Behandlung unvollständiger Nachrichten (partial messages) ---
        // Wenn oldMessage unvollständig ist (d.h. nicht im Cache des Bots war),
        // versuchen wir, sie vollständig abzurufen.
        if (oldMessage.partial) {
            try {
                oldMessage = await oldMessage.fetch();
                console.log(`[Message Update DEBUG] Alte Nachricht ${oldMessage.id} erfolgreich vollständig abgerufen.`);
            } catch (error) {
                console.warn(`[Message Update] Konnte alte Nachricht ${oldMessage.id} nicht vollständig abrufen. Fahre mit verfügbaren Daten fort:`, error.message);
                // Wenn fetch fehlschlägt, können wir nur mit dem arbeiten, was wir haben.
                // In diesem Fall könnte oldMessage.content fehlen.
            }
        }

        // Ignoriere, wenn sich der Inhalt der Nachricht nicht geändert hat.
        // Dies geschieht NACH dem potenziellen fetch, um sicherzustellen, dass oldMessage.content aktuell ist.
        if (oldMessage.content === newMessage.content) {
            console.log(`[Message Update DEBUG] Nachricht ID ${newMessage.id}: Ignoriert (Inhalt unverändert).`);
            return;
        }

        const lang = getGuildLanguage(newMessage.guild.id);
        const logChannelId = getLogChannelId(newMessage.guild.id, 'message_edit'); // Wichtig: 'message_edit' als Log-Typ

        if (!logChannelId) {
            console.log(`[Message Update DEBUG] Nachricht ID ${newMessage.id}: Kein Log-Kanal für 'message_edit' in Gilde ${newMessage.guild.id} konfiguriert.`);
            return; // Wenn kein Log-Kanal konfiguriert ist, beende.
        }

        let logChannel;
        try {
            logChannel = await newMessage.guild.channels.fetch(logChannelId);
            if (!logChannel || !(logChannel instanceof TextChannel)) {
                console.warn(`[MessageUpdate] Log-Kanal mit ID ${logChannelId} nicht gefunden oder nicht erreichbar in Gilde ${newMessage.guild.name}.`);
                return;
            }
        } catch (error) {
            console.error(`[MessageUpdate] Fehler beim Abrufen des Log-Kanals ${logChannelId}:`, error);
            return;
        }

        // Übersetzte Platzhalter für Inhalte, die möglicherweise nicht im Cache sind
        const oldContent = oldMessage.content && oldMessage.content.length > 0 ? oldMessage.content : getTranslatedText(lang, 'message_update.NO_OLD_CONTENT');
        const newContent = newMessage.content && newMessage.content.length > 0 ? newMessage.content : getTranslatedText(lang, 'message_update.NO_NEW_CONTENT');

        // Erstelle das Embed für die Log-Nachricht
        const embed = new EmbedBuilder()
            .setColor(0xFFFF00) // Gelb für Bearbeitungen
            .setAuthor({
                name: getTranslatedText(lang, 'message_update.LOG_AUTHOR_EDITED', { authorTag: newMessage.author.tag }),
                iconURL: newMessage.author.displayAvatarURL(),
            })
            .setDescription(getTranslatedText(lang, 'message_update.LOG_DESCRIPTION', {
                channelMention: newMessage.channel.toString(),
                channelId: newMessage.channel.id
            }))
            .addFields(
                { name: getTranslatedText(lang, 'message_update.LOG_FIELD_BEFORE'), value: truncate(oldContent, 1024) }, // Inhalt kürzen
                { name: getTranslatedText(lang, 'message_update.LOG_FIELD_AFTER'), value: truncate(newContent, 1024) }, // Inhalt kürzen
            )
            .setTimestamp() // Zeigt den Zeitpunkt der Bearbeitung an
            .setURL(newMessage.url); // Link zur bearbeiteten Nachricht

        // --- DEBUG: Dies wird geloggt, wenn der Bot versucht, das Embed zu senden ---
        console.log(`[Message Update DEBUG] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);
        // --- END DEBUG ---

        try {
            await logChannel.send({ embeds: [embed] }).catch(error => {
                console.error(`[MessageUpdate] Fehler beim Senden des Nachrichten-Update-Logs in Gilde ${newMessage.guild.name} (${newMessage.guild.id}):`, error);
            });

        } catch (error) {
            console.error(`[MessageUpdate] Schwerwiegender Fehler im messageUpdate-Event für Gilde ${newMessage.guild?.name || 'Unbekannt'}:`, error);
        }
    },
};
