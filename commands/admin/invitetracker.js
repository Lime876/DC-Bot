// commands/invitetracker.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils'); // Importiere Sprachfunktionen

const inviteDataPath = path.join(__dirname, '../data/inviteData.json');
const trackerConfigPath = path.join(__dirname, '../../data/trackerConfig.json');

/**
 * Lädt die Invite-Daten aus der Datei.
 * @returns {object} Die Invite-Daten oder ein leeres Objekt.
 */
const loadInviteData = () => {
    if (fs.existsSync(inviteDataPath)) {
        try {
            return JSON.parse(fs.readFileSync(inviteDataPath, 'utf8'));
        } catch (e) {
            console.error(`[InviteTracker] Fehler beim Parsen von ${inviteDataPath}:`, e);
            return {};
        }
    }
    return {};
};

/**
 * Speichert die Invite-Daten in der Datei.
 * @param {object} data - Die zu speichernden Invite-Daten.
 */
const saveInviteData = (data) => {
    try {
        const dir = path.dirname(inviteDataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(inviteDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[InviteTracker] Fehler beim Schreiben in ${inviteDataPath}:`, e);
    }
};

/**
 * Lädt die Tracker-Konfiguration aus der Datei.
 * @returns {object} Die Konfiguration oder ein leeres Objekt.
 */
const loadTrackerConfig = () => {
    if (fs.existsSync(trackerConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(trackerConfigPath, 'utf8'));
        } catch (e) {
            console.error(`[InviteTracker] Fehler beim Parsen von ${trackerConfigPath}:`, e);
            return {};
        }
    }
    return {};
};

/**
 * Speichert die Tracker-Konfiguration in der Datei.
 * @param {object} config - Die zu speichernde Konfiguration.
 */
const saveTrackerConfig = (config) => {
    try {
        const dir = path.dirname(trackerConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(trackerConfigPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(`[InviteTracker] Fehler beim Schreiben in ${trackerConfigPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitetracker')
        .setDescription('Manages the Invite Tracker or displays invite statistics.') // Fallback-Beschreibung
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'invitetracker_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'invitetracker_command.DESCRIPTION'),
        })
        .setDMPermission(false) // Kann nicht in DMs verwendet werden
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Displays the current status of the Invite Tracker.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.STATUS_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.STATUS_SUBCOMMAND_DESCRIPTION'),
                }))
        .addSubcommand(subcommand =>
            subcommand
                .setName('on')
                .setDescription('Activates the Invite Tracker for this server.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.ON_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.ON_SUBCOMMAND_DESCRIPTION'),
                })
                .addChannelOption(option =>
                    option.setName('log_channel') // Option umbenannt zu 'log_channel' für Konsistenz
                        .setDescription('Channel to send join logs to.') // Fallback-Beschreibung
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'invitetracker_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'invitetracker_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
                        })
                        .addChannelTypes(ChannelType.GuildText) // Nur Textkanäle
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('off')
                .setDescription('Deactivates the Invite Tracker for this server.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.OFF_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.OFF_SUBCOMMAND_DESCRIPTION'),
                }))
        .addSubcommand(subcommand =>
            subcommand
                .setName('my_invites') // Umbenannt zu 'my_invites' für Konsistenz
                .setDescription('Shows how many people you have invited.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.MY_INVITES_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.MY_INVITES_SUBCOMMAND_DESCRIPTION'),
                }))
        .addSubcommand(subcommand =>
            subcommand
                .setName('user_invites') // Umbenannt zu 'user_invites' für Konsistenz
                .setDescription('Shows how many people a specific user has invited.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.USER_INVITES_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.USER_INVITES_SUBCOMMAND_DESCRIPTION'),
                })
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose invite statistics to display.') // Fallback-Beschreibung
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'invitetracker_command.USER_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'invitetracker_command.USER_OPTION_DESCRIPTION'),
                        })
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Displays the top inviters on the server.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'invitetracker_command.LEADERBOARD_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'invitetracker_command.LEADERBOARD_SUBCOMMAND_DESCRIPTION'),
                })),

    category: 'Admin',

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);
        let trackerConfig = loadTrackerConfig();
        let inviteData = loadInviteData();

        if (!trackerConfig[guildId]) {
            trackerConfig[guildId] = { enabled: false, channelId: null };
            saveTrackerConfig(trackerConfig);
        }

        const isEnabled = trackerConfig[guildId].enabled;

        // Manuelle Berechtigungsprüfung für "on" und "off" Subcommands und "leaderboard"
        if (['on', 'off', 'leaderboard'].includes(subcommand)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD') }),
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        if (subcommand === 'status') {
            const statusEmbed = new EmbedBuilder()
                .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
                .setTitle(getTranslatedText(lang, 'invitetracker_command.STATUS_TITLE'))
                .setDescription(getTranslatedText(lang, 'invitetracker_command.STATUS_DESCRIPTION', {
                    status: isEnabled ? getTranslatedText(lang, 'invitetracker_command.STATUS_ENABLED') : getTranslatedText(lang, 'invitetracker_command.STATUS_DISABLED')
                }))
                .setTimestamp();
            
            if (isEnabled && trackerConfig[guildId].channelId) {
                statusEmbed.addFields(
                    { name: getTranslatedText(lang, 'invitetracker_command.STATUS_FIELD_LOG_CHANNEL'), value: `<#${trackerConfig[guildId].channelId}>`, inline: true }
                );
            }

            await interaction.reply({ embeds: [statusEmbed], ephemeral: true });

        } else if (subcommand === 'on') {
            if (isEnabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'invitetracker_command.ALREADY_ENABLED'), flags: [MessageFlags.Ephemeral] });
            }

            const logChannel = interaction.options.getChannel('log_channel'); // Name der Option angepasst
            trackerConfig[guildId].enabled = true;
            trackerConfig[guildId].channelId = logChannel.id;
            saveTrackerConfig(trackerConfig);

            // Bot muss jetzt alle Invites neu cachen, um ein sauberes Starten zu gewährleisten
            try {
                // Überprüfe, ob der Bot die Berechtigung 'Manage Guild' oder 'Manage Channels' hat,
                // um Invites zu fetchen. Discord.js benötigt 'Manage Guild' für guild.invites.fetch().
                if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    console.warn(`[Invite Tracker] Bot lacks ManageGuild permission in guild ${guildId}. Cannot fetch invites.`);
                    return interaction.reply({
                        content: getTranslatedText(lang, 'invitetracker_command.ENABLE_FAIL_PERMS'),
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                await interaction.guild.invites.fetch();
                console.log(`[Invite Tracker] Invites für Server "${interaction.guild.name}" (${guildId}) neu gecacht nach Aktivierung.`);
            } catch (error) {
                console.error(`[Invite Tracker] Konnte Invites für Server ${guildId} nicht cachen:`, error);
                return interaction.reply({
                    content: getTranslatedText(lang, 'invitetracker_command.ENABLE_FAIL_PERMS'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const enableEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(getTranslatedText(lang, 'invitetracker_command.ENABLE_TITLE'))
                .setDescription(getTranslatedText(lang, 'invitetracker_command.ENABLE_DESCRIPTION', { logChannel: logChannel.toString() }))
                .setTimestamp();
            await interaction.reply({ embeds: [enableEmbed] });

        } else if (subcommand === 'off') {
            if (!isEnabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'invitetracker_command.ALREADY_DISABLED'), flags: [MessageFlags.Ephemeral] });
            }

            trackerConfig[guildId].enabled = false;
            trackerConfig[guildId].channelId = null; // Log-Kanal zurücksetzen
            saveTrackerConfig(trackerConfig);

            const disableEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(getTranslatedText(lang, 'invitetracker_command.DISABLE_TITLE'))
                .setDescription(getTranslatedText(lang, 'invitetracker_command.DISABLE_DESCRIPTION'))
                .setTimestamp();
            await interaction.reply({ embeds: [disableEmbed] });

        } else if (subcommand === 'my_invites' || subcommand === 'user_invites') {
            if (!isEnabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'invitetracker_command.NOT_ENABLED'), flags: [MessageFlags.Ephemeral] });
            }

            const targetUser = subcommand === 'my_invites' ? interaction.user : interaction.options.getUser('user');
            
            const userInvites = inviteData[guildId] ? Object.values(inviteData[guildId]).filter(inv => inv.inviterId === targetUser.id) : [];

            let totalUses = 0;
            let activeInvitesCount = 0;
            userInvites.forEach(inv => {
                totalUses += inv.uses;
                if (inv.maxUses === 0 || inv.uses < inv.maxUses) { // Ist noch nicht ausgeschöpft
                    if (!inv.expiresAt || inv.expiresAt > Date.now()) { // Ist nicht abgelaufen
                         activeInvitesCount++;
                    }
                }
            });

            const userEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle(getTranslatedText(lang, 'invitetracker_command.USER_STATS_TITLE', { userTag: targetUser.tag }))
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: getTranslatedText(lang, 'invitetracker_command.FIELD_TOTAL_INVITES'), value: `${totalUses}`, inline: true },
                    { name: getTranslatedText(lang, 'invitetracker_command.FIELD_ACTIVE_INVITES'), value: `${activeInvitesCount}`, inline: true }
                )
                .setTimestamp();
            
            if (userInvites.length > 0) {
                const inviteCodesList = userInvites.map(inv => `\`${inv.code}\` (${inv.uses} ${getTranslatedText(lang, 'invitetracker_command.INVITE_USES')})`).join(', ');
                userEmbed.addFields(
                    { name: getTranslatedText(lang, 'invitetracker_command.FIELD_YOUR_INVITES'), value: inviteCodesList.length > 1024 ? inviteCodesList.substring(0, 1020) + '...' : inviteCodesList, inline: false }
                );
            } else {
                 userEmbed.addFields(
                    { name: getTranslatedText(lang, 'invitetracker_command.FIELD_YOUR_INVITES'), value: getTranslatedText(lang, 'invitetracker_command.NO_ACTIVE_INVITES'), inline: false }
                );
            }

            await interaction.reply({ embeds: [userEmbed], ephemeral: false });
        }
        else if (subcommand === 'leaderboard') {
            if (!isEnabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'invitetracker_command.NOT_ENABLED'), flags: [MessageFlags.Ephemeral] });
            }

            if (!inviteData[guildId] || Object.keys(inviteData[guildId]).length === 0) {
                return interaction.reply({ content: getTranslatedText(lang, 'invitetracker_command.NO_INVITE_DATA_LEADERBOARD'), flags: [MessageFlags.Ephemeral] });
            }

            const inviterStats = {}; // { inviterId: totalUses }

            for (const inviteCode in inviteData[guildId]) {
                const invite = inviteData[guildId][inviteCode];
                if (invite.inviterId) {
                    if (!inviterStats[invite.inviterId]) {
                        inviterStats[invite.inviterId] = 0;
                    }
                    inviterStats[invite.inviterId] += invite.uses;
                }
            }

            const sortedInviters = Object.entries(inviterStats).sort(([, a], [, b]) => b - a);

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_TITLE'))
                .setDescription(getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_DESCRIPTION'))
                .setTimestamp();

            let rank = 1;
            for (const [inviterId, uses] of sortedInviters.slice(0, 10)) { // Top 10
                const user = await interaction.client.users.fetch(inviterId).catch(() => null);
                if (user) {
                    leaderboardEmbed.addFields({
                        name: `${rank}. ${user.tag}`,
                        value: getTranslatedText(lang, 'invitetracker_command.LEADERBOARD_INVITES_COUNT', { uses: uses }),
                        inline: false
                    });
                    rank++;
                }
            }

            if (leaderboardEmbed.data.fields && leaderboardEmbed.data.fields.length === 0) {
                 leaderboardEmbed.setDescription(getTranslatedText(lang, 'invitetracker_command.NO_STATS_AVAILABLE'));
            }

            await interaction.reply({ embeds: [leaderboardEmbed], ephemeral: false });
        }
    },
};
