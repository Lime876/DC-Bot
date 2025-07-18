// events/spamDetection.js
// Dieses Event ist optional, da die Hauptlogik der Spam-Erkennung
// bereits in messageCreate.js integriert ist.
// Es könnte für zukünftige, komplexere oder spezialisierte Spam-Erkennungslogik verwendet werden,
// die nicht direkt an messageCreate gebunden ist.

const { getSpamConfig } = require('../commands/Moderation/spamconfig');
const { getTranslatedText, getGuildLanguage } = require('../utils/languageUtils');
const { logEvent } = require('../utils/logUtils');
const logger = require('../utils/logger'); // Importiere den neuen Logger

module.exports = {
    name: 'spamDetection', // Dies ist ein benutzerdefiniertes Event, das von messageCreate ausgelöst werden könnte
    async execute(message, spamType) {
        // Diese Datei ist derzeit nicht direkt an ein Discord.js-Event gebunden.
        // Die Logik zur Spam-Erkennung und -Behandlung ist in messageCreate.js.
        // Wenn du hier spezifische, ausgelöste Aktionen für verschiedene Spam-Typen benötigst,
        // müsste messageCreate.js dieses Event mit client.emit('spamDetection', message, spamType) triggern.

        // Beispiel für eine zukünftige Verwendung, falls du dieses Event nutzen möchtest:
        /*
        if (!message.guild) return;

        const guildId = message.guild.id;
        const lang = await getGuildLanguage(guildId);
        const spamConfig = getSpamConfig(guildId);

        if (!spamConfig.enabled) {
            return;
        }

        logger.info(`[SpamDetection Event] Spam des Typs '${spamType}' von ${message.author.tag} erkannt.`);

        let logTitleKey = '';
        let logDescriptionKey = '';
        let userNotificationKey = '';
        let logColor = 'Red'; // Standardfarbe für Spam-Logs

        switch (spamType) {
            case 'link':
                logTitleKey = 'spam_detection.LINK_DELETED_TITLE';
                logDescriptionKey = 'spam_detection.LINK_DELETED_DESCRIPTION';
                userNotificationKey = 'spam_detection.LINK_DELETED_USER_NOTIFICATION';
                logColor = 'Red';
                break;
            case 'character':
                logTitleKey = 'spam_detection.CHARACTER_SPAM_DELETED_TITLE';
                logDescriptionKey = 'spam_detection.CHARACTER_SPAM_DELETED_DESCRIPTION';
                userNotificationKey = 'spam_detection.CHARACTER_SPAM_USER_NOTIFICATION';
                logColor = 'Orange';
                break;
            case 'emote':
                logTitleKey = 'spam_detection.EMOTE_SPAM_DELETED_TITLE';
                logDescriptionKey = 'spam_detection.EMOTE_SPAM_DELETED_DESCRIPTION';
                userNotificationKey = 'spam_detection.EMOTE_SPAM_USER_NOTIFICATION';
                logColor = 'Yellow';
                break;
            case 'sticker':
                logTitleKey = 'spam_detection.STICKER_SPAM_DELETED_TITLE';
                logDescriptionKey = 'spam_detection.STICKER_SPAM_DELETED_DESCRIPTION';
                userNotificationKey = 'spam_detection.STICKER_SPAM_USER_NOTIFICATION';
                logColor = 'Purple';
                break;
            case 'raid':
                logTitleKey = 'spam_detection.RAID_DETECTED_TITLE';
                logDescriptionKey = 'spam_detection.RAID_DETECTED_DESCRIPTION';
                userNotificationKey = null; // Keine direkte DM für Raid-Erkennung an einzelne Benutzer
                logColor = 'DarkRed';
                break;
            default:
                logger.warn(`[SpamDetection Event] Unbekannter Spam-Typ: ${spamType}`);
                return;
        }

        try {
            // Lösche die Nachricht, falls sie noch existiert und nicht bereits gelöscht wurde
            if (!message.deleted) {
                await message.delete().catch(err => logger.error(`[SpamDetection Event] Fehler beim Löschen der Nachricht: ${err.message}`));
            }

            // Logge das Ereignis
            await logEvent(guildId, 'spam_detection', {
                logTitle: getTranslatedText(lang, logTitleKey),
                logDescription: getTranslatedText(lang, logDescriptionKey, {
                    userTag: message.author.tag,
                    channelMention: message.channel.toString(),
                    // Füge hier weitere dynamische Daten hinzu, je nach Spam-Typ
                    link: spamType === 'link' ? message.content.match(/(https?:\/\/[^\s]+)/)?.[0] : undefined // Beispiel
                }),
                fields: [
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                ],
                color: logColor
            });

            // Sende Benachrichtigung an den Benutzer, falls zutreffend
            if (userNotificationKey) {
                await message.author.send(getTranslatedText(lang, userNotificationKey, {
                    // Füge hier dynamische Daten für die DM hinzu
                    link: spamType === 'link' ? message.content.match(/(https?:\/\/[^\s]+)/)?.[0] : undefined
                })).catch(err => logger.warn(`[SpamDetection Event] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
            }

        } catch (error) {
            logger.error(`[SpamDetection Event] Unerwarteter Fehler bei der Spam-Behandlung für Typ ${spamType}:`, error);
        }
        */
    },
};
