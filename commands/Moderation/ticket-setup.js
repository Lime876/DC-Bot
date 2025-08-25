import { SlashCommandBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTicketConfigForGuild, setTicketConfig, removeTicketConfig } from '../../utils/ticketConfig.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

const TICKET_CONFIG_PATH = path.resolve('./data/ticketConfig.json');
let ticketConfigs = new Map();

async function loadTicketConfigs() {
    try {
        const data = await fs.readFile(TICKET_CONFIG_PATH, 'utf8');
        ticketConfigs = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[TicketSetup] Ticket-Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[TicketSetup] ticketConfig.json nicht gefunden, erstelle leere Konfiguration.');
            ticketConfigs = new Map();
            await saveTicketConfigs();
        } else {
            logger.error('[TicketSetup] Fehler beim Laden der Ticket-Konfiguration:', error);
            ticketConfigs = new Map();
        }
    }
}

async function saveTicketConfigs(configs = ticketConfigs) {
    try {
        await fs.writeFile(TICKET_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2));
        logger.debug('[TicketSetup] Ticket-Konfiguration gespeichert.');
    } catch (error) {
        logger.error('[TicketSetup] Fehler beim Speichern der Ticket-Konfiguration:', error);
    }
}

await loadTicketConfigs();

export const data = new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Richtet das Ticket-System ein.')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'ticket_setup_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'ticket_setup_command.DESCRIPTION'),
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
        option.setName('category')
            .setDescription('Die Kategorie, in der Ticket-Kanäle erstellt werden sollen.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'ticket_setup_command.CATEGORY_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'ticket_setup_command.CATEGORY_OPTION_DESCRIPTION'),
            })
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true))
    .addRoleOption(option =>
        option.setName('support_role')
            .setDescription('Die Rolle, die Support-Tickets verwalten darf.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'ticket_setup_command.SUPPORT_ROLE_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'ticket_setup_command.SUPPORT_ROLE_OPTION_DESCRIPTION'),
            })
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('log_channel')
            .setDescription('Der Kanal, in dem Ticket-Logs gesendet werden sollen.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'ticket_setup_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'ticket_setup_command.LOG_CHANNEL_OPTION_DESCRIPTION'),
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('message_channel')
            .setDescription('Der Kanal, in dem das Ticket-Panel gesendet werden soll.')
            .setDescriptionLocalizations({
                de: getTranslatedText('de', 'ticket_setup_command.MESSAGE_CHANNEL_OPTION_DESCRIPTION'),
                'en-US': getTranslatedText('en', 'ticket_setup_command.MESSAGE_CHANNEL_OPTION_DESCRIPTION'),
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const lang = getGuildLanguage(guildId);

    try {
        const category = interaction.options.getChannel('category');
        const supportRole = interaction.options.getRole('support_role');
        const logChannel = interaction.options.getChannel('log_channel');
        const messageChannel = interaction.options.getChannel('message_channel');

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(getTranslatedText(lang, 'ticket_setup_command.EMBED_TITLE'))
            .setDescription(getTranslatedText(lang, 'ticket_setup_command.EMBED_DESCRIPTION'))
            .setFooter({ text: getTranslatedText(lang, 'ticket_setup_command.EMBED_FOOTER') });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel(getTranslatedText(lang, 'ticket_setup_command.CREATE_TICKET_BUTTON_LABEL'))
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫'),
            );

        const sentMessage = await messageChannel.send({ embeds: [embed], components: [row] });

        ticketConfigs.set(guildId, {
            categoryId: category.id,
            supportRoleId: supportRole.id,
            logChannelId: logChannel.id,
            messageChannelId: messageChannel.id,
            panelMessageId: sentMessage.id
        });
        await saveTicketConfigs();

        await interaction.editReply({ content: getTranslatedText(lang, 'ticket_setup_command.SUCCESS_DESCRIPTION') });
        logger.info(`[TicketSetup Command] Ticket-System in Gilde ${interaction.guild.name} (${guildId}) eingerichtet. Panel-Nachricht ID: ${sentMessage.id}, Kanal ID: ${messageChannel.id}. (PID: ${process.pid})`);

    } catch (error) {
        logger.error(`[TicketSetup Command] Fehler beim Einrichten des Ticket-Systems in Gilde ${guildId}:`, error);
        if (error.code === 50013) {
            await interaction.editReply({ content: getTranslatedText(lang, 'ticket_setup_command.ERROR_PERMISSION_DENIED') });
        } else {
            await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED') });
        }
    }
}

export { ticketConfigs, saveTicketConfigs };