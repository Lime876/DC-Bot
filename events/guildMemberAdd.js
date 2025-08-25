// events/guildMemberAdd.js
import { Events, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getWelcomeConfigForGuild } from '../utils/welcomeConfig.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';
import path from 'node:path';
import fs from 'node:fs/promises'; // Use fs/promises for asynchronous file access
import { fileURLToPath } from 'node:url';

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to the configuration files
const INVITE_DATA_PATH = path.resolve(__dirname, '../data/inviteData.json');
const TRACKER_CONFIG_PATH = path.resolve(__dirname, '../data/trackerConfig.json');
const AUTOROLE_CONFIG_PATH = path.resolve(__dirname, '../data/autoroleConfig.json');

// Use Maps for the configurations
let autoroleConfigs = new Map();
let inviteData = new Map(); // Stores invite data per guild
let trackerConfigs = new Map(); // Stores tracker configurations per guild

/**
 * Loads the autorole configuration from the file.
 * @returns {Promise<void>}
 */
async function loadAutoroleConfig() {
    try {
        const data = await fs.readFile(AUTOROLE_CONFIG_PATH, 'utf8');
        autoroleConfigs = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[Autorole Event] Autorole configuration loaded.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[Autorole Event] autoroleConfig.json not found, creating empty configuration.');
            autoroleConfigs = new Map();
            await saveAutoroleConfig(); // Save empty configuration to create the file
        } else {
            logger.error('[Autorole Event] Error loading autorole configuration:', error);
            autoroleConfigs = new Map();
        }
    }
}

/**
 * Saves the autorole configuration to the file.
 * @param {Map<string, object>} configs - The configuration to be saved.
 * @returns {Promise<void>}
 */
