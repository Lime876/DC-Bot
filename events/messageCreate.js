// events/messageCreate.js
import { Events, EmbedBuilder } from 'discord.js';
import { getSpamConfig } from '../commands/Moderation/spamconfig.js';
import { getTranslatedText, getGuildLanguage } from '../utils/languageUtils.js';
import { logEvent } from '../utils/logUtils.js';
import logger from '../utils/logger.js';

// In-memory Speicher für Raid-Erkennung
// guildId -> { users: Map<userId, { messages: Array<{ content: string, timestamp: number }>> } }
const raidDetection = new Map();

export default {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;
        const lang = await getGuildLanguage(guildId);
        const spamConfig = getSpamConfig(guildId);

        if (!spamConfig.enabled) return;

        // 1. Link-Spam-Erkennung
        if (spamConfig.blacklistedLinks?.length) {
            const messageContent = message.content.toLowerCase();
            for (const link of spamConfig.blacklistedLinks) {
                if (messageContent.includes(link.toLowerCase())) {
                    try {
                        await message.delete();
                        logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Blacklisted Link: ${link}).`);

                        await logEvent(guildId, 'message_delete', {
                            logTitle: getTranslatedText(lang, 'spam_detection.LINK_DELETED_TITLE'),
                            logDescription: getTranslatedText(lang, 'spam_detection.LINK_DELETED_DESCRIPTION', {
                                userTag: message.author.tag,
                                channelMention: message.channel.toString(),
                                link
                            }),
                            fields: [
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                                { name: getTranslatedText(lang, 'spam_detection.ORIGINAL_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                            ],
                            color: 'Red',
                            footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) }
                        });

                        await message.author.send(getTranslatedText(lang, 'spam_detection.LINK_DELETED_USER_NOTIFICATION', { link }))
                            .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden: ${err.message}`));
                        return;
                    } catch (error) {
                        logger.error(`[SpamDetection] Fehler beim Link-Spam Handling:`, error);
                    }
                }
            }
        }

        // 2. Zeichen-Spam-Erkennung
        if (spamConfig.characterSpamThreshold > 0) {
            const messageContent = message.content;
            if (messageContent.length > 10) {
                const charCounts = {};
                for (const char of messageContent) {
                    charCounts[char] = (charCounts[char] || 0) + 1;
                }

                const maxRepeatingCharRatio = Math.max(...Object.values(charCounts).map(count => count / messageContent.length));

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
                            color: 'Orange',
                            footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) }
                        });

                        await message.author.send(getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_USER_NOTIFICATION'))
                            .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden: ${err.message}`));
                        return;
                    } catch (error) {
                        logger.error(`[SpamDetection] Fehler beim Zeichen-Spam Handling:`, error);
                    }
                }
            }
        }

        // 3. Emote-Spam-Erkennung
        if (spamConfig.maxEmotes > 0) {
            const emoteRegex = /(<a?:[a-zA-Z0-9_]+:\d+>|\p{Emoji_Presentation})/gu;
            const matches = message.content.match(emoteRegex);
            if (matches && matches.length > spamConfig.maxEmotes) {
                try {
                    await message.delete();
                    logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Emote-Spam: ${matches.length}).`);

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
                        color: 'Yellow',
                        footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) }
                    });

                    await message.author.send(getTranslatedText(lang, 'spam_detection.EMOTE_SPAM_USER_NOTIFICATION'))
                        .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden: ${err.message}`));
                    return;
                } catch (error) {
                    logger.error(`[SpamDetection] Fehler beim Emote-Spam Handling:`, error);
                }
            }
        }

        // 4. Sticker-Spam-Erkennung
        if (spamConfig.maxStickers > 0 && message.stickers.size > spamConfig.maxStickers) {
            try {
                await message.delete();
                logger.info(`[SpamDetection] Nachricht von ${message.author.tag} gelöscht (Sticker-Spam: ${message.stickers.size}).`);

                await logEvent(guildId, 'message_delete', {
                    logTitle: getTranslatedText(lang, 'spam_detection.STICKER_SPAM_DELETED_TITLE'),
                    logDescription: getTranslatedText(lang, 'spam_detection.STICKER_SPAM_DELETED_DESCRIPTION', {
                        userTag: message.author.tag,
                        channelMention: message.channel.toString()
                    }),
                    fields: [
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
                        { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false }
                    ],
                    color: 'Purple',
                    footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) }
                });

                await message.author.send(getTranslatedText(lang, 'spam_detection.STICKER_SPAM_USER_NOTIFICATION'))
                    .catch(err => logger.warn(`[SpamDetection] Konnte DM an ${message.author.tag} nicht senden: ${err.message}`));
                return;
            } catch (error) {
                logger.error(`[SpamDetection] Fehler beim Sticker-Spam Handling:`, error);
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

            userData.messages.push({ content: message.content, timestamp: now });
            userData.messages = userData.messages.filter(msg => now - msg.timestamp < timePeriodMs);

            const recentMessages = [];
            guildRaidData.users.forEach(user => {
                recentMessages.push(...user.messages);
            });

            const messageGroups = new Map();
            recentMessages.forEach(msg => {
                const normalizedContent = msg.content.toLowerCase().replace(/\s+/g, ' ').trim();
                if (!messageGroups.has(normalizedContent)) {
                    messageGroups.set(normalizedContent, { count: 0, users: new Set() });
                }
                const group = messageGroups.get(normalizedContent);
                group.count++;
                group.users.add(message.author.id);
            });

            for (const [content, group] of messageGroups.entries()) {
                if (group.count >= spamConfig.raidProtection.messageCount &&
                    group.users.size >= spamConfig.raidProtection.userCount) {
                    logger.warn(`[SpamDetection] Potenzieller Raid in Gilde ${guildId} erkannt!`);

                    const raidEmbed = new EmbedBuilder()
                        .setColor('Red')
                        .setTitle(getTranslatedText(lang, 'spam_detection.RAID_DETECTED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'spam_detection.RAID_DETECTED_DESCRIPTION', {
                            messageCount: group.count,
                            userCount: group.users.size,
                            timePeriod: spamConfig.raidProtection.timePeriod
                        }))
                        .addFields(
                            { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_CONTENT'), value: content.substring(0, 1024) },
                            { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_USERS'), value: Array.from(group.users).map(id => `<@${id}>`).join(', ').substring(0, 1024) }
                        )
                        .setTimestamp()
                        .setFooter({ text: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_FOOTER', { guildId }) });

                    const spamLogChannelId = message.client.config.getLogChannelId(guildId, 'spam_detection');
                    if (spamLogChannelId) {
                        const spamLogChannel = message.guild.channels.cache.get(spamLogChannelId);
                        if (spamLogChannel?.isTextBased()) {
                            await spamLogChannel.send({ embeds: [raidEmbed] }).catch(err => logger.error(`[SpamDetection] Fehler beim Senden des Raid-Logs: ${err}`));
                        } else {
                            logger.warn(`[SpamDetection] Ungültiger Spam-Log-Kanal: ${spamLogChannelId}`);
                        }
                    }

                    raidDetection.delete(guildId);
                    return;
                }
            }

            guildRaidData.users.forEach((user, userId) => {
                if (user.messages.length === 0) {
                    guildRaidData.users.delete(userId);
                }
            });
        }
    }
};

function parseDurationToMs(durationString) {
    const match = durationString.match(/^(\d+)([smh])$/);
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
