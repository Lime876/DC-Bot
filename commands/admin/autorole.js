// commands/admin/autorole.js
const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');

const configPath = path.join(__dirname, '../../data/autoroleConfig.json');

/**
 * Lädt die Autorollen-Konfiguration aus der Datei.
 * @returns {object} Die Konfiguration oder ein leeres Objekt.
 */
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[Autorole] Fehler beim Parsen von ${configPath}:`, e);
            return {};
        }
    }
    return {};
};

/**
 * Speichert die Autorollen-Konfiguration in der Datei.
 * @param {object} config - Die zu speichernde Konfiguration.
 */
const saveConfig = (config) => {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(`[Autorole] Fehler beim Schreiben in ${configPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manages the automatic role assignment for new members.') // Fallback-Beschreibung
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'autorole_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'autorole_command.DESCRIPTION'),
        })
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles) // Berechtigung: Rollen verwalten
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Sets a role to be automatically assigned to new members.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autorole_command.SET_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autorole_command.SET_SUBCOMMAND_DESCRIPTION'),
                })
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign to new members.') // Fallback-Beschreibung
                        .setDescriptionLocalizations({
                            de: getTranslatedText('de', 'autorole_command.ROLE_OPTION_DESCRIPTION'),
                            'en-US': getTranslatedText('en', 'autorole_command.ROLE_OPTION_DESCRIPTION'),
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes the configured autorole.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autorole_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autorole_command.REMOVE_SUBCOMMAND_DESCRIPTION'),
                })
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Displays the currently configured autorole.') // Fallback-Beschreibung
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'autorole_command.SHOW_SUBCOMMAND_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'autorole_command.SHOW_SUBCOMMAND_DESCRIPTION'),
                }),
        ),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const lang = getGuildLanguage(guildId);

        // Prüfen der Berechtigungen des Benutzers
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.reply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: 'Manage Roles' }),
                flags: [MessageFlags.Ephemeral]
            });
        }

        const subcommand = interaction.options.getSubcommand();
        let config = loadConfig();
        const guildConfig = config[guildId] || {};

        if (subcommand === 'set') {
            const role = interaction.options.getRole('role');

            if (!role) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'role_management.ROLE_NOT_FOUND'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Prüfen der Bot-Rollenhierarchie
            if (interaction.guild.members.me.roles.highest.position <= role.position) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.SET_FAIL_HIERARCHY', { botRoleName: interaction.guild.members.me.roles.highest.name, roleName: role.name }),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Sicherstellen, dass keine Bots als Autorolle gesetzt werden können (wenn gewünscht)
            if (role.managed) { // Managed roles are typically bot roles or integration roles
                return interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.SET_FAIL_BOT_ROLE'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            guildConfig.autoroleId = role.id;
            config[guildId] = guildConfig;
            saveConfig(config);

            await interaction.reply({
                content: getTranslatedText(lang, 'autorole_command.SET_SUCCESS', { roleName: role.name }),
                flags: [MessageFlags.Ephemeral]
            });

        } else if (subcommand === 'remove') {
            if (!guildConfig.autoroleId) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.REMOVE_FAIL_NO_ROLE'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            delete guildConfig.autoroleId;
            config[guildId] = guildConfig; // Aktualisiere die Konfiguration
            saveConfig(config);

            await interaction.reply({
                content: getTranslatedText(lang, 'autorole_command.REMOVE_SUCCESS'),
                flags: [MessageFlags.Ephemeral]
            });

        } else if (subcommand === 'show') {
            if (!guildConfig.autoroleId) {
                return interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.SHOW_NO_ROLE'),
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const role = interaction.guild.roles.cache.get(guildConfig.autoroleId);

            if (role) {
                await interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.SHOW_CURRENT_ROLE', { roleName: role.name }),
                    flags: [MessageFlags.Ephemeral]
                });
            } else {
                // Rolle nicht gefunden, aber ID existiert in Konfig. Aufräumen.
                delete guildConfig.autoroleId;
                config[guildId] = guildConfig;
                saveConfig(config);
                await interaction.reply({
                    content: getTranslatedText(lang, 'autorole_command.SHOW_NO_ROLE') + ' ' + getTranslatedText(lang, 'autorole_command.REMOVE_SUCCESS'), // Kombinierte Nachricht
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }
    },
};
