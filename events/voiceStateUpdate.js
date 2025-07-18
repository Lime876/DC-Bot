// events/voiceStateUpdate.js
const { Events, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel, AuditLogEvent } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const { getJTCConfigForGuild } = require('../utils/jtcConfig');
const { activeJTCChannels } = require('../utils/sharedState'); // Importiere activeJTCChannels
const logger = require('../utils/logger'); // Importiere den Logger

const creatingChannelForUser = new Set();
const COOLDOWN_MS = 2000;

// Hilfsfunktion zum Senden von Logs
async function sendVoiceLog(guild, logType, user, channel, oldChannel = null, moderator = null) {
    const lang = await getGuildLanguage(guild.id);
    const logChannelId = getLogChannelId(guild.id, logType);

    if (!logChannelId) {
        // logger.debug(`[VoiceStateUpdate Event] Kein Log-Kanal für '${logType}' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
        return;
    }

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel || !logChannel.isTextBased()) {
        logger.warn(`[VoiceStateUpdate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
        return;
    }

    let embed;
    let description;
    let color;
    let authorText;

    switch (logType) {
        case 'voice_join':
            authorText = getTranslatedText(lang, 'voice_state_update.JOIN_AUTHOR_TEXT', { userTag: user.tag });
            description = getTranslatedText(lang, 'voice_state_update.JOIN_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x57F287; // Grün
            break;
        case 'voice_leave':
            authorText = getTranslatedText(lang, 'voice_state_update.LEAVE_AUTHOR_TEXT', { userTag: user.tag });
            description = getTranslatedText(lang, 'voice_state_update.LEAVE_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0xED4245; // Rot
            break;
        case 'voice_move':
            authorText = getTranslatedText(lang, 'voice_state_update.MOVE_AUTHOR_TEXT', { userTag: user.tag });
            description = getTranslatedText(lang, 'voice_state_update.MOVE_DESCRIPTION', { userTag: user.tag, oldChannelName: oldChannel.name, newChannelName: channel.name });
            color = 0xFEE75C; // Gelb
            break;
        case 'voice_mute_self':
            authorText = getTranslatedText(lang, 'voice_state_update.MUTE_SELF_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.MUTE_SELF_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x5865F2; // Blau
            break;
        case 'voice_unmute_self':
            authorText = getTranslatedText(lang, 'voice_state_update.UNMUTE_SELF_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.UNMUTE_SELF_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x5865F2; // Blau
            break;
        case 'voice_deafen_self':
            authorText = getTranslatedText(lang, 'voice_state_update.DEAFEN_SELF_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.DEAFEN_SELF_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x5865F2; // Blau
            break;
        case 'voice_undeafen_self':
            authorText = getTranslatedText(lang, 'voice_state_update.UNDEAFEN_SELF_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.UNDEAFEN_SELF_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x5865F2; // Blau
            break;
        case 'voice_mute_server':
            authorText = getTranslatedText(lang, 'voice_state_update.MUTE_SERVER_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.MUTE_SERVER_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x992D22; // Dunkelrot
            break;
        case 'voice_unmute_server':
            authorText = getTranslatedText(lang, 'voice_state_update.UNMUTE_SERVER_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.UNMUTE_SERVER_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x992D22; // Dunkelrot
            break;
        case 'voice_deafen_server':
            authorText = getTranslatedText(lang, 'voice_state_update.DEAFEN_SERVER_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.DEAFEN_SERVER_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x992D22; // Dunkelrot
            break;
        case 'voice_undeafen_server':
            authorText = getTranslatedText(lang, 'voice_state_update.UNDEAFEN_SERVER_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.UNDEAFEN_SERVER_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x992D22; // Dunkelrot
            break;
        case 'voice_stream_start':
            authorText = getTranslatedText(lang, 'voice_state_update.STREAM_START_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.STREAM_START_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0xEB459E; // Pink
            break;
        case 'voice_stream_stop':
            authorText = getTranslatedText(lang, 'voice_state_update.STREAM_STOP_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.STREAM_STOP_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x7289DA; // Grau-Blau
            break;
        case 'voice_video_start':
            authorText = getTranslatedText(lang, 'voice_state_update.VIDEO_START_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.VIDEO_START_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x206694; // Dunkelblau
            break;
        case 'voice_video_stop':
            authorText = getTranslatedText(lang, 'voice_state_update.VIDEO_STOP_TITLE');
            description = getTranslatedText(lang, 'voice_state_update.VIDEO_STOP_DESCRIPTION', { userTag: user.tag, channelName: channel.name });
            color = 0x7289DA; // Grau-Blau
            break;
        default:
            return; // Unbekannter Log-Typ
    }

    embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: authorText,
            iconURL: user.displayAvatarURL(),
        })
        .setDescription(description)
        .addFields(
            { name: getTranslatedText(lang, 'voice_state_update.FIELD_USER'), value: `${user.tag} (<@${user.id}>)`, inline: true },
            { name: getTranslatedText(lang, 'voice_state_update.FIELD_CHANNEL'), value: `${channel.name} (<#${channel.id}>)`, inline: true }
        )
        .setTimestamp();

    if (logType.includes('server') && moderator) {
        embed.addFields(
            { name: getTranslatedText(lang, 'voice_state_update.FIELD_MODERATOR'), value: `${moderator.tag} (<@${moderator.id}>)`, inline: false }
        );
    }
    if (logType === 'voice_move') {
        embed.addFields(
            { name: getTranslatedText(lang, 'voice_state_update.FROM_CHANNEL'), value: `${oldChannel.name} (<#${oldChannel.id}>)`, inline: true },
            { name: getTranslatedText(lang, 'voice_state_update.TO_CHANNEL'), value: `${channel.name} (<#${channel.id}>)`, inline: true }
        );
    }

    try {
        await logChannel.send({ embeds: [embed] });
        logger.info(`[VoiceStateUpdate Event] Log '${logType}' für Benutzer ${user.tag} in Gilde ${guild.name} gesendet. (PID: ${process.pid})`);
    } catch (error) {
        logger.error(`[VoiceStateUpdate Event] Fehler beim Senden des '${logType}'-Logs für ${user.tag}:`, error);
    }
}


module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        const user = newState.member?.user;
        const guild = newState.guild;

        if (!guild || !user || user.bot) {
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const currentChannel = newState.channel;
        const oldChannel = oldState.channel;

        // --- Kanal-Beitritt, -Verlassen, -Wechsel Logik ---
        if (!oldChannel && currentChannel) { // Benutzer ist beigetreten
            await sendVoiceLog(guild, 'voice_join', user, currentChannel);
        } else if (oldChannel && !currentChannel) { // Benutzer hat verlassen
            await sendVoiceLog(guild, 'voice_leave', user, oldChannel);
        } else if (oldChannel && currentChannel && oldChannel.id !== currentChannel.id) { // Benutzer hat gewechselt
            await sendVoiceLog(guild, 'voice_move', user, currentChannel, oldChannel);
        }

        // --- Mute/Deafen (Self) Logik ---
        if (oldState.selfMute !== newState.selfMute) {
            if (newState.selfMute) {
                await sendVoiceLog(guild, 'voice_mute_self', user, currentChannel || oldChannel);
            } else {
                await sendVoiceLog(guild, 'voice_unmute_self', user, currentChannel || oldChannel);
            }
        }
        if (oldState.selfDeaf !== newState.selfDeaf) {
            if (newState.selfDeaf) {
                await sendVoiceLog(guild, 'voice_deafen_self', user, currentChannel || oldChannel);
            } else {
                await sendVoiceLog(guild, 'voice_undeafen_self', user, currentChannel || oldChannel);
            }
        }

        // --- Mute/Deafen (Server) Logik ---
        // Versuche, den Moderator aus dem Audit-Log zu holen
        let moderator = null;
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberUpdate, // Server Mute/Deafen ist MemberUpdate
                limit: 1,
            });
            const latestLog = auditLogs.entries.first();

            if (latestLog && latestLog.target.id === user.id && Date.now() - latestLog.createdAt.getTime() < 5000) {
                // Überprüfe, ob es sich um eine Mute/Deafen-Änderung handelt
                const changes = latestLog.changes;
                const isMuteChange = changes.some(c => c.key === 'mute' && (c.old !== c.new));
                const isDeafenChange = changes.some(c => c.key === 'deaf' && (c.old !== c.new));

                if ((isMuteChange || isDeafenChange) && latestLog.executor) {
                    moderator = latestLog.executor;
                }
            }
        } catch (error) {
            logger.error(`[VoiceStateUpdate Event] Fehler beim Abrufen des Audit-Logs für Server-Mute/Deafen für ${user.tag}:`, error);
        }

        if (oldState.serverMute !== newState.serverMute) {
            if (newState.serverMute) {
                await sendVoiceLog(guild, 'voice_mute_server', user, currentChannel || oldChannel, null, moderator);
            } else {
                await sendVoiceLog(guild, 'voice_unmute_server', user, currentChannel || oldChannel, null, moderator);
            }
        }
        if (oldState.serverDeaf !== newState.serverDeaf) {
            if (newState.serverDeaf) {
                await sendVoiceLog(guild, 'voice_deafen_server', user, currentChannel || oldChannel, null, moderator);
            } else {
                await sendVoiceLog(guild, 'voice_undeafen_server', user, currentChannel || oldChannel, null, moderator);
            }
        }

        // --- Streaming und Video Logik ---
        if (oldState.streaming !== newState.streaming) {
            if (newState.streaming) {
                await sendVoiceLog(guild, 'voice_stream_start', user, currentChannel || oldChannel);
            } else {
                await sendVoiceLog(guild, 'voice_stream_stop', user, currentChannel || oldChannel);
            }
        }
        if (oldState.selfVideo !== newState.selfVideo) {
            if (newState.selfVideo) {
                await sendVoiceLog(guild, 'voice_video_start', user, currentChannel || oldChannel);
            } else {
                await sendVoiceLog(guild, 'voice_video_stop', user, currentChannel || oldChannel);
            }
        }


        // --- JTC (Join to Create) Logik (unverändert, aber in sendVoiceLog refactored) ---
        const guildJTCConfig = getJTCConfigForGuild(guild.id);

        if (!guildJTCConfig || !guildJTCConfig.channelId) {
            return;
        }

        const jtcChannelId = guildJTCConfig.channelId;
        const jtcCategoryId = guildJTCConfig.categoryId;

        // Wenn ein Benutzer dem JTC-Kanal beitritt
        if (newState.channelId === jtcChannelId && oldState.channelId !== jtcChannelId) {
            if (creatingChannelForUser.has(user.id)) {
                return;
            }
            creatingChannelForUser.add(user.id);

            const creationLogChannelId = getLogChannelId(guild.id, 'jtc_channel_create');
            let creationLogChannel = null;
            if (creationLogChannelId) {
                try {
                    creationLogChannel = await guild.channels.fetch(creationLogChannelId);
                    if (!(creationLogChannel instanceof TextChannel)) {
                        logger.warn(`[JTC] JTC creation log channel (${creationLogChannelId}) is not a text channel.`);
                        creationLogChannel = null;
                    }
                } catch (e) {
                    logger.error(`[JTC] Error fetching JTC creation log channel:`, e);
                    creationLogChannel = null;
                }
            }

            try {
                const newChannelName = getTranslatedText(lang, 'jtc_event.default_channel_name', { username: user.username });
                const newChannel = await guild.channels.create({
                    name: newChannelName,
                    type: ChannelType.GuildVoice,
                    parent: jtcCategoryId,
                    permissionOverwrites: [
                        {
                            id: newState.member.id,
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
                            id: guild.roles.everyone.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.Speak
                            ],
                            deny: []
                        }
                    ]
                });

                activeJTCChannels.add(newChannel.id);
                await newState.member.voice.setChannel(newChannel);

                if (creationLogChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATED_DESCRIPTION', {
                            userTag: user.tag,
                            channelName: newChannel.name,
                            channelId: newChannel.id,
                            creatorId: user.id
                        }))
                        .setColor(0x57F287)
                        .setTimestamp();
                    await creationLogChannel.send({ embeds: [embed] });
                }

            } catch (error) {
                logger.error(`[JTC ERROR] Failed to create/move channel for ${user.tag} in guild ${guild.name}:`, error);
                if (creationLogChannel) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATION_FAILED_TITLE'))
                        .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_CREATION_FAILED_DESCRIPTION', {
                            userTag: user.tag,
                            errorMessage: error.message
                        }))
                        .setColor(0xFF0000)
                        .setTimestamp();
                    await creationLogChannel.send({ embeds: [errorEmbed] });
                }
            } finally {
                setTimeout(() => {
                    creatingChannelForUser.delete(user.id);
                }, COOLDOWN_MS);
            }
        }
        // Wenn ein Benutzer einen Kanal verlässt und dieser leer wird, UND es ein vom BOT erstellter JTC-Kanal ist
        else if (oldState.channelId && !newState.channelId && oldState.channel.type === ChannelType.GuildVoice) {
            const channel = oldState.channel;

            setTimeout(async () => {
                const currentChannel = await guild.channels.fetch(channel.id).catch(() => null);

                if (currentChannel && currentChannel.members.size === 0 && activeJTCChannels.has(currentChannel.id)) {
                    const deletionLogChannelId = getLogChannelId(guild.id, 'jtc_channel_delete');
                    let deletionLogChannel = null;
                    if (deletionLogChannelId) {
                        try {
                            deletionLogChannel = await guild.channels.fetch(deletionLogChannelId);
                            if (!(deletionLogChannel instanceof TextChannel)) {
                                logger.warn(`[JTC] JTC deletion log channel (${deletionLogChannelId}) is not a text channel.`);
                                deletionLogChannel = null;
                            }
                        } catch (e) {
                            logger.error(`[JTC] Error fetching JTC deletion log channel:`, e);
                            deletionLogChannel = null;
                        }
                    }

                    const botMember = guild.members.cache.get(client.user.id);
                    if (!botMember || !botMember.permissionsIn(currentChannel).has(PermissionFlagsBits.ManageChannels)) {
                        logger.warn(`[JTC WARNING] Bot lacks ManageChannels permission for ${currentChannel.name}. Cannot delete.`);
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
                        return;
                    }

                    let deleter = null;
                    try {
                        const auditLogs = await guild.fetchAuditLogs({
                            type: AuditLogEvent.ChannelDelete,
                            limit: 1,
                        });
                        const latestLog = auditLogs.entries.first();
                        if (latestLog &&
                            latestLog.target.id === currentChannel.id &&
                            Date.now() - latestLog.createdTimestamp < 5000) {
                            deleter = latestLog.executor;
                        }
                    } catch (error) {
                        logger.error(`[JTC] Fehler beim Abrufen des Audit Logs für Kanal-Löschung:`, error);
                    }
                    const deleterName = deleter ? (deleter.tag || deleter.username) : getTranslatedText(lang, 'general.UNKNOWN_USER');
                    const deleterId = deleter ? deleter.id : getTranslatedText(lang, 'general.UNKNOWN');

                    await currentChannel.delete(getTranslatedText(lang, 'jtc_event.channel_deleted_reason'));
                    activeJTCChannels.delete(currentChannel.id); // Kanal-ID aus dem Set entfernen

                    if (deletionLogChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETED_TITLE'))
                            .setDescription(getTranslatedText(lang, 'jtc_event.CHANNEL_DELETED_DESCRIPTION', {
                                channelName: currentChannel.name,
                                channelId: currentChannel.id,
                                deleterName: deleterName,
                                deleterId: deleterId
                            }))
                            .setColor(0xFF0000)
                            .setTimestamp();
                        await deletionLogChannel.send({ embeds: [embed] });
                    }
                }
            }, 1000);
        }
    },
};