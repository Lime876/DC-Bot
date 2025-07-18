// events/messageCreate.js
const { Events, MessageFlags } = require('discord.js');
const { getSpamConfig } = require('../commands/Moderation/spamconfig'); // Importiere getSpamConfig
const { getTranslatedText, getGuildLanguage } = require('../utils/languageUtils');
const { logEvent } = require('../utils/logUtils'); // Importiere logEvent
const logger = require('../utils/logger'); // Importiere den neuen Logger

// In-memory Speicher für Raid-Erkennung
const raidDetection = new Map(); // guildId -> { users: Map<userId, { messages: Array<{ content: string, timestamp: number }>> } }

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignoriere Bots und DM-Nachrichten
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const lang = await getGuildLanguage(guildId);
        const spamConfig = getSpamConfig(guildId);

        if (!spamConfig.enabled) {
            return; // Spam-Erkennung ist nicht aktiviert
        }

        // 1. Link-Spam-Erkennung
        if (spamConfig.blacklistedLinks && spamConfig.blacklistedLinks.length > 0) {
            const messageContent = message.content.toLowerCase();
            for (const link of spamConfig.blacklistedLinks) {
                if (messageContent.includes(link.toLowerCase())) {
                    try {
                        await message.delete();
                        logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Blacklisted Link: ${link}).`);

                        // Log-Nachricht an den konfigurierten Kanal senden
                        await logEvent(guildId, 'message_delete', {
                            logTitle: getTranslatedText(lang, 'spam_detection.LINK_DELETED_TITLE'),
                            logDescription: getTranslatedText(lang, 'spam_detection.LINK_DELETED_DESCRIPTION', {
                                userTag: message.author.tag,
                                channelMention: message.channel.toString(),
                                link: link
                            }),
                            fields: [
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                                { name: getTranslatedText(lang, 'spam_detection.ORIGINAL_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                            ],
                            color: 'Red'
                        });

                        // Benachrichtigung an den Benutzer senden
                        await message.author.send(getTranslatedText(lang, 'spam_detection.LINK_DELETED_USER_NOTIFICATION', { link }))
                            .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
                        return; // Nachricht wurde gelöscht, weitere Prüfungen überspringen
                    } catch (error) {
                        logger.error(`[SpamDetection] Fehler beim Löschen der Nachricht oder Senden des Logs/DM (Link-Spam):`, error);
                    }
                }
            }
        }

        // 2. Zeichen-Spam-Erkennung
        if (spamConfig.characterSpamThreshold > 0) {
            const messageContent = message.content;
            if (messageContent.length > 10) { // Nur prüfen, wenn Nachricht lang genug ist
                const charCounts = {};
                for (const char of messageContent) {
                    charCounts[char] = (charCounts[char] || 0) + 1;
                }

                let maxRepeatingCharRatio = 0;
                for (const char in charCounts) {
                    const ratio = charCounts[char] / messageContent.length;
                    if (ratio > maxRepeatingCharRatio) {
                        maxRepeatingCharRatio = ratio;
                    }
                }

                if (maxRepeatingCharRatio > spamConfig.characterSpamThreshold) {
                    try {
                        await message.delete();
                        logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Zeichen-Spam).`);

                        await logEvent(guildId, 'message_delete', {
                            logTitle: getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_DELETED_TITLE'),
                            logDescription: getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_DELETED_DESCRIPTION', {
                                userTag: message.author.tag,
                                channelMention: message.channel.toString()
                            }),
                            fields: [
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                            ],
                            color: 'Orange'
                        });

                        await message.author.send(getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_USER_NOTIFICATION'))
                            .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
                        return;
                    } catch (error) {
                        logger.error(`[SpamDetection] Fehler beim Löschen der Nachricht oder Senden des Logs/DM (Zeichen-Spam):`, error);
                    }
                }
            }
        }

        // 3. Emote-Spam-Erkennung
        if (spamConfig.maxEmotes > 0) {
            const emoteRegex = /<a?:[a-zA-Z0-9_]+:\d+>|\p{Emoji_Presentation}/gu; // Custom und Unicode Emojis
            const matches = message.content.match(emoteRegex);
            if (matches && matches.length > spamConfig.maxEmotes) {
                try {
                    await message.delete();
                    logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Emote-Spam).`);

                    await logEvent(guildId, 'message_delete', {
                        logTitle: getTranslatedText(lang, 'spam_detection.EMOTE_SPAM_DELETED_TITLE'),
                        logDescription: getTranslatedText(lang, 'spam_detection.EMOTE_SPAM_DELETED_DESCRIPTION', {
                            userTag: message.author.tag,
                            channelMention: message.channel.toString()
                        }),
                        fields: [
                            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                        ],
                        color: 'Yellow'
                    });

                    await message.author.send(getTranslatedText(lang, 'spam_detection.EMOTE_SPAM_USER_NOTIFICATION'))
                        .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
                    return;
                } catch (error) {
                    logger.error(`[SpamDetection] Fehler beim Löschen der Nachricht oder Senden des Logs/DM (Emote-Spam):`, error);
                }
            }
        }

        // 4. Sticker-Spam-Erkennung
        if (spamConfig.maxStickers > 0 && message.stickers.size > spamConfig.maxStickers) {
            try {
                await message.delete();
                logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Sticker-Spam).`);

                await logEvent(guildId, 'message_delete', {
                    logTitle: getTranslatedText(lang, 'spam_detection.STICKER_SPAM_DELETED_TITLE'),
                    logDescription: getTranslatedText(lang, 'spam_detection.STICKER_SPAM_DELETED_DESCRIPTION', {
                        userTag: message.author.tag,
                        channelMention: message.channel.toString()
                    }),
                    fields: [
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false } // Sticker haben keinen Inhalt
                    ],
                    color: 'Purple'
                });

                await message.author.send(getTranslatedText(lang, 'spam_detection.STICKER_SPAM_USER_NOTIFICATION'))
                    .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden:`, err.message));
                return;
            } catch (error) {
                logger.error(`[SpamDetection] Fehler beim Löschen der Nachricht oder Senden des Logs/DM (Sticker-Spam):`, error);
            }
        }

        // 5. Raid-Erkennung
        if (spamConfig.raidProtection.enabled) {
            const now = Date.now();
            const timePeriodMs = parseDurationToMs(spamConfig.raidProtection.timePeriod);

            if (!raidDetection.has(guildId)) {
                raidDetection.set(guildId, { users: new Map() });
            }
            const guildRaidData = raidDetection.get(guildId);

            if (!guildRaidData.users.has(message.author.id)) {
                guildRaidData.users.set(message.author.id, { messages: [] });
            }
            const userData = guildRaidData.users.get(message.author.id);

            // Füge die aktuelle Nachricht hinzu und entferne alte Nachrichten
            userData.messages.push({ content: message.content, timestamp: now });
            userData.messages = userData.messages.filter(msg => now - msg.timestamp < timePeriodMs);

            // Überprüfe auf ähnliche Nachrichten von verschiedenen Benutzern
            const recentMessages = [];
            guildRaidData.users.forEach(user => {
                recentMessages.push(...user.messages);
            });

            // Gruppiere ähnliche Nachrichten
            const messageGroups = new Map(); // content -> { count: number, users: Set<userId> }
            recentMessages.forEach(msg => {
                const normalizedContent = msg.content.toLowerCase().replace(/\s+/g, ' ').trim(); // Normalisiere Inhalt
                if (!messageGroups.has(normalizedContent)) {
                    messageGroups.set(normalizedContent, { count: 0, users: new Set() });
                }
                const group = messageGroups.get(normalizedContent);
                group.count++;
                group.users.add(message.author.id); // Füge den aktuellen Autor hinzu
            });

            for (const [content, group] of messageGroups.entries()) {
                if (group.count >= spamConfig.raidProtection.messageCount &&
                    group.users.size >= spamConfig.raidProtection.userCount) {
                    logger.warn(`[SpamDetection] Potenzieller Raid in Gilde ${guildId} erkannt!`);

                    // Logge den Raid
                    await logEvent(guildId, 'spam_detection', {
                        logTitle: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_TITLE'),
                        logDescription: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_DESCRIPTION', {
                            messageCount: group.count,
                            userCount: group.users.size,
                            timePeriod: spamConfig.raidProtection.timePeriod
                        }),
                        fields: [
                            { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_CONTENT'), value: content.substring(0, 1024), inline: false },
                            { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_USERS'), value: Array.from(group.users).map(id => `<@${id}>`).join(', ').substring(0, 1024), inline: false }
                        ],
                        color: 'Red'
                    });

                    // Optional: Weitere Aktionen wie Server-Lockdown, Rollenentzug etc.
                    // (Hier nicht implementiert, da es komplexer ist und Benutzerentscheidungen erfordert)

                    // Leere die Raid-Daten für diese Gilde, um wiederholte Logs für denselben Raid zu vermeiden
                    raidDetection.delete(guildId);
                    return; // Beende, da Raid erkannt wurde
                }
            }

            // Bereinige alte Benutzerdaten, die keine aktuellen Nachrichten mehr haben
            guildRaidData.users.forEach((user, userId) => {
                if (user.messages.length === 0) {
                    guildRaidData.users.delete(userId);
                }
            });
        }
    },
};

/**
 * Wandelt eine Dauerzeichenkette (z.B. "15s", "1m", "1h") in Millisekunden um.
 * @param {string} durationString - Die Dauerzeichenkette.
 * @returns {number} Die Dauer in Millisekunden.
 */
function parseDurationToMs(durationString) {
    const match = durationString.match(/^(\d+)(s|m|h)$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 3600 * 1000;
        default: return 0;
    }
}