async function saveAutoroleConfig(configs = autoroleConfigs) {
    try {
        const dir = path.dirname(AUTOROLE_CONFIG_PATH);
        await fs.mkdir(dir, {
            recursive: true
        }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(AUTOROLE_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
        logger.debug('[Autorole Event] Autorole configuration saved.');
    } catch (e) {
        logger.error(`[Autorole Event] Error writing to ${AUTOROLE_CONFIG_PATH}:`, e);
    }
}

/**
 * Loads the invite data from the file.
 * @returns {Promise<void>}
 */
async function loadInviteData() {
    try {
        const data = await fs.readFile(INVITE_DATA_PATH, 'utf8');
        inviteData = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[InviteTracker Event] Invite data loaded.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[InviteTracker Event] inviteData.json not found, creating empty data.');
            inviteData = new Map();
            await saveInviteData(); // Save empty data to create the file
        } else {
            logger.error('[InviteTracker Event] Error loading invite data:', error);
            inviteData = new Map();
        }
    }
}

/**
 * Saves the invite data to the file.
 * @param {Map<string, object>} data - The invite data to be saved.
 * @returns {Promise<void>}
 */
async function saveInviteData(data = inviteData) {
    try {
        const dir = path.dirname(INVITE_DATA_PATH);
        await fs.mkdir(dir, {
            recursive: true
        }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(INVITE_DATA_PATH, JSON.stringify(Object.fromEntries(data), null, 2), 'utf8');
        logger.debug('[InviteTracker Event] Invite data saved.');
    } catch (e) {
        logger.error(`[InviteTracker Event] Error writing to ${INVITE_DATA_PATH}:`, e);
    }
}

/**
 * Loads the tracker configuration from the file.
 * @returns {Promise<void>}
 */
async function loadTrackerConfig() {
    try {
        const data = await fs.readFile(TRACKER_CONFIG_PATH, 'utf8');
        trackerConfigs = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[InviteTracker Event] Tracker configuration loaded.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[InviteTracker Event] trackerConfig.json not found, creating empty configuration.');
            trackerConfigs = new Map();
            await saveTrackerConfig(); // Save empty configuration to create the file
        } else {
            logger.error('[InviteTracker Event] Error loading tracker configuration:', error);
            trackerConfigs = new Map();
        }
    }
}

/**
 * Saves the tracker configuration to the file.
 * @param {Map<string, object>} configs - The configuration to be saved.
 * @returns {Promise<void>}
 */
async function saveTrackerConfig(configs = trackerConfigs) {
    try {
        const dir = path.dirname(TRACKER_CONFIG_PATH);
        await fs.mkdir(dir, {
            recursive: true
        }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(TRACKER_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
        logger.debug('[InviteTracker Event] Tracker configuration saved.');
    } catch (e) {
        logger.error(`[InviteTracker Event] Error writing to ${TRACKER_CONFIG_PATH}:`, e);
    }
}

// Load all configurations and data at module start
// In a larger application, this could also be done in the main bot file on the 'ready' event.
loadAutoroleConfig();
loadInviteData();
loadTrackerConfig();


// Ein Event-Modul muss ein Standard-Export-Objekt haben,
// das die Eigenschaften 'name' und 'execute' enthält.
export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        if (member.user.bot) return; // Ignore bots

        const guild = member.guild;
        const lang = await getGuildLanguage(guild.id);
        const client = member.client; // Access the client via member.client

        // --- Autorole Logic ---
        try {
            const guildAutoroleConfig = autoroleConfigs.get(guild.id);

            if (guildAutoroleConfig && guildAutoroleConfig.autoroleId) {
                const autoroleId = guildAutoroleConfig.autoroleId;
                const role = guild.roles.cache.get(autoroleId);

                if (!role) {
                    logger.warn(`[Autorole Event] Configured autorole with ID ${autoroleId} in guild ${guild.name} (${guild.id}) not found. Removing from configuration.`);
                    // Role not found, clean up
                    autoroleConfigs.delete(guild.id); // Remove the entry for this guild
                    await saveAutoroleConfig();
                } else {
                    const botMember = guild.members.me;
                    // Check bot permissions and role hierarchy
                    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                        logger.error(`[Autorole Event] Bot does not have the 'Manage Roles' permission in guild ${guild.name} (${guild.id}) to assign autorole.`);
                        // Send error log to the general log channel if configured
                        const generalLogChannelId = getLogChannelId(guild.id, 'error');
                        if (generalLogChannelId) {
                            const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                            if (generalLogChannel && generalLogChannel.isTextBased()) {
                                const errorEmbed = new EmbedBuilder()
                                    .setColor(0xED4245) // Red
                                    .setTitle(getTranslatedText(lang, 'autorole_event.ERROR_TITLE')) // New translation
                                    .setDescription(getTranslatedText(lang, 'autorole_event.ERROR_PERMISSION_DENIED', {
                                        roleName: role.name
                                    })) // New translation
                                    .setTimestamp();
                                await generalLogChannel.send({
                                    embeds: [errorEmbed]
                                }).catch(err => logger.error(`[Autorole Event] Error sending error log for autorole (permissions):`, err));
                            }
                        }
                    } else if (botMember.roles.highest.position <= role.position) {
                        logger.error(`[Autorole Event] Bot role (${botMember.roles.highest.name}) is not high enough to assign role ${role.name} in guild ${guild.name} (${guild.id}).`);
                        // Send error log to the general log channel if configured
                        const generalLogChannelId = getLogChannelId(guild.id, 'error');
                        if (generalLogChannelId) {
                            const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                            if (generalLogChannel && generalLogChannel.isTextBased()) {
                                const errorEmbed = new EmbedBuilder()
                                    .setColor(0xED4245) // Red
                                    .setTitle(getTranslatedText(lang, 'autorole_event.ERROR_TITLE'))
                                    .setDescription(getTranslatedText(lang, 'autorole_event.ERROR_ROLE_HIERARCHY', {
                                        roleName: role.name,
                                        botRoleName: botMember.roles.highest.name
                                    })) // New translation
                                    .setTimestamp();
                                await generalLogChannel.send({
                                    embeds: [errorEmbed]
                                }).catch(err => logger.error(`[Autorole Event] Error sending error log for autorole (hierarchy):`, err));
                            }
                        }
                    } else {
                        await member.roles.add(role);
                        logger.info(`[Autorole Event] Role '${role.name}' successfully assigned to new member ${member.user.tag} in guild ${guild.name}.`);
                    }
                }
            } else {
                logger.debug(`[Autorole Event] No autorole configured for guild ${guild.name} (${guild.id}).`);
            }
        } catch (error) {
            logger.error(`[Autorole Event] Error in autorole logic for ${member.user.tag} in guild ${guild.name}:`, error);
            // Send error log to the general log channel if configured
            const generalLogChannelId = getLogChannelId(guild.id, 'error');
            if (generalLogChannelId) {
                const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                if (generalLogChannel && generalLogChannel.isTextBased()) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xED4245) // Red
                        .setTitle(getTranslatedText(lang, 'autorole_event.ERROR_TITLE'))
                        .setDescription(getTranslatedText(lang, 'autorole_event.ERROR_UNEXPECTED', {
                            errorMessage: error.message
                        })) // New translation
                        .setTimestamp();
                    await generalLogChannel.send({
                        embeds: [errorEmbed]
                    }).catch(err => logger.error(`[Autorole Event] Error sending error log for autorole (unexpected):`, err));
                }
            }
        }

        // --- Invite Tracker Logic ---
        const guildTrackerConfig = trackerConfigs.get(guild.id);
        if (guildTrackerConfig && guildTrackerConfig.enabled && guildTrackerConfig.channelId) {
            const logChannel = guild.channels.cache.get(guildTrackerConfig.channelId);
            if (logChannel && logChannel.isTextBased()) {
                try {
                    // Fetch invites of the server before the new member joins
                    const newInvites = await guild.invites.fetch();
                    // Get the old invites from the client's global cache (client.invites must be initialized in the main bot file)
                    const oldInvites = client.invites.get(guild.id); // Assumption: client.invites is a Map

                    let usedInvite = null;

                    // Find the invite that was used
                    if (oldInvites) {
                        for (const [code, invite] of newInvites) {
                            const oldInvite = oldInvites.get(code);
                            // If an invite is new or its usage has increased by 1
                            if (!oldInvite || invite.uses > oldInvite.uses) {
                                usedInvite = invite;
                                break;
                            }
                        }
                    }

                    // Update the client's global invite cache
                    client.invites.set(guild.id, new Map(newInvites.map(invite => [invite.code, invite])));

                    // Load current invite data for this guild
                    let currentInviteData = inviteData.get(guild.id) || {};

                    let inviter = null;
                    let inviteCode = getTranslatedText(lang, 'invite_tracker_event.UNKNOWN_INVITE');
                    let inviteUses = 0;

                    if (usedInvite) {
                        inviter = usedInvite.inviter;
                        inviteCode = usedInvite.code;
                        inviteUses = usedInvite.uses;

                        // Save or update the inviter's data
                        if (inviter) {
                            if (!currentInviteData[usedInvite.code]) {
                                currentInviteData[usedInvite.code] = {
                                    inviterId: inviter.id,
                                    uses: 0,
                                    code: usedInvite.code,
                                    maxUses: usedInvite.maxUses,
                                    expiresAt: usedInvite.expiresTimestamp // Store the timestamp
                                };
                            }
                            currentInviteData[usedInvite.code].uses = usedInvite.uses;
                            inviteData.set(guild.id, currentInviteData); // Update the map
                            await saveInviteData(); // Save the updated data
                        }
                    }

                    const inviterTag = inviter ? (inviter.tag || inviter.username) : getTranslatedText(lang, 'invite_tracker_event.UNKNOWN_INVITER');
                    const inviterId = inviter ? inviter.id : getTranslatedText(lang, 'general.UNKNOWN_ID');

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00) // Green for join
                        .setTitle(getTranslatedText(lang, 'invite_tracker_event.NEW_MEMBER_TITLE'))
                        .setDescription(getTranslatedText(lang, 'invite_tracker_event.NEW_MEMBER_DESCRIPTION', {
                            userTag: member.user.tag
                        }))
                        .setThumbnail(member.user.displayAvatarURL({
                            dynamic: true
                        }))
                        .addFields({
                            name: getTranslatedText(lang, 'invite_tracker_event.FIELD_USER'),
                            value: `${member.user.tag} (<@${member.user.id}>)`,
                            inline: false
                        }, {
                            name: getTranslatedText(lang, 'invite_tracker_event.FIELD_JOINED_VIA'),
                            value: `${inviteCode}`,
                            inline: true
                        }, {
                            name: getTranslatedText(lang, 'invite_tracker_event.FIELD_INVITED_BY'),
                            value: `${inviterTag} (<@${inviterId}>)`,
                            inline: true
                        })
                        .setTimestamp();

                    if (usedInvite) {
                        embed.addFields({
                            name: getTranslatedText(lang, 'invite_tracker_event.FIELD_INVITE_USES'),
                            value: `${inviteUses}`,
                            inline: true
                        });
                    }

                    await logChannel.send({
                        embeds: [embed]
                    });
                    logger.info(`[InviteTracker Event] New member ${member.user.tag} has joined (Invite: ${inviteCode}, Invited by: ${inviterTag}). (PID: ${process.pid})`);

                } catch (error) {
                    logger.error(`[InviteTracker Event] Error tracking new member ${member.user.tag} in guild ${guild.id}:`, error);
                    // Send error log to the general log channel if configured
                    const generalLogChannelId = getLogChannelId(guild.id, 'error');
                    if (generalLogChannelId) {
                        const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                        if (generalLogChannel && generalLogChannel.isTextBased()) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xED4245) // Red
                                .setTitle(getTranslatedText(lang, 'invite_tracker_event.ERROR_TITLE'))
                                .setDescription(getTranslatedText(lang, 'invite_tracker_event.ERROR_UNEXPECTED', {
                                    errorMessage: error.message
                                })) // New translation
                                .setTimestamp();
                            await generalLogChannel.send({
                                embeds: [errorEmbed]
                            }).catch(err => logger.error(`[InviteTracker Event] Error sending error log for Invite Tracker:`, err));
                        }
                    }
                }
            } else {
                logger.debug(`[InviteTracker Event] Invite Tracker for guild ${guild.name} (${guild.id}) not enabled or log channel invalid.`);
            }
        }


        // --- Send Welcome Message ---
        const welcomeConfig = getWelcomeConfigForGuild(guild.id);
        if (welcomeConfig) {
            const welcomeChannel = guild.channels.cache.get(welcomeConfig.channelId);
            if (welcomeChannel && welcomeChannel.isTextBased()) {
                // Check bot permissions in the welcome channel
                const botMember = guild.members.cache.get(client.user.id);
                if (!botMember.permissionsIn(welcomeChannel).has(PermissionsBitField.Flags.SendMessages) ||
                    !botMember.permissionsIn(welcomeChannel).has(PermissionsBitField.Flags.EmbedLinks)) {
                    logger.error(`[WelcomeMessage Event] Bot does not have sufficient permissions (SendMessages/EmbedLinks) in channel ${welcomeChannel.name} (${welcomeChannel.id}) in guild ${guild.name} (${guild.id}) to send welcome message.`);

                    // Send error log to the general log channel if configured
                    const generalLogChannelId = getLogChannelId(guild.id, 'error');
                    if (generalLogChannelId) {
                        const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                        if (generalLogChannel && generalLogChannel.isTextBased()) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xED4245) // Red
                                .setTitle(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_FAILED_TITLE'))
                                .setDescription(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_FAILED_DESCRIPTION', {
                                    userTag: member.user.tag,
                                    channelMention: welcomeChannel.toString(),
                                    errorMessage: getTranslatedText(lang, 'welcome_message_command.NO_PERMISSION_BOT') // Localized error message
                                }))
                                .setTimestamp();
                            await generalLogChannel.send({
                                embeds: [errorEmbed]
                            }).catch(err => logger.error(`[WelcomeMessage Event] Error sending error log for welcome message (permissions):`, err));
                        }
                    }
                    return; // Stop execution if permissions are missing
                }

                try {
                    // Replace placeholders in the message
                    const formattedMessage = welcomeConfig.messageContent
                        .replace(/{user}/g, member.user.username)
                        .replace(/{userMention}/g, `<@${member.id}>`)
                        .replace(/{server}/g, guild.name);

                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(0x0099ff) // Blue
                        .setTitle(getTranslatedText(lang, 'welcome_message_event.WELCOME_EMBED_TITLE', {
                            serverName: guild.name
                        }))
                        .setDescription(formattedMessage)
                        .setThumbnail(member.user.displayAvatarURL({
                            dynamic: true
                        }))
                        .setTimestamp();

                    await welcomeChannel.send({
                        embeds: [welcomeEmbed]
                    });
                    logger.info(`[WelcomeMessage Event] Welcome message for ${member.user.tag} in guild ${guild.name} sent to channel ${welcomeChannel.name}. (PID: ${process.pid})`);

                    // Send log to the general log channel (if configured)
                    const generalLogChannelId = getLogChannelId(guild.id, 'member_join'); // Use the member_join log type
                    if (generalLogChannelId) {
                        const logChannel = guild.channels.cache.get(generalLogChannelId);
                        if (logChannel && logChannel.isTextBased()) {
                            const welcomeLogEmbed = new EmbedBuilder()
                                .setColor(0x0099ff) // Blue
                                .setTitle(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_TITLE'))
                                .setDescription(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_DESCRIPTION', {
                                    userTag: member.user.tag,
                                    channelMention: welcomeChannel.toString()
                                }))
                                .addFields({
                                    name: getTranslatedText(lang, 'general.USER_ID'),
                                    value: member.id,
                                    inline: true
                                })
                                .setTimestamp();
                            await logChannel.send({
                                embeds: [welcomeLogEmbed]
                            }).catch(err => logger.error(`[WelcomeMessage Event] Error sending welcome log to the log channel:`, err));
                        }
                    }

                } catch (error) {
                    logger.error(`[WelcomeMessage Event] Error sending welcome message for ${member.user.tag} in guild ${guild.name}:`, error);
                    // Send error log to the general log channel if configured
                    const generalLogChannelId = getLogChannelId(guild.id, 'error');
                    if (generalLogChannelId) {
                        const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                        if (generalLogChannel && generalLogChannel.isTextBased()) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xED4245) // Red
                                .setTitle(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_FAILED_TITLE'))
                                .setDescription(getTranslatedText(lang, 'welcome_message_event.WELCOME_LOG_FAILED_DESCRIPTION', {
                                    userTag: member.user.tag,
                                    channelMention: welcomeChannel.toString(),
                                    errorMessage: error.message
                                }))
                                .setTimestamp();
                            await generalLogChannel.send({
                                embeds: [errorEmbed]
                            }).catch(err => logger.error(`[WelcomeMessage Event] Error sending error log for welcome message (unexpected):`, err));
                        }
                    }
                }
            } else {
                logger.warn(`[WelcomeMessage Event] Configured welcome channel ${welcomeConfig.channelId} for guild ${guild.id} is not a text channel or not accessible.`);
            }
        }
    }
};
