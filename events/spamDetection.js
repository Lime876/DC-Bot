// events/spamDetection.js
// Dieses Event ist optional, da die Hauptlogik der Spam-Erkennung
// bereits in messageCreate.js integriert ist.
// Kann für zukünftige komplexere Spam-Erkennung genutzt werden.

import { getSpamConfig } from '../commands/Moderation/spamconfig.js';
import { getTranslatedText, getGuildLanguage } from '../utils/languageUtils.js';
import { logEvent } from '../utils/logUtils.js';
import logger from '../utils/logger.js';

export default {
    name: 'spamDetection', // Benutzerdefiniertes Event, z.B. von messageCreate ausgelöst
    async execute(message, spamType) {
        // Aktuell nur Platzhalter.
        // Um zu nutzen, rufe in messageCreate.js:
        // client.emit('spamDetection', message, spamType);

        /*
        if (!message.guild) return;

        const guildId = message.guild.id;
        const lang = await getGuildLanguage(guildId);
        const spamConfig = getSpamConfig(guildId);

        if (!spamConfig.enabled) return;

        logger.info(`[SpamDetection] Spam-Typ '${spamType}' von ${message.author.tag} erkannt.`);

        let logTitleKey, logDescriptionKey, userNotificationKey, logColor;

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
                userNotificationKey = null; // Keine DM für Raid
                logColor = 'DarkRed';
                break;
            default:
                logger.warn(`[SpamDetection] Unbekannter Spam-Typ: ${spamType}`);
                return;
        }

        try {
            if (!message.deleted) {
                await message.delete().catch(err => logger.error(`[SpamDetection] Fehler beim Löschen der Nachricht: ${err.message}`));
            }

            await logEvent(guildId, 'spam_detection', {
                logTitle: getTranslatedText(lang, logTitleKey),
                logDescription: getTranslatedText(lang, logDescriptionKey, {
                    userTag: message.author.tag,
                    channelMention: message.channel.toString(),
                    link: spamType === 'link' ? message.content.match(/(https?:\/\/[^\s]+)/)?.[0] : undefined
                }),
                fields: [
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                    { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                ],
                color: logColor,
                footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) }
            });

            if (userNotificationKey) {
                await message.author.send(getTranslatedText(lang, userNotificationKey, {
                    link: spamType === 'link' ? message.content.match(/(https?:\/\/[^\s]+)/)?.[0] : undefined
                })).catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
            }

        } catch (error) {
            logger.error(`[SpamDetection] Fehler bei Spam-Behandlung für Typ ${spamType}:`, error);
        }
        */
    },
};