// commands/Moderation/spamconfig.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs/promises');
const path = require('node:path');
const { getTranslatedText, getGuildLanguage } = require('../../utils/languageUtils');
const logger = require('../../utils/logger'); // Importiere den neuen Logger

const SPAM_CONFIG_PATH = path.join(__dirname, '..', '..', 'data', 'spamConfig.json');

let spamConfigs = {};

/**
 * Lädt die Spam-Konfigurationen aus der Datei.
 */
async function loadSpamConfigs() {
    try {
        const data = await fs.readFile(SPAM_CONFIG_PATH, 'utf8');
        spamConfigs = JSON.parse(data);
        logger.debug('[SpamConfig] Spam-Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[SpamConfig] spamConfig.json nicht gefunden, erstelle leere Konfiguration.');
            spamConfigs = {};
            await saveSpamConfigs(spamConfigs); // Speichere die leere Konfiguration
        } else {
            logger.error('[SpamConfig] Fehler beim Laden der Spam-Konfiguration:', error);
        }
    }
}

/**
 * Speichert die Spam-Konfigurationen in die Datei.
 * @param {object} configs - Die zu speichernden Konfigurationen.
 */
async function saveSpamConfigs(configs) {
    try {
        await fs.writeFile(SPAM_CONFIG_PATH, JSON.stringify(configs, null, 2), 'utf8');
        spamConfigs = configs; // Aktualisiere den In-Memory-Cache
        logger.debug('[SpamConfig] Spam-Konfiguration gespeichert.');
    } catch (error) {
        logger.error('[SpamConfig] Fehler beim Speichern der Spam-Konfiguration:', error);
    }
}

