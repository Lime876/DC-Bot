// events/messageCreate/spamDetection.js
const { Events, PermissionsBitField, EmbedBuilder, MessageFlags } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const { getGuildSpamConfig } = require('../commands/Moderation/spamconfig');

// Temporäre In-Memory-Flutkontrolle (für ein einfaches Beispiel)
const userMessageHistory = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignoriere Nachrichten von Bots
        if (message.author.bot) return;

        // Abrufen der server-spezifischen Spam-Konfiguration
        const guildId = message.guild.id;
        const currentConfig = getGuildSpamConfig(guildId);

        // Wenn die Spam-Erkennung für diesen Server nicht aktiviert ist, frühzeitig zurückkehren
        if (!currentConfig.enabled) {
            return;
        }

        // Ignoriere Nachrichten von Benutzern mit Administrator- oder Nachrichten-Verwalten-Berechtigungen
        if (message.member && (
            message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
        )) {
            return;
        }

        const lang = getGuildLanguage(message.guild.id);
        let spamDetected = false;
        let reason = '';

        // --- 1. Überprüfung auf Discord-Einladungslinks (bestehend) ---
        if (currentConfig.inviteDetectionEnabled && !spamDetected) {
            const inviteRegex = /(discord\.gg\/|discordapp\.com\/invite\/)([a-zA-Z0-9]+)/g;
            if (inviteRegex.test(message.content)) {
                spamDetected = true;
                reason = getTranslatedText(lang, 'spam_detection.invite_link_detected');
            }
        }

        // --- 2. NEU: Überprüfung auf Gesperrte Links ---
        if (currentConfig.blacklistedLinks && currentConfig.blacklistedLinks.length > 0 && !spamDetected) {
            const urlRegex = /(https?:\/\/[^\s]+)/g; // Regulärer Ausdruck, um URLs zu finden
            const foundUrls = message.content.match(urlRegex);

            if (foundUrls) {
                for (const url of foundUrls) {
                    try {
                        const { hostname } = new URL(url); // Hostname aus der URL extrahieren
                        const fullPath = new URL(url).host + new URL(url).pathname; // Hostname + Pfad

                        for (const blacklistedEntry of currentConfig.blacklistedLinks) {
                            // Normalisiere den blacklistedEntry für den Vergleich
                            const normalizedBlacklistedEntry = blacklistedEntry.replace(/^(https?:\/\/(www\.)?)/i, '').replace(/\/$/, '');

                            // Prüfe, ob der Hostname übereinstimmt ODER der volle Pfad übereinstimmt
                            // .includes() fängt auch Subdomains oder Subpfade ab (z.B. "malicious.com" blockiert "sub.malicious.com")
                            if (hostname.includes(normalizedBlacklistedEntry) || fullPath.includes(normalizedBlacklistedEntry)) {
                                spamDetected = true;
                                reason = getTranslatedText(lang, 'spam_detection.blacklisted_link_detected');
                                break; // Verlasse die innere Schleife, da ein Treffer gefunden wurde
                            }
                        }
                    } catch (e) {
                        // Ungültige URL in der Nachricht, einfach ignorieren
                        console.warn(`[Spam Detection] Ungültige URL in Nachricht ${message.id}: ${url} - ${e.message}`);
                    }
                    if (spamDetected) break; // Verlasse die äußere Schleife, wenn Spam erkannt wurde
                }
            }
        }


        // --- 3. Überprüfung auf übermäßige Großschreibung (bestehend) ---
        if (!spamDetected) {
            const content = message.content.replace(/[^a-zA-Z]/g, '');
            if (content.length > 10) {
                let uppercaseCount = 0;
                for (const char of content) {
                    if (char === char.toUpperCase() && char !== char.toLowerCase()) {
                        uppercaseCount++;
                    }
                }
                if (uppercaseCount / content.length > currentConfig.excessiveCapsThreshold) {
                    spamDetected = true;
                    reason = getTranslatedText(lang, 'spam_detection.excessive_caps_detected');
                }
            }
        }

        // --- 4. Überprüfung auf Blacklisted Words (gesperrte Wörter) (bestehend) ---
        if (!spamDetected) {
            const lowerCaseContent = message.content.toLowerCase();
            for (const word of currentConfig.blacklistedWords) {
                if (lowerCaseContent.includes(word.toLowerCase())) {
                    spamDetected = true;
                    reason = getTranslatedText(lang, 'spam_detection.blacklisted_word_detected');
                    break;
                }
            }
        }

        // --- 5. Einfache Flood-Erkennung (bestehend) ---
        if (!spamDetected) {
            const now = Date.now();
            const userId = message.author.id;

            if (!userMessageHistory.has(userId)) {
                userMessageHistory.set(userId, []);
            }

            const history = userMessageHistory.get(userId);
            history.push({ timestamp: now, content: message.content });

            const recentMessages = history.filter(msg => now - msg.timestamp < currentConfig.floodThreshold.timeframeMs);
            userMessageHistory.set(userId, recentMessages);

            if (recentMessages.length > currentConfig.floodThreshold.maxMessages) {
                spamDetected = true;
                reason = getTranslatedText(lang, 'spam_detection.flood_detected');
            } else {
                const identicalMessages = recentMessages.filter(msg => msg.content === message.content);
                if (identicalMessages.length >= currentConfig.floodThreshold.sameMessageThreshold) {
                    spamDetected = true;
                    reason = getTranslatedText(lang, 'spam_detection.flood_detected');
                }
            }
        }

        // --- Aktion ausführen, wenn Spam erkannt wurde ---
        if (spamDetected) {
            try {
                // Nachricht löschen
                if (message.deletable) {
                    await message.delete();
                }

                // Benutzer benachrichtigen (privat oder als ephemere Nachricht)
                await message.author.send({
                    content: `${getTranslatedText(lang, 'spam_detection.message_deleted')} ${reason}`,
                    flags: [MessageFlags.Ephemeral]
                }).catch(err => console.error(`Konnte Benutzer ${message.author.tag} nicht per DM benachrichtigen:`, err));

                // Im Moderations-Log-Kanal protokollieren
                if (currentConfig.moderationLogChannelId) {
                    const modLogChannel = message.guild.channels.cache.get(currentConfig.moderationLogChannelId);
                    if (modLogChannel && modLogChannel.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle(getTranslatedText(lang, 'spam_detection.moderation_log_title'))
                            .addFields(
                                { name: getTranslatedText(lang, 'spam_detection.moderation_log_user'), value: `${message.author.tag} (${message.author.id})`, inline: true },
                                { name: getTranslatedText(lang, 'spam_detection.moderation_log_channel'), value: `#${message.channel.name} (${message.channel.id})`, inline: true },
                                { name: getTranslatedText(lang, 'spam_detection.moderation_log_reason'), value: reason },
                                { name: getTranslatedText(lang, 'spam_detection.moderation_log_content'), value: `\`\`\`\n${message.content.substring(0, 1000)}\n\`\`\`` || 'No content (e.g., empty message)', }
                            )
                            .setTimestamp();
                        await modLogChannel.send({ embeds: [embed] }).catch(err => console.error("Error sending moderation log embed:", err));
                    }
                }

            } catch (error) {
                console.error(`Fehler beim Verarbeiten der Spam-Erkennung für Nachricht ${message.id}:`, error);
            }
        }
    },
};