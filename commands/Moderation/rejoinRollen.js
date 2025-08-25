// commands/rejoin-rollen.js
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

// __dirname in ESM konstruieren
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsPath = path.join(__dirname, '../data/rejoinSettings.json');

// Hilfsfunktionen zum Laden/Speichern der Einstellungen
const loadSettings = () => {
    if (fs.existsSync(settingsPath)) {
        try {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            logger.error(`[RejoinRollen] Fehler beim Parsen von ${settingsPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveSettings = (settings) => {
    try {
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (e) {
        logger.error(`[RejoinRollen] Fehler beim Schreiben in ${settingsPath}:`, e);
    }
};

export default {
    data: new SlashCommandBuilder()
        .setName('rejoin-rollen')
        .setDescription('Aktiviere oder deaktiviere das automatische Wiedergeben alter Rollen beim Join')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'rejoin_roles_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'rejoin_roles_command.DESCRIPTION'),
        })
        .addStringOption(option =>
            option
                .setName('aktion')
                .setDescription('Aktivieren oder deaktivieren')
                .setDescriptionLocalizations({
                    de: getTranslatedText('de', 'rejoin_roles_command.ACTION_OPTION_DESCRIPTION'),
                    'en-US': getTranslatedText('en', 'rejoin_roles_command.ACTION_OPTION_DESCRIPTION'),
                })
                .setRequired(true)
                .addChoices(
                    { name: getTranslatedText('de', 'general.ACTIVATE'), value: 'on' },
                    { name: getTranslatedText('de', 'general.DEACTIVATE'), value: 'off' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    category: 'Moderation',

    async execute(interaction) {
        const lang = await getGuildLanguage(interaction.guildId);

        // Defer reply immediately
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const aktion = interaction.options.getString('aktion');
        const guildId = interaction.guild.id;
        let settings = loadSettings();

        // Berechtigungsprüfung für den Benutzer
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', {
                    permission: getTranslatedText(lang, 'permissions.ADMINISTRATOR')
                }),
            });
        }

        if (aktion === 'on') {
            settings[guildId] = interaction.channel.id;
            saveSettings(settings);
            await interaction.editReply({
                content: getTranslatedText(lang, 'rejoin_roles_command.ACTIVATED_SUCCESS', {
                    channelMention: interaction.channel.toString()
                })
            });
        } else {
            delete settings[guildId];
            saveSettings(settings);
            await interaction.editReply({
                content: getTranslatedText(lang, 'rejoin_roles_command.DEACTIVATED_SUCCESS')
            });
        }
    }
};