// Initiales Laden der Konfigurationen beim Start
loadSpamConfigs();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spamconfig')
        .setDescription('Manages the spam detection feature.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'spam_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'spam_command.DESCRIPTION')
        })
        .setDefaultMemberPermissions(0) // Nur für Admins
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enables spam detection for this server.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.ENABLE_SUBCOMMAND_DESCRIPTION')
                }))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disables spam detection for this server.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.DISABLE_SUBCOMMAND_DESCRIPTION')
                }))
        .addSubcommandGroup(group =>
            group
                .setName('link')
                .setDescription('Manages blacklisted links for spam detection.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.LINK_GROUP_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.LINK_GROUP_DESCRIPTION')
                })
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Adds a link or domain to the blacklist.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_ADD_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_ADD_SUBCOMMAND_DESCRIPTION')
                        })
                        .addStringOption(option =>
                            option.setName('link')
                                .setDescription('The full link or domain (e.g., "malicious.com" or "phishing.link/scam").')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.LINK_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.LINK_OPTION_DESCRIPTION')
                                })
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Removes a link or domain from the blacklist.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_REMOVE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_REMOVE_SUBCOMMAND_DESCRIPTION')
                        })
                        .addStringOption(option =>
                            option.setName('link')
                                .setDescription('The link or domain to remove.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.LINK_OPTION_DESCRIPTION_REMOVE'),
                                    'en-US': getTranslatedText('en', 'spam_command.LINK_OPTION_DESCRIPTION_REMOVE')
                                })
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('Displays all blacklisted links.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.LINK_LIST_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.LINK_LIST_SUBCOMMAND_DESCRIPTION')
                        })))
        .addSubcommandGroup(group =>
            group
                .setName('raid')
                .setDescription('Manages raid protection settings.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.RAID_GROUP_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.RAID_GROUP_DESCRIPTION')
                })
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enables raid protection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_ENABLE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_ENABLE_SUBCOMMAND_DESCRIPTION')
                        }))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disables raid protection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_DISABLE_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_DISABLE_SUBCOMMAND_DESCRIPTION')
                        }))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('set-thresholds')
                        .setDescription('Sets the thresholds for raid detection.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_SET_THRESHOLDS_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_SET_THRESHOLDS_SUBCOMMAND_DESCRIPTION')
                        })
                        .addIntegerOption(option =>
                            option.setName('message-count')
                                .setDescription('Number of similar messages to trigger detection.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_MESSAGE_COUNT_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_MESSAGE_COUNT_OPTION_DESCRIPTION')
                                })
                                .setRequired(true)
                                .setMinValue(2))
                        .addStringOption(option =>
                            option.setName('time-period')
                                .setDescription('Time period for messages (e.g., "15s", "1m", "5m").')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_TIME_PERIOD_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_TIME_PERIOD_OPTION_DESCRIPTION')
                                })
                                .setRequired(true))
                        .addIntegerOption(option =>
                            option.setName('user-count')
                                .setDescription('Number of unique users sending similar messages.')
                                .setDescriptionLocalizations({
                                    de: getTranslatedText('de', 'spam_command.RAID_USER_COUNT_OPTION_DESCRIPTION'),
                                    'en-US': getTranslatedText('en', 'spam_command.RAID_USER_COUNT_OPTION_DESCRIPTION')
                                })
                                .setRequired(true)
                                .setMinValue(2)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Displays current raid protection settings.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.RAID_STATUS_SUBCOMMAND_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.RAID_STATUS_SUBCOMMAND_DESCRIPTION')
                        })))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-character-spam-threshold')
                .setDescription('Sets the threshold for excessive repeating characters (0.0-1.0).')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.SET_CHARACTER_SPAM_THRESHOLD_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.SET_CHARACTER_SPAM_THRESHOLD_SUBCOMMAND_DESCRIPTION')
                })
                .addNumberOption(option =>
                    option.setName('threshold')
                        .setDescription('Ratio of repeating characters (e.g., 0.7 for 70%).')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.CHARACTER_SPAM_THRESHOLD_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.CHARACTER_SPAM_THRESHOLD_OPTION_DESCRIPTION')
                        })
                        .setRequired(true)
                        .setMinValue(0.0)
                        .setMaxValue(1.0)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-max-emotes')
                .setDescription('Sets the maximum number of emotes allowed per message (0 for unlimited).')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.SET_MAX_EMOTES_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.SET_MAX_EMOTES_SUBCOMMAND_DESCRIPTION')
                })
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Maximum number of emotes (e.g., 5). Set to 0 for unlimited.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.MAX_EMOTES_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.MAX_EMOTES_OPTION_DESCRIPTION')
                        })
                        .setRequired(true)
                        .setMinValue(0)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-max-stickers')
                .setDescription('Sets the maximum number of stickers allowed per message (0 for unlimited).')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'spam_command.SET_MAX_STICKERS_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'spam_command.SET_MAX_STICKERS_SUBCOMMAND_DESCRIPTION')
                })
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Maximum number of stickers (e.g., 1). Set to 0 for unlimited.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'spam_command.MAX_STICKERS_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'spam_command.MAX_STICKERS_OPTION_DESCRIPTION')
                        })
                        .setRequired(true)
                        .setMinValue(0))),

    category: 'Moderation',

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const lang = await getGuildLanguage(guildId);
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        let config = spamConfigs[guildId] || {
            enabled: false,
            blacklistedLinks: [],
            raidProtection: { enabled: false, messageCount: 5, timePeriod: '1m', userCount: 3 },
            characterSpamThreshold: 0.7,
            maxEmotes: 5,
            maxStickers: 1
        };

        switch (subcommandGroup) {
            case 'link':
                switch (subcommand) {
                    case 'add': {
                        const link = interaction.options.getString('link');
                        if (config.blacklistedLinks.includes(link)) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.link_already_added', { link }), ephemeral: true });
                        }
                        config.blacklistedLinks.push(link);
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.link_added_success', { link }), ephemeral: true });
                    }
                    case 'remove': {
                        const link = interaction.options.getString('link');
                        const index = config.blacklistedLinks.indexOf(link);
                        if (index === -1) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.link_not_found', { link }), ephemeral: true });
                        }
                        config.blacklistedLinks.splice(index, 1);
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.link_removed_success', { link }), ephemeral: true });
                    }
                    case 'list': {
                        if (config.blacklistedLinks.length === 0) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.no_links_added'), ephemeral: true });
                        }
                        const linksList = config.blacklistedLinks.map(l => `- ${l}`).join('\n');
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.link_list', { links: linksList }), ephemeral: true });
                    }
                }
                break;
            case 'raid':
                switch (subcommand) {
                    case 'enable': {
                        if (config.raidProtection.enabled) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ALREADY_ENABLED'), ephemeral: true });
                        }
                        config.raidProtection.enabled = true;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ENABLED_SUCCESS'), ephemeral: true });
                    }
                    case 'disable': {
                        if (!config.raidProtection.enabled) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_ALREADY_DISABLED'), ephemeral: true });
                        }
                        config.raidProtection.enabled = false;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_DISABLED_SUCCESS'), ephemeral: true });
                    }
                    case 'set-thresholds': {
                        const messageCount = interaction.options.getInteger('message-count');
                        const timePeriod = interaction.options.getString('time-period');
                        const userCount = interaction.options.getInteger('user-count');

                        // Einfache Validierung für timePeriod (z.B. "15s", "1m", "5m", "1h")
                        const timeRegex = /^(\d+)(s|m|h)$/;
                        const match = timePeriod.match(timeRegex);
                        if (!match) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_INVALID_TIME_PERIOD'), ephemeral: true });
                        }
                        const value = parseInt(match[1]);
                        const unit = match[2];
                        let totalSeconds = 0;
                        if (unit === 's') totalSeconds = value;
                        if (unit === 'm') totalSeconds = value * 60;
                        if (unit === 'h') totalSeconds = value * 3600;

                        if (totalSeconds > 3600) { // Max 1 hour
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_INVALID_TIME_PERIOD'), ephemeral: true });
                        }

                        config.raidProtection.messageCount = messageCount;
                        config.raidProtection.timePeriod = timePeriod;
                        config.raidProtection.userCount = userCount;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.RAID_THRESHOLDS_SET_SUCCESS', { messageCount, timePeriod, userCount }), ephemeral: true });
                    }
                    case 'status': {
                        const embed = new EmbedBuilder()
                            .setColor('Blue')
                            .setTitle(getTranslatedText(lang, 'spam_command.RAID_STATUS_TITLE'))
                            .setDescription(getTranslatedText(lang, 'spam_command.RAID_STATUS_DESCRIPTION', {
                                status: config.raidProtection.enabled ? getTranslatedText(lang, 'spam_command.STATUS_ENABLED_TEXT') : getTranslatedText(lang, 'spam_command.STATUS_DISABLED_TEXT')
                            }))
                            .addFields(
                                { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_MESSAGE_COUNT'), value: config.raidProtection.messageCount.toString(), inline: true },
                                { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_TIME_PERIOD'), value: config.raidProtection.timePeriod, inline: true },
                                { name: getTranslatedText(lang, 'spam_command.RAID_FIELD_USER_COUNT'), value: config.raidProtection.userCount.toString(), inline: true }
                            );
                        return interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                }
                break;
            case undefined: // Hauptbefehle
                switch (subcommand) {
                    case 'enable': {
                        if (config.enabled) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.already_enabled'), ephemeral: true });
                        }
                        config.enabled = true;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.enabled_success'), ephemeral: true });
                    }
                    case 'disable': {
                        if (!config.enabled) {
                            return interaction.reply({ content: getTranslatedText(lang, 'spam_command.already_disabled'), ephemeral: true });
                        }
                        config.enabled = false;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.disabled_success'), ephemeral: true });
                    }
                    case 'set-character-spam-threshold': {
                        const threshold = interaction.options.getNumber('threshold');
                        config.characterSpamThreshold = threshold;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.CHARACTER_SPAM_THRESHOLD_SET_SUCCESS', { threshold: (threshold * 100).toFixed(0) }), ephemeral: true });
                    }
                    case 'set-max-emotes': {
                        const count = interaction.options.getInteger('count');
                        config.maxEmotes = count;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.MAX_EMOTES_SET_SUCCESS', { count }), ephemeral: true });
                    }
                    case 'set-max-stickers': {
                        const count = interaction.options.getInteger('count');
                        config.maxStickers = count;
                        await saveSpamConfigs({ ...spamConfigs, [guildId]: config });
                        return interaction.reply({ content: getTranslatedText(lang, 'spam_command.MAX_STICKERS_SET_SUCCESS', { count }), ephemeral: true });
                    }
                }
                break;
            default:
                await interaction.reply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), ephemeral: true });
                break;
        }
    },
    getSpamConfig: (guildId) => {
        // Lade Konfigurationen, falls noch nicht geschehen (z.B. wenn Bot gerade gestartet wurde)
        if (Object.keys(spamConfigs).length === 0) {
            loadSpamConfigs(); // Starte den Ladevorgang, aber blockiere nicht
        }
        return spamConfigs[guildId] || {
            enabled: false,
            blacklistedLinks: [],
            raidProtection: { enabled: false, messageCount: 5, timePeriod: '1m', userCount: 3 },
            characterSpamThreshold: 0.7,
            maxEmotes: 5,
            maxStickers: 1
        };
    }
};
