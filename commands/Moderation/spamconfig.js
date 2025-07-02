// commands/moderation/spamconfig.js
const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const ms = require('ms'); // Für einfache Zeitumrechnung (z.B. "10s" zu Millisekunden)

const spamConfigsPath = path.join(__dirname, '../../data/spamConfigs.json');

// Funktion zum Laden der Spam-Konfigurationen
const loadSpamConfigs = () => {
    if (fs.existsSync(spamConfigsPath)) {
        try {
            const data = fs.readFileSync(spamConfigsPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`[SpamConfig] Fehler beim Parsen von ${spamConfigsPath}:`, e);
            return {};
        }
    }
    return {};
};

// Funktion zum Speichern der Spam-Konfigurationen
const saveSpamConfigs = (configs) => {
    try {
        const dir = path.dirname(spamConfigsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(spamConfigsPath, JSON.stringify(configs, null, 2), 'utf8');
    } catch (e) {
        console.error(`[SpamConfig] Fehler beim Speichern von ${spamConfigsPath}:`, e);
    }
};

// Laden der Konfigurationen beim Start
let spamConfigs = loadSpamConfigs();

// Standardkonfiguration für einen neuen Server
const getDefaultSpamConfig = () => ({
    enabled: false,
    inviteDetectionEnabled: true,
    excessiveCapsThreshold: 0.5,
    blacklistedWords: [],
    blacklistedLinks: [],
    floodThreshold: {
        maxMessages: 5,
        timeframeMs: 10000, // 10 Sekunden
        sameMessageThreshold: 3
    },
    raidProtectionEnabled: false,
    raidThreshold: {
        messageCount: 10,
        timeframeMs: 15000,
        userCount: 5
    },
    characterSpamThreshold: 0.7, // NEU: Standard-Schwellenwert für Zeichen-Spam (70% gleiche Zeichen)
    moderationLogChannelId: null
});

// Helper, um die Konfiguration für einen bestimmten Server abzurufen
const getGuildSpamConfig = (guildId) => {
    if (!spamConfigs[guildId]) {
        spamConfigs[guildId] = getDefaultSpamConfig();
    } else {
        spamConfigs[guildId] = { ...getDefaultSpamConfig(), ...spamConfigs[guildId] };
        if (!Array.isArray(spamConfigs[guildId].blacklistedLinks)) {
            spamConfigs[guildId].blacklistedLinks = [];
        }
        if (!Array.isArray(spamConfigs[guildId].blacklistedWords)) {
            spamConfigs[guildId].blacklistedWords = [];
        }
        if (typeof spamConfigs[guildId].floodThreshold !== 'object' || spamConfigs[guildId].floodThreshold === null) {
            spamConfigs[guildId].floodThreshold = getDefaultSpamConfig().floodThreshold;
        } else {
            spamConfigs[guildId].floodThreshold = {
                ...getDefaultSpamConfig().floodThreshold,
                ...spamConfigs[guildId].floodThreshold
            };
        }
        if (typeof spamConfigs[guildId].raidThreshold !== 'object' || spamConfigs[guildId].raidThreshold === null) {
            spamConfigs[guildId].raidThreshold = getDefaultSpamConfig().raidThreshold;
        } else {
            spamConfigs[guildId].raidThreshold = {
                ...getDefaultSpamConfig().raidThreshold,
                ...spamConfigs[guildId].raidThreshold
            };
        }
        // Sicherstellen, dass characterSpamThreshold vorhanden ist
        if (typeof spamConfigs[guildId].characterSpamThreshold === 'undefined' || spamConfigs[guildId].characterSpamThreshold === null) {
            spamConfigs[guildId].characterSpamThreshold = getDefaultSpamConfig().characterSpamThreshold;
        }
    }
    saveSpamConfigs(spamConfigs);
    return spamConfigs[guildId];
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spamconfig')
        .setDescription('Manages the spam detection feature.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'spam_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'spam_command.DESCRIPTION'),
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enables spam detection for this server.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
                })
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disables spam detection for this server.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
                })
        )
        .addSubcommand(subcommand => // NEU: Zeichen-Spam Schwellenwert setzen
            subcommand
                .setName('set_character_spam_threshold')
                .setDescription('Sets the threshold for excessive repeating characters (0.0-1.0).')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.SET_CHARACTER_SPAM_THRESHOLD_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.SET_CHARACTER_SPAM_THRESHOLD_SUBCOMMAND_DESCRIPTION'),
                })
                .addNumberOption(option =>
                    option.setName('threshold')
                        .setDescription('Ratio of repeating characters (e.g., 0.7 for 70%).')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.CHARACTER_SPAM_THRESHOLD_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.CHARACTER_SPAM_THRESHOLD_OPTION_DESCRIPTION'),
                        })
                        .setRequired(true)
                        .setMinValue(0.1) // Mindestens 10%
                        .setMaxValue(1.0) // Maximal 100%
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('link')
                .setDescription('Manages blacklisted links for spam detection.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.LINK_GROUP_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.LINK_GROUP_DESCRIPTION'),
                })
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Adds a link or domain to the blacklist.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_ADD_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_ADD_SUBCOMMAND_DESCRIPTION'),
                        })
                        .addStringOption(option =>
                            option.setName('link_or_domain')
                                .setDescription('The full link or domain (e.g., "malicious.com" or "phishing.link/scam")')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.LINK_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.LINK_OPTION_DESCRIPTION'),
                                })
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Removes a link or domain from the blacklist.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_REMOVE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_REMOVE_SUBCOMMAND_DESCRIPTION'),
                        })
                        .addStringOption(option =>
                            option.setName('link_or_domain')
                                .setDescription('The link or domain to remove.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.LINK_OPTION_DESCRIPTION_REMOVE'),
                                    'en-US': getTranslatedText('en', 'spam_command.LINK_OPTION_DESCRIPTION_REMOVE'),
                                })
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Displays all blacklisted links.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_LIST_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_LIST_SUBCOMMAND_DESCRIPTION'),
                        })
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('raid')
                .setDescription('Manages raid protection settings.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.RAID_GROUP_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.RAID_GROUP_DESCRIPTION'),
                })
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enables raid protection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_ENABLE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_ENABLE_SUBCOMMAND_DESCRIPTION'),
                        })
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disables raid protection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_DISABLE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_DISABLE_SUBCOMMAND_DESCRIPTION'),
                        })
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('set_thresholds')
                        .setDescription('Sets thresholds for raid detection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_SET_THRESHOLDS_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_SET_THRESHOLDS_SUBCOMMAND_DESCRIPTION'),
                        })
                        .addIntegerOption(option =>
                            option.setName('message_count')
                                .setDescription('Number of similar messages to trigger detection.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_MESSAGE_COUNT_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_MESSAGE_COUNT_OPTION_DESCRIPTION'),
                                })
                                .setRequired(true)
                                .setMinValue(2)
                        )
                        .addStringOption(option =>
                            option.setName('time_period')
                                .setDescription('Time period for messages (e.g., "15s", "1m", "5m").')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_TIME_PERIOD_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_TIME_PERIOD_OPTION_DESCRIPTION'),
                                })
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option.setName('user_count')
                                .setDescription('Number of unique users sending similar messages.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_USER_COUNT_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_USER_COUNT_OPTION_DESCRIPTION'),
                                })
                                .setRequired(true)
                                .setMinValue(2)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Displays current raid protection settings.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_STATUS_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_STATUS_SUBCOMMAND_DESCRIPTION'),
                        })
                )
        ),
    category: 'Moderation',
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);
        const currentConfig = getGuildSpamConfig(guildId);
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        // Berechtigungsprüfung
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD') }),
                flags: [MessageFlags.Ephemeral]
            });
        }

        if (subcommandGroup === 'link') {
            const linkOrDomain = interaction.options.getString('link_or_domain');

            switch (subcommand) {
                case 'add':
                    let normalizedLink = linkOrDomain.replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/\/$/, '');
                    if (!currentConfig.blacklistedLinks.includes(normalizedLink)) {
                        currentConfig.blacklistedLinks.push(normalizedLink);
                        saveSpamConfigs(spamConfigs);
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.link_added_success', { link: normalizedLink }),
                            flags: [MessageFlags.Ephemeral]
                        });
                    } else {
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.link_already_added', { link: normalizedLink }),
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    break;
                case 'remove':
                    let normalizedLinkToRemove = linkOrDomain.replace(/^(https?:\/\/)?(www\.)?/i, '').replace(/\/$/, '');
                    const index = currentConfig.blacklistedLinks.indexOf(normalizedLinkToRemove);
                    if (index > -1) {
                        currentConfig.blacklistedLinks.splice(index, 1);
                        saveSpamConfigs(spamConfigs);
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.link_removed_success', { link: normalizedLinkToRemove }),
                            flags: [MessageFlags.Ephemeral]
                        });
                    } else {
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.link_not_found', { link: normalizedLinkToRemove }),
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    break;
                case 'list':
                    if (currentConfig.blacklistedLinks.length > 0) {
                        const linkList = currentConfig.blacklistedLinks.map(link => `- \`${link}\``).join('\n');
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.link_list', { links: linkList }),
                            flags: [MessageFlags.Ephemeral]
                        });
                    } else {
                        await interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.no_links_added'),
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    break;
            }
            return;
        }

        if (subcommandGroup === 'raid') {
            switch (subcommand) {
                case 'enable':
                    if (currentConfig.raidProtectionEnabled) {
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ALREADY_ENABLED'), flags: [MessageFlags.Ephemeral] });
                    }
                    currentConfig.raidProtectionEnabled = true;
                    saveSpamConfigs(spamConfigs);
                    await interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ENABLED_SUCCESS'), flags: [MessageFlags.Ephemeral] });
                    break;
                case 'disable':
                    if (!currentConfig.raidProtectionEnabled) {
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ALREADY_DISABLED'), flags: [MessageFlags.Ephemeral] });
                    }
                    currentConfig.raidProtectionEnabled = false;
                    saveSpamConfigs(spamConfigs);
                    await interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_DISABLED_SUCCESS'), flags: [MessageFlags.Ephemeral] });
                    break;
                case 'set_thresholds':
                    const messageCount = interaction.options.getInteger('message_count');
                    const timePeriodStr = interaction.options.getString('time_period');
                    const userCount = interaction.options.getInteger('user_count');

                    const timePeriodMs = ms(timePeriodStr);

                    if (isNaN(timePeriodMs) || timePeriodMs <= 0 || timePeriodMs > ms('1h')) {
                        return interaction.reply({
                            content: getTranslatedText(lang, 'spam_command.RAID_INVALID_TIME_PERIOD'),
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    currentConfig.raidThreshold.messageCount = messageCount;
                    currentConfig.raidThreshold.timeframeMs = timePeriodMs;
                    currentConfig.raidThreshold.userCount = userCount;
                    saveSpamConfigs(spamConfigs);

                    await interaction.reply({
                        content: getTranslatedText(lang, 'spam_command.RAID_THRESHOLDS_SET_SUCCESS', {
                            messageCount: messageCount,
                            timePeriod: timePeriodStr,
                            userCount: userCount
                        }),
                        flags: [MessageFlags.Ephemeral]
                    });
                    break;
                case 'status':
                    const raidStatus = currentConfig.raidProtectionEnabled ? getTranslatedText(lang, 'spam_command.STATUS_ENABLED_TEXT') : getTranslatedText(lang, 'spam_command.STATUS_DISABLED_TEXT');
                    const threshold = currentConfig.raidThreshold;

                    const statusEmbed = new EmbedBuilder()
                        .setColor(currentConfig.raidProtectionEnabled ? 'Green' : 'Red')
                        .setTitle(getTranslatedText(lang, 'spam_command.RAID_STATUS_TITLE'))
                        .setDescription(getTranslatedText(lang, 'spam_command.RAID_STATUS_DESCRIPTION', { status: raidStatus }))
                        .addFields(
                            { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_MESSAGE_COUNT'), value: `${threshold.messageCount}`, inline: true },
                            { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_TIME_PERIOD'), value: ms(threshold.timeframeMs, { long: true }), inline: true },
                            { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_USER_COUNT'), value: `${threshold.userCount}`, inline: true }
                        )
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [statusEmbed], flags: [MessageFlags.Ephemeral] });
                    break;
            }
            return;
        }

        // Bestehende Logik für 'enable' und 'disable' (allgemeine Spam-Erkennung)
        if (subcommand === 'enable') {
            if (currentConfig.enabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'spam_command.already_enabled'), flags: [MessageFlags.Ephemeral] });
            }
            currentConfig.enabled = true;
            saveSpamConfigs(spamConfigs);
            await interaction.reply({ content: getTranslatedText(lang, 'spam_command.enabled_success'), flags: [MessageFlags.Ephemeral] });
        } else if (subcommand === 'disable') {
            if (!currentConfig.enabled) {
                return interaction.reply({ content: getTranslatedText(lang, 'spam_command.already_disabled'), flags: [MessageFlags.Ephemeral] });
            }
            currentConfig.enabled = false;
            saveSpamConfigs(spamConfigs);
            await interaction.reply({ content: getTranslatedText(lang, 'spam_command.disabled_success'), flags: [MessageFlags.Ephemeral] });
        } else if (subcommand === 'set_character_spam_threshold') { // NEU: Behandlung des Unterbefehls
            const threshold = interaction.options.getNumber('threshold');
            currentConfig.characterSpamThreshold = threshold;
            saveSpamConfigs(spamConfigs);
            await interaction.reply({
                content: getTranslatedText(lang, 'spam_command.CHARACTER_SPAM_THRESHOLD_SET_SUCCESS', { threshold: (threshold * 100).toFixed(0) }),
                flags: [MessageFlags.Ephemeral]
            });
        }
    },
    getGuildSpamConfig
};
