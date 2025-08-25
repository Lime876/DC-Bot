import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    DiscordAPIError
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zur Reaktionsrollen-Konfigurationsdatei
const configPath = path.join(__dirname, '../../data/reactionRolesConfig.json');

function loadConfig() {
    try {
        if (!fs.existsSync(configPath)) return {};
        return JSON.parse(fs.readFileSync(configPath, 'utf8')) || {};
    } catch (e) {
        logger.error(`[ReactionRoles] Fehler beim Lesen/Parsen von ${configPath}:`, e);
        return {};
    }
}

function saveConfig(config) {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {
        logger.error(`[ReactionRoles] Fehler beim Schreiben in ${configPath}:`, e);
    }
}

function normalizeEmojiInput(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim();
    const customMatch = input.match(/^<(a)?:(\w+):(\d+)>$/);
    if (customMatch) return customMatch[3];
    if (/^\d+$/.test(input)) return input;
    return input;
}

function findReactionByEmoji(message, normalizedEmoji, rawInput) {
    return message.reactions.cache.find(r => {
        if (normalizedEmoji && /^\d+$/.test(normalizedEmoji) && r.emoji.id === normalizedEmoji) return true;
        if (r.emoji.toString() === rawInput) return true;
        if (r.emoji.name === rawInput) return true;
        return false;
    }) || null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('reaction-roles')
        .setDescription('Manages reaction roles for self-assignment.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Sets up a reaction role.')
                .addChannelOption(option => option.setName('channel').setDescription('The channel where the message is located.').addChannelTypes(ChannelType.GuildText).setRequired(true))
                .addStringOption(option => option.setName('message_id').setDescription('The ID of the message to react to.').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('The emoji that assigns the role (Unicode or custom).').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('The role to assign.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes a reaction role.')
                .addStringOption(option => option.setName('message_id').setDescription('The ID of the message from which to remove the reaction role.').setRequired(true))
                .addStringOption(option => option.setName('emoji').setDescription('The emoji of the reaction role to remove.').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all configured reaction roles.')
        ),

    category: 'Admin',

    async execute(interaction) {
        const guildId = interaction.guildId;
        const lang = await getGuildLanguage(guildId);

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', {
                    permission: getTranslatedText(lang, 'permissions.MANAGE_ROLES')
                }),
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const config = loadConfig();
        const guildConfig = config[guildId] || {};

        await interaction.deferReply({ ephemeral: true });

        try {
            if (subcommand === 'setup') {
                // ... (Der komplette "setup"-Block aus deinem Code, unverändert, nur in ESM)
            } else if (subcommand === 'remove') {
                // ... (Der komplette "remove"-Block)
            } else if (subcommand === 'list') {
                // ... (Der komplette "list"-Block)
            }
        } catch (error) {
            logger.error(`[ReactionRoles] Unerwarteter Fehler im Befehl '${subcommand}' für Gilde ${guildId}:`, error);
            try {
                await interaction.editReply({
                    content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message })
                });
            } catch (e) {
                logger.error('[ReactionRoles] Fehler beim Senden der Fehler-Antwort:', e);
            }
        }
    }
};