import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTranslatedText, getGuildLanguage } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const SPAM_CONFIG_PATH = path.resolve('./data/spamConfig.json');
let spamConfigs = new Map();

async function loadSpamConfigs() {
    try {
        const data = await fs.readFile(SPAM_CONFIG_PATH, 'utf8');
        spamConfigs = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[SpamConfig] Spam-Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[SpamConfig] spamConfig.json nicht gefunden, erstelle neue Datei.');
            spamConfigs = new Map();
            await saveSpamConfigs();
        } else {
            logger.error('[SpamConfig] Fehler beim Laden der Spam-Konfiguration:', error);
            spamConfigs = new Map();
        }
    }
}

async function saveSpamConfigs(configs = spamConfigs) {
    try {
        await fs.writeFile(SPAM_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2));
        logger.debug('[SpamConfig] Spam-Konfiguration gespeichert.');
    } catch (error) {
        logger.error('[SpamConfig] Fehler beim Speichern der Spam-Konfiguration:', error);
    }
}

// Lade die Konfigurationen beim Start des Bots
await loadSpamConfigs();

// Vervollständige die SlashCommandBuilder-Kette mit den fehlenden Optionen
const data = new SlashCommandBuilder()
    .setName('spamconfig')
    .setDescription('Konfiguriert die Anti-Spam-Einstellungen für den Server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => subcommand.setName('enable').setDescription('Aktiviert den Anti-Spam-Schutz.'))
    .addSubcommand(subcommand => subcommand.setName('disable').setDescription('Deaktiviert den Anti-Spam-Schutz.'))
    .addSubcommandGroup(group =>
        group
        .setName('blacklist-link')
        .setDescription('Verwaltet die Blacklist für Links.')
        .addSubcommand(sub =>
            sub.setName('add')
            .setDescription('Fügt einen Link hinzu.')
            .addStringOption(opt => opt.setName('link').setDescription('Der Link, der blockiert werden soll.').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
            .setDescription('Entfernt einen Link.')
            .addStringOption(opt => opt.setName('link').setDescription('Der Link, der entfernt werden soll.').setRequired(true))
        )
    )
    .addSubcommand(sub =>
        sub.setName('raid-protection')
        .setDescription('Konfiguriert den Raid-Schutz.')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Aktiviert oder deaktiviert den Schutz.').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('set-char-threshold')
        .setDescription('Setzt den Schwellenwert für Zeichen-Spam.')
        .addNumberOption(opt => opt.setName('threshold').setDescription('Der Schwellenwert (0.0 bis 1.0).').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('set-max-emotes')
        .setDescription('Setzt die maximale Anzahl von Emotes.')
        .addIntegerOption(opt => opt.setName('count').setDescription('Die maximale Anzahl von Emotes.').setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName('set-max-stickers')
        .setDescription('Setzt die maximale Anzahl von Stickern.')
        .addIntegerOption(opt => opt.setName('count').setDescription('Die maximale Anzahl von Stickern.').setRequired(true))
    );

async function execute(interaction) {
    await interaction.deferReply({
        ephemeral: true
    });
    const guildId = interaction.guild.id;
    const lang = await getGuildLanguage(guildId);

    let config = spamConfigs.get(guildId) || {
        enabled: false,
        blacklistedLinks: [],
        raidProtection: {
            enabled: false
        },
        characterSpamThreshold: 0.7,
        maxEmotes: 5,
        maxStickers: 1,
    };

    try {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        if (subcommandGroup === 'blacklist-link') {
            const link = interaction.options.getString('link');
            if (subcommand === 'add') {
                if (config.blacklistedLinks.includes(link)) {
                    return interaction.editReply({
                        content: getTranslatedText(lang, 'spam_command.LINK_ALREADY_ADDED'),
                        ephemeral: true
                    });
                }
                config.blacklistedLinks.push(link);
            } else if (subcommand === 'remove') {
                if (!config.blacklistedLinks.includes(link)) {
                    return interaction.editReply({
                        content: getTranslatedText(lang, 'spam_command.LINK_NOT_FOUND'),
                        ephemeral: true
                    });
                }
                config.blacklistedLinks = config.blacklistedLinks.filter(l => l !== link);
            }
            spamConfigs.set(guildId, config);
            await saveSpamConfigs();
            return interaction.editReply({
                content: getTranslatedText(lang, `spam_command.LINK_${subcommand.toUpperCase()}_SUCCESS`),
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'enable':
            case 'disable':
                config.enabled = subcommand === 'enable';
                spamConfigs.set(guildId, config);
                await saveSpamConfigs();
                return interaction.editReply({
                    content: getTranslatedText(lang, subcommand === 'enable' ? 'spam_command.ENABLED_SUCCESS' : 'spam_command.DISABLED_SUCCESS'),
                    ephemeral: true
                });

            case 'raid-protection':
                // Logik für Raid Protection
                config.raidProtection.enabled = interaction.options.getBoolean('enabled');
                spamConfigs.set(guildId, config);
                await saveSpamConfigs();
                return interaction.editReply({
                    content: getTranslatedText(lang, config.raidProtection.enabled ? 'spam_command.RAID_PROTECTION_ENABLED' : 'spam_command.RAID_PROTECTION_DISABLED'),
                    ephemeral: true
                });

            case 'set-char-threshold':
                // Logik für Zeichen-Spam
                const threshold = interaction.options.getNumber('threshold');
                if (threshold < 0 || threshold > 1) {
                    return interaction.editReply({
                        content: getTranslatedText(lang, 'spam_command.INVALID_THRESHOLD'),
                        ephemeral: true
                    });
                }
                config.characterSpamThreshold = threshold;
                spamConfigs.set(guildId, config);
                await saveSpamConfigs();
                return interaction.editReply({
                    content: getTranslatedText(lang, 'spam_command.CHAR_THRESHOLD_SET_SUCCESS'),
                    ephemeral: true
                });

            case 'set-max-emotes':
                // Logik für Emote-Spam
                config.maxEmotes = interaction.options.getInteger('count');
                spamConfigs.set(guildId, config);
                await saveSpamConfigs();
                return interaction.editReply({
                    content: getTranslatedText(lang, 'spam_command.MAX_EMOTES_SET_SUCCESS'),
                    ephemeral: true
                });

            case 'set-max-stickers':
                // Logik für Sticker-Spam
                config.maxStickers = interaction.options.getInteger('count');
                spamConfigs.set(guildId, config);
                await saveSpamConfigs();
                return interaction.editReply({
                    content: getTranslatedText(lang, 'spam_command.MAX_STICKERS_SET_SUCCESS'),
                    ephemeral: true
                });

            default:
                return interaction.editReply({
                    content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                    ephemeral: true
                });
        }
    } catch (error) {
        logger.error(`[SpamConfig] Fehler bei Ausführung in Gilde ${guildId}:`, error);
        return interaction.editReply({
            content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
            ephemeral: true
        });
    }
}

function getSpamConfig(guildId) {
    return spamConfigs.get(guildId) || {
        enabled: false,
        blacklistedLinks: [],
        raidProtection: {
            enabled: false,
            messageCount: 5,
            timePeriod: '1m',
            userCount: 3
        },
        characterSpamThreshold: 0.7,
        maxEmotes: 5,
        maxStickers: 1,
    };
}

export { data, execute, getSpamConfig };
