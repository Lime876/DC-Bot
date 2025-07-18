// commands/admin/autotimeout.js
const { SlashCommandBuilder, PermissionsBitField, MessageFlags, EmbedBuilder } = require('discord.js');
const { getGuildAutotimeoutConfig, setGuildAutotimeoutConfig } = require('../../utils/autotimeoutConfig');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const ms = require('ms'); // Für die Dauer-Parsierung und -Formatierung

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autotimeout')
        .setDescription('Verwaltet die Einstellungen für automatische Timeouts bei Spam-Verstößen.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'autotimeout_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'autotimeout_command.DESCRIPTION'),
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Aktiviert automatische Timeouts.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.ENABLE_SUBCOMMAND_DESCRIPTION'),
                })
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Deaktiviert automatische Timeouts.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.DISABLE_SUBCOMMAND_DESCRIPTION'),
                })
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_duration')
                .setDescription('Legt die Dauer für automatische Timeouts fest (z.B. \"10m\", \"1h\").')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.SET_DURATION_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.SET_DURATION_SUBCOMMAND_DESCRIPTION'),
                })
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Die Dauer (z.B. \"10m\", \"1h\", \"1d\"). Max. 28 Tage.')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'autotimeout_command.DURATION_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'autotimeout_command.DURATION_OPTION_DESCRIPTION'),
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_violations')
                .setDescription('Legt die Anzahl der Spam-Verstöße fest, bevor ein automatischer Timeout erfolgt.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.SET_VIOLATIONS_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.SET_VIOLATIONS_SUBCOMMAND_DESCRIPTION'),
                })
                .addIntegerOption(option =>
                    option.setName('count')
                        .setDescription('Anzahl der Verstöße (z.B. 3).')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'autotimeout_command.VIOLATIONS_COUNT_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'autotimeout_command.VIOLATIONS_COUNT_OPTION_DESCRIPTION'),
                        })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set_log_channel')
                .setDescription('Legt den Log-Kanal für automatische Timeout-Aktionen fest.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.SET_LOG_CHANNEL_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.SET_LOG_CHANNEL_SUBCOMMAND_DESCRIPTION'),
                })
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Der Textkanal, in den Logs gesendet werden sollen (optional, leer lassen zum Entfernen).')
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'autotimeout_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'autotimeout_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
                        })
                        .addChannelTypes(0) // Nur Textkanäle
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Zeigt die aktuellen Einstellungen für automatische Timeouts an.')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autotimeout_command.STATUS_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autotimeout_command.STATUS_SUBCOMMAND_DESCRIPTION'),
                })
        ),

    category: 'Moderation',

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);
        let config = getGuildAutotimeoutConfig(guildId);
        const subcommand = interaction.options.getSubcommand();

        // Berechtigungsprüfung
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: getTranslatedText(lang, 'permissions.MANAGE_GUILD') }),
                flags: [MessageFlags.Ephemeral]
            });
        }

        switch (subcommand) {
            case 'enable':
                if (config.enabled) {
                    return interaction.reply({ content: getTranslatedText(lang, 'autotimeout_command.ALREADY_ENABLED'), flags: [MessageFlags.Ephemeral] });
                }
                setGuildAutotimeoutConfig(guildId, { enabled: true });
                await interaction.reply({ content: getTranslatedText(lang, 'autotimeout_command.ENABLED_SUCCESS'), flags: [MessageFlags.Ephemeral] });
                break;

            case 'disable':
                if (!config.enabled) {
                    return interaction.reply({ content: getTranslatedText(lang, 'autotimeout_command.ALREADY_DISABLED'), flags: [MessageFlags.Ephemeral] });
                }
                setGuildAutotimeoutConfig(guildId, { enabled: false });
                await interaction.reply({ content: getTranslatedText(lang, 'autotimeout_command.DISABLED_SUCCESS'), flags: [MessageFlags.Ephemeral] });
                break;

            case 'set_duration':
                const durationString = interaction.options.getString('duration');
                const durationMs = ms(durationString);

                // Discord Timeout-Maximum ist 28 Tage (2419200000 ms)
                const maxDurationMs = ms('28d');

                if (isNaN(durationMs) || durationMs <= 0 || durationMs > maxDurationMs) {
                    return interaction.reply({
                        content: getTranslatedText(lang, 'autotimeout_command.INVALID_DURATION', { maxDuration: ms(maxDurationMs, { long: true }) }),
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                setGuildAutotimeoutConfig(guildId, { durationMs: durationMs });
                await interaction.reply({
                    content: getTranslatedText(lang, 'autotimeout_command.DURATION_SET_SUCCESS', { duration: ms(durationMs, { long: true }) }),
                    flags: [MessageFlags.Ephemeral]
                });
                break;

            case 'set_violations':
                const violationsCount = interaction.options.getInteger('count');
                setGuildAutotimeoutConfig(guildId, { violationsThreshold: violationsCount });
                await interaction.reply({
                    content: getTranslatedText(lang, 'autotimeout_command.VIOLATIONS_SET_SUCCESS', { count: violationsCount }),
                    flags: [MessageFlags.Ephemeral]
                });
                break;

            case 'set_log_channel':
                const channel = interaction.options.getChannel('channel');
                const channelId = channel ? channel.id : null;
                setGuildAutotimeoutConfig(guildId, { moderationLogChannelId: channelId });
                if (channelId) {
                    await interaction.reply({
                        content: getTranslatedText(lang, 'autotimeout_command.LOG_CHANNEL_SET_SUCCESS', { channelMention: channel.toString() }),
                        flags: [MessageFlags.Ephemeral]
                    });
                } else {
                    await interaction.reply({
                        content: getTranslatedText(lang, 'autotimeout_command.LOG_CHANNEL_REMOVED_SUCCESS'),
                        flags: [MessageFlags.Ephemeral]
                    });
                }
                break;

            case 'status':
                config = getGuildAutotimeoutConfig(guildId); // Neuladen, um die neuesten Einstellungen zu erhalten
                const statusText = config.enabled ? getTranslatedText(lang, 'autotimeout_command.STATUS_ENABLED_TEXT') : getTranslatedText(lang, 'autotimeout_command.STATUS_DISABLED_TEXT');
                const durationText = ms(config.durationMs, { long: true });
                const logChannelMention = config.moderationLogChannelId ? `<#${config.moderationLogChannelId}>` : getTranslatedText(lang, 'general.NOT_CONFIGURED');

                const statusEmbed = new EmbedBuilder()
                    .setColor(config.enabled ? 'Green' : 'Red')
                    .setTitle(getTranslatedText(lang, 'autotimeout_command.STATUS_TITLE'))
                    .setDescription(getTranslatedText(lang, 'autotimeout_command.STATUS_DESCRIPTION', { status: statusText }))
                    .addFields(
                        { name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_DURATION'), value: durationText, inline: true },
                        { name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_VIOLATIONS'), value: `${config.violationsThreshold}`, inline: true },
                        { name: getTranslatedText(lang, 'autotimeout_command.STATUS_FIELD_LOG_CHANNEL'), value: logChannelMention, inline: true }
                    )
                    .setTimestamp();
                await interaction.reply({ embeds: [statusEmbed], flags: [MessageFlags.Ephemeral] });
                break;
        }
    },
};
