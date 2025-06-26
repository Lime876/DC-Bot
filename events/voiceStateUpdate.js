// events/voiceStateUpdate.js
const { Events, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel, AuditLogEvent } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js'); // Importiere getLogChannelId Funktion
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils'); // Importiere Sprachfunktionen
const { getJTCConfigForGuild } = require('../utils/jtcConfig'); // Importiere die JTC-Konfigurationsfunktion

// Ein Set, um Benutzer-IDs zu speichern, für die gerade ein JTC-Kanal erstellt wird,
// um doppelte Kanalerstellungen durch schnelle Events zu vermeiden.
const creatingChannelForUser = new Set();
const COOLDOWN_MS = 2000; // 2 Sekunden Cooldown, bevor ein Benutzer erneut einen JTC-Kanal erstellen kann

// Hilfsfunktion zum Abrufen des Kanaltyp-Namens (übersetzt)
const getChannelTypeName = (type, lang) => {
    switch (type) {
        case ChannelType.GuildText: return getTranslatedText(lang, 'channel_types.TEXT_CHANNEL');
        case ChannelType.GuildVoice: return getTranslatedText(lang, 'channel_types.VOICE_CHANNEL');
        case ChannelType.GuildCategory: return getTranslatedText(lang, 'channel_types.CATEGORY');
        case ChannelType.GuildAnnouncement: return getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_CHANNEL');
        case ChannelType.GuildForum: return getTranslatedText(lang, 'channel_types.FORUM_CHANNEL');
        case ChannelType.GuildStageVoice: return getTranslatedText(lang, 'channel_types.STAGE_CHANNEL');
        case ChannelType.GuildDirectory: return getTranslatedText(lang, 'channel_types.DIRECTORY_CHANNEL');
        case ChannelType.GuildMedia: return getTranslatedText(lang, 'channel_types.MEDIA_CHANNEL');
        case ChannelType.PrivateThread: return getTranslatedText(lang, 'channel_types.PRIVATE_THREAD');
        case ChannelType.PublicThread: return getTranslatedText(lang, 'channel_types.PUBLIC_THREAD');
        case ChannelType.AnnouncementThread: return getTranslatedText(lang, 'channel_types.ANNOUNCEMENT_THREAD');
        default: return getTranslatedText(lang, 'channel_types.UNKNOWN_TYPE', { type: type });
    }
};

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) { // client-Parameter ist weiterhin nützlich
        console.log("[VoiceStateUpdate DEBUG] voiceStateUpdate event triggered.");

        let lang; // Deklariere 'lang' ausserhalb des try-blocks, damit es im catch verfügbar ist
        const user = newState.member?.user;
        const guild = newState.guild;

        try {
            if (!guild || !user || user.bot) {
                console.log("[VoiceStateUpdate DEBUG] Ignored (no guild, no user, or bot user).");
                return;
            }

            lang = getGuildLanguage(guild.id); // 'lang' hier zuweisen, nachdem guild verfügbar ist
            
            // --- Allgemeine Sprachkanal-Logging-Logik ---

            // Benutzer ist einem Sprachkanal beigetreten
            if (!oldState.channelId && newState.channelId) {
                const newChannel = newState.channel;
                console.log(`[VoiceStateUpdate DEBUG] User ${user.tag} joined voice channel ${newChannel.name}.`);

                const logChannelId = getLogChannelId(guild.id, 'voice_join');
                if (logChannelId) {
                    let logChannel;
                    try {
                        logChannel = await guild.channels.fetch(logChannelId);
                        if (logChannel instanceof TextChannel) {
                            const embed = new EmbedBuilder()
                                .setColor(0x57F287) // Grün
                                .setAuthor({
                                    name: getTranslatedText(lang, 'voice_state_update.JOIN_AUTHOR_TEXT', { userTag: user.tag }),
                                    iconURL: user.displayAvatarURL(),
                                })
                                .setDescription(getTranslatedText(lang, 'voice_state_update.JOIN_DESCRIPTION', { userTag: user.tag, channelName: newChannel.name }))
                                .addFields(
                                    { name: getTranslatedText(lang, 'general.USER_ID'), value: user.id, inline: true },
                                    { name: getTranslatedText(lang, 'general.CHANNEL_ID'), value: newChannel.id, inline: true }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] });
                        } else {
                            console.warn(`[VoiceStateUpdate] Configured log channel (${logChannelId}) for voice_join is not a text channel or not found.`);
                        }
                    } catch (error) {
                        console.error(`[VoiceStateUpdate] Error sending voice_join log to channel ${logChannelId}:`, error);
                    }
                } else {
                    console.log(`[VoiceStateUpdate DEBUG] No log channel configured for 'voice_join' in guild ${guild.id}.`);
                }
            }
            // Benutzer hat einen Sprachkanal verlassen
            else if (oldState.channelId && !newState.channelId) {
                const oldChannel = oldState.channel;
                console.log(`[VoiceStateUpdate DEBUG] User ${user.tag} left voice channel ${oldChannel.name}.`);

                const logChannelId = getLogChannelId(guild.id, 'voice_leave');
                if (logChannelId) {
                    let logChannel;
                    try {
                        logChannel = await guild.channels.fetch(logChannelId);
                        if (logChannel instanceof TextChannel) {
                            const embed = new EmbedBuilder()
                                .setColor(0xED4245) // Rot
                                .setAuthor({
                                    name: getTranslatedText(lang, 'voice_state_update.LEAVE_AUTHOR_TEXT', { userTag: user.tag }),
                                    iconURL: user.displayAvatarURL(),
                                })
                                .setDescription(getTranslatedText(lang, 'voice_state_update.LEAVE_DESCRIPTION', { userTag: user.tag, channelName: oldChannel.name }))
                                .addFields(
                                    { name: getTranslatedText(lang, 'general.USER_ID'), value: user.id, inline: true },
                                    { name: getTranslatedText(lang, 'general.CHANNEL_ID'), value: oldChannel.id, inline: true }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] });
                        } else {
                            console.warn(`[VoiceStateUpdate] Configured log channel (${logChannelId}) for voice_leave is not a text channel or not found.`);
                        }
                    } catch (error) {
                        console.error(`[VoiceStateUpdate] Error sending voice_leave log to channel ${logChannelId}:`, error);
                    }
                } else {
                    console.log(`[VoiceStateUpdate DEBUG] No log channel configured for 'voice_leave' in guild ${guild.id}.`);
                }
            }
            // Benutzer hat den Sprachkanal gewechselt
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                const oldChannel = oldState.channel;
                const newChannel = newState.channel;
                console.log(`[VoiceStateUpdate DEBUG] User ${user.tag} moved from ${oldChannel.name} to ${newChannel.name}.`);

                const logChannelId = getLogChannelId(guild.id, 'voice_move');
                if (logChannelId) {
                    let logChannel;
                    try {
                        logChannel = await guild.channels.fetch(logChannelId);
                        if (logChannel instanceof TextChannel) {
                            const embed = new EmbedBuilder()
                                .setColor(0xFEE75C) // Gelb
                                .setAuthor({
                                    name: getTranslatedText(lang, 'voice_state_update.MOVE_AUTHOR_TEXT', { userTag: user.tag }),
                                    iconURL: user.displayAvatarURL(),
                                })
                                .setDescription(getTranslatedText(lang, 'voice_state_update.MOVE_DESCRIPTION', { userTag: user.tag, oldChannelName: oldChannel.name, newChannelName: newChannel.name }))
                                .addFields(
                                    { name: getTranslatedText(lang, 'general.USER_ID'), value: user.id, inline: true },
                                    { name: getTranslatedText(lang, 'voice_state_update.FROM_CHANNEL'), value: `${oldChannel.name} (${oldChannel.id})`, inline: true },
                                    { name: getTranslatedText(lang, 'voice_state_update.TO_CHANNEL'), value: `${newChannel.name} (${newChannel.id})`, inline: true }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [embed] });
                        } else {
                            console.warn(`[VoiceStateUpdate] Configured log channel (${logChannelId}) for voice_move is not a text channel or not found.`);
                        }
                    } catch (error) {
                        console.error(`[VoiceStateUpdate] Error sending voice_move log to channel ${logChannelId}:`, error);
                    }
                } else {
                    console.log(`[VoiceStateUpdate DEBUG] No log channel configured for 'voice_move' in guild ${guild.id}.`);
                }
            }

            // --- JTC (Join to Create) Logik ---
            console.log("[JTC DEBUG] Starting JTC logic check.");

            const guildJTCConfig = getJTCConfigForGuild(guild.id);

            if (!guildJTCConfig || !guildJTCConfig.channelId) {
                console.log(`[JTC DEBUG] No JTC config found for guild ${guild.name} (${guild.id}).`);
                return; // Keine JTC-Konfiguration für diese Gilde
            }
            console.log(`[JTC DEBUG] JTC config found for guild ${guild.name}:`, guildJTCConfig);

            const jtcChannelId = guildJTCConfig.channelId;
            const jtcCategoryId = guildJTCConfig.categoryId;

            // --- Wenn ein Benutzer dem JTC-Kanal beitritt ---
            if (newState.channelId === jtcChannelId && oldState.channelId !== jtcChannelId) {
                console.log(`[JTC DEBUG] User ${user.tag} entered JTC channel ${jtcChannelId}. Attempting to create new channel.`);
                
                // DEBOUNCER: Prüfe, ob für diesen Benutzer bereits ein Kanal erstellt wird oder wurde
                if (creatingChannelForUser.has(user.id)) {
                    console.log(`[JTC DEBUG] User ${user.tag} is already in the process of creating a channel. Skipping.`);
                    return;
                }
                creatingChannelForUser.add(user.id); // Füge Benutzer zum Set hinzu

                const creationLogChannelId = getLogChannelId(guild.id, 'jtc_channel_create');
                let creationLogChannel = null;
                if (creationLogChannelId) {
                    try {
                        creationLogChannel = await guild.channels.fetch(creationLogChannelId);
                        if (!(creationLogChannel instanceof TextChannel)) {
                            console.warn(`[JTC] JTC creation log channel (${creationLogChannelId}) is not a text channel.`);
                            creationLogChannel = null;
                        }
                    } catch (e) {
                        console.error(`[JTC] Error fetching JTC creation log channel:`, e);
                        creationLogChannel = null;
                    }
                }

                try {
                    const newChannelName = getTranslatedText(lang, 'jtc_event.default_channel_name', { username: user.username });
                    console.log(`[JTC DEBUG] Creating channel with name: '${newChannelName}' and parent: '${jtcCategoryId}'`);
                    const newChannel = await guild.channels.create({
                        name: newChannelName,
                        type: ChannelType.GuildVoice,
                        parent: jtcCategoryId,
                        permissionOverwrites: [
                            {
                                id: newState.member.id, // Besitzer des Kanals
                                allow: [
                                    PermissionFlagsBits.ManageChannels,
                                    PermissionFlagsBits.MoveMembers,
                                    PermissionFlagsBits.MuteMembers,
                                    PermissionFlagsBits.DeafenMembers,
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.Connect,
                                    PermissionFlagsBits.Speak
                                ]
                            },
                            {
                                id: guild.roles.everyone.id, // @everyone Rolle
                                allow: [
                                    PermissionFlagsBits.ViewChannel,
                                    PermissionFlagsBits.Connect
                                ],
                                deny: [
                                    PermissionFlagsBits.Speak // Standardmäßig können sie nicht sprechen, Besitzer muss es erlauben
                                ]
                            }
                        ]
                    });

                    console.log(`[JTC DEBUG] Channel '${newChannel.name}' created. Moving user.`);
                    await newState.member.voice.setChannel(newChannel);
                    console.log(`[JTC DEBUG] User ${user.tag} moved to new channel.`);

                    if (creationLogChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATED_TITLE'))
                            .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATED_DESCRIPTION', {
                                userTag: user.tag,
                                channelName: newChannel.name,
                                channelId: newChannel.id,
                                creatorId: user.id
                            }))
                            .setColor(0x57F287) // Grün
                            .setTimestamp();
                        await creationLogChannel.send({ embeds: [embed] });
                        console.log(`[JTC DEBUG] JTC creation log sent to channel ${creationLogChannel.id}.`);
                    }

                } catch (error) {
                    console.error(`[JTC ERROR] Failed to create/move channel for ${user.tag} in guild ${guild.name}:`, error);
                    if (creationLogChannel) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATION_FAILED_TITLE'))
                            .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATION_FAILED_DESCRIPTION', {
                                userTag: user.tag,
                                errorMessage: error.message
                            }))
                            .setColor(0xFF0000) // Rot
                            .setTimestamp();
                        await creationLogChannel.send({ embeds: [errorEmbed] });
                    }
                } finally {
                    // Entferne den Benutzer nach dem Cooldown aus dem Set
                    setTimeout(() => {
                        creatingChannelForUser.delete(user.id);
                        console.log(`[JTC DEBUG] User ${user.id} removed from JTC cooldown set.`);
                    }, COOLDOWN_MS);
                }
            }
            // --- Wenn ein Benutzer einen JTC-erstellten Kanal verlässt und dieser leer wird ---
            else if (oldState.channelId && oldState.channelId !== jtcChannelId) {
                console.log(`[JTC DEBUG] User ${user.tag} left channel ${oldState.channel.name}. Checking if empty JTC channel needs deletion.`);
                const channel = oldState.channel;

                // Führe nur aus, wenn der Kanal ein Sprachkanal ist
                if (channel && channel.type === ChannelType.GuildVoice) {
                    // Gebe Discord kurz Zeit, den VoiceState zu aktualisieren, bevor wir prüfen, ob der Kanal leer ist
                    setTimeout(async () => {
                        // Fetch den Kanal erneut, um sicherzustellen, dass der Members-Cache aktuell ist
                        const currentChannel = await guild.channels.fetch(channel.id).catch(() => null);

                        if (currentChannel && currentChannel.members.size === 0) {
                            console.log(`[JTC DEBUG] Channel ${currentChannel.name} is now empty. Checking if it's a JTC channel.`);
                            
                            let isJTCManagedChannel = false;
                            if (jtcCategoryId && currentChannel.parentId === jtcCategoryId) {
                                // Wenn eine Kategorie konfiguriert ist, prüfen wir nur die Parent-ID
                                isJTCManagedChannel = true;
                                console.log(`[JTC DEBUG] Channel ${currentChannel.name} is in JTC category.`);
                            } else {
                                // Alternativ, wenn keine Kategorie definiert, oder für Threads/andere Kanäle,
                                // könnte man versuchen, über Audit Logs zu prüfen, ob der Bot der Ersteller war.
                                // Dies ist komplexer und weniger zuverlässig ohne spezielle Markierungen.
                                // Für Sprachkanäle ist die Parent-ID oft der beste Indikator.
                                console.log(`[JTC DEBUG] JTC category not set or channel not in JTC category. Skipping JTC check for deletion.`);
                                isJTCManagedChannel = false; // Markieren als nicht JTC verwaltet, wenn Kategorie-Check fehlschlägt
                            }

                            if (isJTCManagedChannel) {
                                const deletionLogChannelId = getLogChannelId(guild.id, 'jtc_channel_delete');
                                let deletionLogChannel = null;
                                if (deletionLogChannelId) {
                                    try {
                                        deletionLogChannel = await guild.channels.fetch(deletionLogChannelId);
                                        if (!(deletionLogChannel instanceof TextChannel)) {
                                            console.warn(`[JTC] JTC deletion log channel (${deletionLogChannelId}) is not a text channel.`);
                                            deletionLogChannel = null;
                                        }
                                    } catch (e) {
                                        console.error(`[JTC] Error fetching JTC deletion log channel:`, e);
                                        deletionLogChannel = null;
                                    }
                                }

                                // Überprüfen, ob der Bot die erforderliche Berechtigung zum Löschen des Kanals hat
                                const botMember = guild.members.cache.get(client.user.id);
                                if (!botMember || !botMember.permissionsIn(currentChannel).has(PermissionFlagsBits.ManageChannels)) {
                                    console.warn(`[JTC WARNING] Bot lacks ManageChannels permission for ${currentChannel.name}. Cannot delete.`);
                                    if (deletionLogChannel) {
                                        const errorEmbed = new EmbedBuilder()
                                            .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETION_FAILED_TITLE'))
                                            .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETION_FAILED_PERMISSION_DESCRIPTION', {
                                                channelName: currentChannel.name,
                                                channelId: currentChannel.id
                                            }))
                                            .setColor(0xFF0000)
                                            .setTimestamp();
                                        await deletionLogChannel.send({ embeds: [errorEmbed] });
                                    }
                                    return; // Bot kann Kanal nicht löschen, also abbrechen
                                }

                                let deleter = null;
                                try {
                                    const auditLogs = await guild.fetchAuditLogs({
                                        type: AuditLogEvent.ChannelDelete,
                                        limit: 1,
                                    });
                                    const latestLog = auditLogs.entries.first();
                                    if (latestLog &&
                                        latestLog.target.id === currentChannel.id && // Target ist der gelöschte Kanal
                                        Date.now() - latestLog.createdTimestamp < 5000) { // Innerhalb von 5 Sekunden
                                        deleter = latestLog.executor;
                                    }
                                } catch (error) {
                                    console.error(`[JTC] Fehler beim Abrufen des Audit Logs für Kanal-Löschung:`, error);
                                }
                                const deleterName = deleter ? (deleter.tag || deleter.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
                                const deleterId = deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN');

                                await currentChannel.delete(getTranslatedText(lang, 'jtc_event.channel_deleted_reason'));
                                console.log(`[JTC DEBUG] Deleted empty JTC channel: ${currentChannel.name}`);

                                if (deletionLogChannel) {
                                    const embed = new EmbedBuilder()
                                        .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETED_TITLE'))
                                        .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETED_DESCRIPTION', {
                                            channelName: currentChannel.name,
                                            channelId: currentChannel.id,
                                            deleterName: deleterName,
                                            deleterId: deleterId
                                        }))
                                        .setColor(0xFF0000) // Rot
                                        .setTimestamp();
                                    await deletionLogChannel.send({ embeds: [embed] });
                                    console.log(`[JTC DEBUG] JTC deletion log sent to channel ${deletionLogChannel.id}.`);
                                }
                            } else {
                                console.log(`[JTC DEBUG] Channel ${currentChannel.name} is empty but not identified as a JTC channel. Skipping deletion.`);
                            }
                        } else {
                            console.log(`[JTC DEBUG] Channel ${channel.name} is not empty or does not exist anymore. Skipping deletion check.`);
                        }
                    }, 1000); // 1 Sekunde Verzögerung
                }
            }
        } catch (error) {
            // Wenn der Fehler vor der Zuweisung von 'lang' auftritt
            const currentLang = lang || 'en'; // Fallback auf Englisch, falls lang nicht definiert ist
            const guildName = newState.guild?.name || getTranslatedText(currentLang, 'general.UNKNOWN');
            const userId = newState.member?.user.id || getTranslatedText(currentLang, 'general.UNKNOWN_ID');
            const userTag = newState.member?.user.tag || getTranslatedText(currentLang, 'general.UNKNOWN_USER');
            console.error(`[VoiceStateUpdate ERROR] Uncaught error in voiceStateUpdate event for user ${userTag} (${userId}) on guild "${guildName}":`, error);
            // Für einen allgemeinen Fehlerlog könntest du hier auch versuchen, einen Log-Kanal zu finden
            // Aber sei vorsichtig, um keine weiteren Fehler zu verursachen, wenn das System instabil ist.
        }
    },
};
