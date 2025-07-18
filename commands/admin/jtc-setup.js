const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const { getJTCConfigForGuild, setJTCConfigForGuild, deleteJTCConfigForGuild } = require('../../utils/jtcConfig'); // Importiere die neuen JTC-Config-Funktionen

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jtc-setup')
        .setDescription('Sets up the Join to Create (JTC) voice channel system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) // Nur für Benutzer mit dieser Berechtigung
        .setDMPermission(false) // Kann nicht in DMs verwendet werden
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Sets or updates the JTC voice channel.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The voice channel users join to create a new channel.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice) // Nur Sprachkanäle erlauben
                )
                .addChannelOption(option =>
                    option
                        .setName('category')
                        .setDescription('The category where temporary voice channels will be created (optional).')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildCategory) // Nur Kategorien erlauben
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disables the JTC system for this server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Shows the current JTC setup for this server.')
        ),
    async execute(interaction) {
        const guild = interaction.guild;
        const lang = await getGuildLanguage(guild.id); // make sure to await if getGuildLanguage is async

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const jtcChannel = interaction.options.getChannel('channel');
            const jtcCategory = interaction.options.getChannel('category');

            // Prüfe Bot-Berechtigungen
            const botMember = guild.members.cache.get(interaction.client.user.id);
            const requiredPermissions = [
                PermissionFlagsBits.ManageChannels, // Zum Erstellen und Löschen von Kanälen
                PermissionFlagsBits.MoveMembers,    // Zum Verschieben von Benutzern in neue Kanäle
                PermissionFlagsBits.ViewChannel,    // Damit der Bot die Kanäle sehen kann
                PermissionFlagsBits.Connect         // Damit der Bot in Kanäle "eintreten" kann (manchmal impliziert für Channel-Management)
            ];

            const missingPermissions = requiredPermissions.filter(permission =>
                !botMember.permissions.has(permission)
            );

            if (missingPermissions.length > 0) {
                const permissionNames = missingPermissions.map(p => `\`${p}\``).join(', ');
                return interaction.reply({
                    content: getTranslatedText(lang, 'jtc_command.bot_permission_error', { permissions: permissionNames }),
                    ephemeral: true,
                });
            }

            // Prüfe, ob der JTC-Kanal selbst ein Sprachkanal ist
            if (jtcChannel.type !== ChannelType.GuildVoice) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'jtc_command.invalid_channel_type'),
                    ephemeral: true,
                });
            }

            // Prüfe, ob die Kategorie eine Kategorie ist
            if (jtcCategory && jtcCategory.type !== ChannelType.GuildCategory) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'jtc_command.invalid_category_type'),
                    ephemeral: true,
                });
            }

            setJTCConfigForGuild(guild.id, jtcChannel.id, jtcCategory ? jtcCategory.id : null);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00) // Grün für Erfolg
                .setTitle(getTranslatedText(lang, 'jtc_command.setup_success_title'))
                .setDescription(getTranslatedText(lang, 'jtc_command.setup_success_description', {
                    channel: `<#${jtcChannel.id}>`,
                    category: jtcCategory ? `<#${jtcCategory.id}>` : getTranslatedText(lang, 'jtc_command.no_category_specified')
                }))
                .setFooter({ text: getTranslatedText(lang, 'jtc_command.setup_success_footer') });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } else if (subcommand === 'disable') {
            const wasDeleted = deleteJTCConfigForGuild(guild.id);

            const embed = new EmbedBuilder();
            if (wasDeleted) {
                embed.setColor(0xFF0000) // Rot für Deaktivierung
                     .setTitle(getTranslatedText(lang, 'jtc_command.disable_success_title')) // Neue Übersetzung
                     .setDescription(getTranslatedText(lang, 'jtc_command.disable_success_description')); // Neue Übersetzung
            } else {
                embed.setColor(0xFFA500) // Orange für nicht aktiv
                     .setTitle(getTranslatedText(lang, 'jtc_command.disable_not_setup_title')) // Neue Übersetzung
                     .setDescription(getTranslatedText(lang, 'jtc_command.disable_not_setup_description')); // Neue Übersetzung
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });

        } else if (subcommand === 'status') {
            const currentConfig = getJTCConfigForGuild(guild.id);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // Blau für Status
                .setTitle(getTranslatedText(lang, 'jtc_command.status_title')); // Neue Übersetzung

            if (currentConfig) {
                const jtcChannel = guild.channels.cache.get(currentConfig.channelId);
                const jtcCategory = currentConfig.categoryId ? guild.channels.cache.get(currentConfig.categoryId) : null;

                embed.setDescription(getTranslatedText(lang, 'jtc_command.status_active_description', { // Neue Übersetzung
                    channel: jtcChannel ? `<#${jtcChannel.id}>` : getTranslatedText(lang, 'jtc_command.channel_not_found'), // Neue Übersetzung
                    category: jtcCategory ? `<#${jtcCategory.id}>` : getTranslatedText(lang, 'jtc_command.no_category_specified')
                }));
            } else {
                embed.setDescription(getTranslatedText(lang, 'jtc_command.status_inactive_description')); // Neue Übersetzung
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};