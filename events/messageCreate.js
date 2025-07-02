// events/messageCreate.js
const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const { getGuildSpamConfig } = require('../commands/Moderation/spamconfig');
const { spamDeletedMessageIds, recentMessages } = require('../utils/sharedState');

const levelsPath = path.join(__dirname, '../data/levels.json');
const levelRolesPath = path.join(__dirname, '../data/levelRoles.json');
const cooldowns = new Set();

// XP-Einstellungen
const BASE_XP_PER_MESSAGE = 10;
const XP_PER_CHARACTER = 0.5;
const COOLDOWN_SECONDS = 30;
const MIN_MESSAGE_LENGTH = 8;

/**
 * Überprüft, ob eine Nachricht übermäßig viele sich wiederholende Zeichen enthält (Zeichen-Spam).
 * @param {string} content Der Inhalt der Nachricht.
 * @param {number} threshold Der Schwellenwert (z.B. 0.7 für 70%).
 * @returns {boolean} True, wenn Zeichen-Spam erkannt wurde, sonst false.
 */
const isCharacterSpam = (content, threshold) => {
    if (content.length < 10) return false; // Nachrichten unter 10 Zeichen ignorieren, um False Positives zu vermeiden

    const cleanedContent = content.replace(/\s/g, ''); // Leerzeichen entfernen
    if (cleanedContent.length === 0) return false;

    const charCounts = {};
    for (const char of cleanedContent) {
        charCounts[char] = (charCounts[char] || 0) + 1;
    }

    // Finde das Zeichen, das am häufigsten vorkommt
    let maxCount = 0;
    for (const char in charCounts) {
        if (charCounts[char] > maxCount) {
            maxCount = charCounts[char];
        }
    }

    // Berechne das Verhältnis des häufigsten Zeichens zur Gesamtlänge
    const ratio = maxCount / cleanedContent.length;
    return ratio >= threshold;
};


// Funktion zum Laden/Speichern der Leveldaten
const loadLevels = () => {
    if (fs.existsSync(levelsPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelsPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveLevels = (levels) => {
    try {
        fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${levelsPath}:`, e);
    }
};

// Funktion zum Laden der Level-Rollen-Daten
const loadLevelRoles = () => {
    if (fs.existsSync(levelRolesPath)) {
        try {
            return JSON.parse(fs.readFileSync(levelRolesPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${levelRolesPath}:`, e);
            return {};
        }
    }
    return {};
};

// Funktion zur Berechnung der benötigten XP für ein bestimmtes Level
const getRequiredXP = (level) => {
    return 5 * Math.pow(level, 2) + 50 * level + 100;
};

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignoriere Bots, Nachrichten ohne Gilde oder leeren Inhalt
        if (message.author.bot || !message.guild || message.content.length === 0) return;

        const guildId = message.guild.id;
        const lang = getGuildLanguage(guildId);
        const spamConfig = getGuildSpamConfig(guildId);

        // --- Start der Spam-Erkennungslogik ---
        if (spamConfig.enabled) {
            // 1. Blacklisted Links überprüfen
            if (spamConfig.blacklistedLinks && spamConfig.blacklistedLinks.length > 0) {
                const messageContentLower = message.content.toLowerCase();
                for (const link of spamConfig.blacklistedLinks) {
                    const normalizedBlacklistedLink = link.replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/\/$/, '');
                    if (messageContentLower.includes(normalizedBlacklistedLink.toLowerCase())) {
                        try {
                            if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                                console.warn(`[Spam Detection] Bot lacks ManageMessages permission in channel ${message.channel.name} (${message.channel.id}). Cannot delete message with blacklisted link.`);
                                return;
                            }

                            spamDeletedMessageIds.add(message.id);
                            await message.delete();

                            if (spamConfig.moderationLogChannelId) {
                                const logChannel = await message.guild.channels.fetch(spamConfig.moderationLogChannelId).catch(() => null);
                                if (logChannel && logChannel.isTextBased()) {
                                    const logEmbed = new EmbedBuilder()
                                        .setColor('Red')
                                        .setTitle(getTranslatedText(lang, 'spam_detection.LINK_DELETED_TITLE'))
                                        .setDescription(getTranslatedText(lang, 'spam_detection.LINK_DELETED_DESCRIPTION', {
                                            userTag: message.author.tag,
                                            channelMention: message.channel.toString(),
                                            link: normalizedBlacklistedLink
                                        }))
                                        .addFields(
                                            { name: getTranslatedText(lang, 'general.USER_ID'), value: message.author.id, inline: true },
                                            { name: getTranslatedText(lang, 'general.CHANNEL_ID'), value: message.channel.id, inline: true },
                                            { name: getTranslatedText(lang, 'spam_detection.ORIGINAL_CONTENT'), value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                                        )
                                        .setTimestamp();
                                    await logChannel.send({ embeds: [logEmbed] });
                                }
                            }
                            await message.channel.send({
                                content: getTranslatedText(lang, 'spam_detection.LINK_DELETED_USER_NOTIFICATION', { link: normalizedBlacklistedLink }),
                                ephemeral: true
                            }).catch(e => console.error(`[Spam Detection] Konnte Nutzer nicht über gelöschten Link informieren:`, e));

                            return;
                        } catch (error) {
                            console.error(`[Spam Detection] Fehler beim Löschen der Nachricht oder Senden des Logs:`, error);
                            return;
                        }
                    }
                }
            }

            // 2. Zeichen-Spam überprüfen (NEU)
            if (spamConfig.characterSpamThreshold > 0 && isCharacterSpam(message.content, spamConfig.characterSpamThreshold)) {
                try {
                    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                        console.warn(`[Spam Detection] Bot lacks ManageMessages permission in channel ${message.channel.name} (${message.channel.id}). Cannot delete message with character spam.`);
                        return;
                    }

                    spamDeletedMessageIds.add(message.id);
                    await message.delete();

                    if (spamConfig.moderationLogChannelId) {
                        const logChannel = await message.guild.channels.fetch(spamConfig.moderationLogChannelId).catch(() => null);
                        if (logChannel && logChannel.isTextBased()) {
                            const logEmbed = new EmbedBuilder()
                                .setColor('Red')
                                .setTitle(getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_DELETED_TITLE'))
                                .setDescription(getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_DELETED_DESCRIPTION', {
                                    userTag: message.author.tag,
                                    channelMention: message.channel.toString()
                                }))
                                .addFields(
                                    { name: getTranslatedText(lang, 'general.USER_ID'), value: message.author.id, inline: true },
                                    { name: getTranslatedText(lang, 'general.CHANNEL_ID'), value: message.channel.id, inline: true },
                                    { name: getTranslatedText(lang, 'spam_detection.ORIGINAL_CONTENT'), value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\``, inline: false }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                    await message.channel.send({
                        content: getTranslatedText(lang, 'spam_detection.CHARACTER_SPAM_USER_NOTIFICATION'),
                        ephemeral: true
                    }).catch(e => console.error(`[Spam Detection] Konnte Nutzer nicht über gelöschten Zeichen-Spam informieren:`, e));

                    return;
                } catch (error) {
                    console.error(`[Spam Detection] Fehler beim Löschen der Nachricht oder Senden des Logs (Zeichen-Spam):`, error);
                    return;
                }
            }

            // 3. Raid-Schutz überprüfen
            if (spamConfig.raidProtectionEnabled && spamConfig.raidThreshold) {
                const now = Date.now();
                const raidThreshold = spamConfig.raidThreshold;

                if (!recentMessages.has(guildId)) {
                    recentMessages.set(guildId, []);
                }
                const guildRecentMessages = recentMessages.get(guildId);

                guildRecentMessages.push({
                    content: message.content.toLowerCase().trim(),
                    timestamp: now,
                    authorId: message.author.id,
                    messageId: message.id
                });

                const filteredMessages = guildRecentMessages.filter(msg => now - msg.timestamp < raidThreshold.timeframeMs);
                recentMessages.set(guildId, filteredMessages);

                const contentCounts = new Map();

                for (const msg of filteredMessages) {
                    if (!contentCounts.has(msg.content)) {
                        contentCounts.set(msg.content, { count: 0, uniqueUsers: new Set() });
                    }
                    const entry = contentCounts.get(msg.content);
                    entry.count++;
                    entry.uniqueUsers.add(msg.authorId);
                }

                for (const [content, data] of contentCounts) {
                    if (data.count >= raidThreshold.messageCount && data.uniqueUsers.size >= raidThreshold.userCount) {
                        console.warn(`[Spam Detection] RAID DETECTED in guild ${message.guild.name} (${guildId})!`);
                        console.warn(`  Content: "${content}"`);
                        console.warn(`  Messages: ${data.count}, Unique Users: ${data.uniqueUsers.size}`);

                        if (spamConfig.moderationLogChannelId) {
                            const logChannel = await message.guild.channels.fetch(spamConfig.moderationLogChannelId).catch(() => null);
                            if (logChannel && logChannel.isTextBased()) {
                                const raidEmbed = new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle(getTranslatedText(lang, 'spam_detection.RAID_DETECTED_TITLE'))
                                    .setDescription(getTranslatedText(lang, 'spam_detection.RAID_DETECTED_DESCRIPTION', {
                                        messageCount: data.count,
                                        userCount: data.uniqueUsers.size,
                                        timePeriod: ms(raidThreshold.timeframeMs, { long: true })
                                    }))
                                    .addFields(
                                        { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_CONTENT'), value: `\`\`\`\n${content.substring(0, 1000)}\n\`\`\``, inline: false },
                                        { name: getTranslatedText(lang, 'spam_detection.RAID_DETECTED_USERS'), value: Array.from(data.uniqueUsers).map(id => `<@${id}>`).join(', ').substring(0, 1024) || getTranslatedText(lang, 'general.NONE'), inline: false }
                                    )
                                    .setTimestamp();
                                await logChannel.send({ embeds: [raidEmbed] });
                            }
                        }
                        recentMessages.set(guildId, filteredMessages.filter(msg => msg.content !== content));
                        break;
                    }
                }
            }
        }
        // --- Ende der Spam-Erkennungslogik ---


        // --- Start der XP- und Level-Logik ---
        if (message.content.length < MIN_MESSAGE_LENGTH || message.content.trim().length === 0) return;
        if (cooldowns.has(message.author.id)) return;

        const levelsData = loadLevels();
        const levelRolesData = loadLevelRoles();
        const userId = message.author.id;

        if (!levelsData[userId]) {
            levelsData[userId] = { xp: 0, level: 0 };
        }

        const oldLevel = levelsData[userId].level;

        let earnedXP = BASE_XP_PER_MESSAGE + (message.content.length * XP_PER_CHARACTER);
        earnedXP = Math.round(earnedXP);

        levelsData[userId].xp += earnedXP;

        let currentLevel = levelsData[userId].level;
        let requiredXP = getRequiredXP(currentLevel);

        while (levelsData[userId].xp >= requiredXP) {
            levelsData[userId].level++;
            levelsData[userId].xp -= requiredXP;
            currentLevel = levelsData[userId].level;
            requiredXP = getRequiredXP(currentLevel);

            const levelUpEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(getTranslatedText(lang, 'level_system.LEVEL_UP_TITLE'))
                .setDescription(getTranslatedText(lang, 'level_system.LEVEL_UP_DESCRIPTION', { userId: userId, level: currentLevel }))
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            saveLevels(levelsData);

            await message.channel.send({ embeds: [levelUpEmbed] });
            console.log(`${message.author.tag} hat Level ${currentLevel} erreicht!`);
        }

        if (levelsData[userId].level > oldLevel) {
            const member = message.member;
            const rolesForGuild = levelRolesData[guildId];

            if (rolesForGuild && rolesForGuild.length > 0) {
                for (const lr of rolesForGuild) {
                    if (levelsData[userId].level >= lr.level) {
                        try {
                            const role = message.guild.roles.cache.get(lr.roleId);
                            if (role && !member.roles.cache.has(role.id)) {
                                if (message.guild.members.me.roles.highest.position <= role.position) {
                                    console.warn(`[LevelRoles] Bot kann Rolle ${role.name} (${role.id}) nicht zuweisen, da sie höher ist als seine höchste Rolle auf Server ${message.guild.name} (${guildId}).`);
                                    continue;
                                }
                                await member.roles.add(role, getTranslatedText(lang, 'level_system.ROLE_ASSIGN_REASON', { level: lr.level }));
                                console.log(`Rolle ${role.name} an ${member.user.tag} vergeben (Level ${levelsData[userId].level}).`);
                            }
                        } catch (error) {
                            console.error(`[LevelRoles] Fehler beim Zuweisen der Rolle ${lr.roleId} an ${member.user.tag}:`, error);
                        }
                    }
                }
            }
        }

        saveLevels(levelsData);

        cooldowns.add(userId);
        setTimeout(() => {
            cooldowns.delete(userId);
        }, COOLDOWN_SECONDS * 1000);
    },
};
