// commands/admin/ticket-setup.js
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const log = require('../../utils/logUtils');

const configPath = path.join(__dirname, '../../data/reactionSetupConfig.json');

// --- Helper: Konfig laden/speichern ---
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            log.error(`[TicketSetup] Fehler beim Parsen von ${configPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveConfig = (config) => {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        log.error(`[TicketSetup] Fehler beim Schreiben in ${configPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Setzt das Ticket-System für den Server auf.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Kategorie, in der Tickets erstellt werden.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('Support-Rolle für Tickets.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('ticket_log_channel')
                .setDescription('Kanal für Ticket-Logs (Transkripte).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('panel_embed_title')
                .setDescription('Optional: Titel für das Panel-Embed.'))
        .addStringOption(option =>
            option.setName('panel_embed_description')
                .setDescription('Optional: Beschreibung für das Panel-Embed.'))
        .addStringOption(option =>
            option.setName('ticket_embed_title')
                .setDescription('Optional: Titel für das Ticket-Embed.'))
        .addStringOption(option =>
            option.setName('ticket_embed_description')
                .setDescription('Optional: Beschreibung für das Ticket-Embed.')),

    async execute(interaction) {
        const lang = getGuildLanguage(interaction.guildId);

        const category = interaction.options.getChannel('category');
        const supportRole = interaction.options.getRole('support_role');
        const ticketLogChannel = interaction.options.getChannel('ticket_log_channel');
        const panelEmbedTitle = interaction.options.getString('panel_embed_title');
        const panelEmbedDescription = interaction.options.getString('panel_embed_description');
        const ticketEmbedTitle = interaction.options.getString('ticket_embed_title');
        const ticketEmbedDescription = interaction.options.getString('ticket_embed_description');

        if (category.type !== ChannelType.GuildCategory) {
            return interaction.reply({
                content: getTranslatedText(lang, 'ticket_setup_command.INVALID_CATEGORY'),
                ephemeral: true,
            });
        }

        if (!supportRole || !category || !ticketLogChannel) {
            return interaction.reply({
                content: getTranslatedText(lang, 'ticket_setup_command.TICKET_SETUP_MISSING_OPTIONS'),
                ephemeral: true,
            });
        }

        const config = loadConfig();
        if (!config[interaction.guild.id]) config[interaction.guild.id] = {};

        config[interaction.guild.id] = {
            ticketCategoryId: category.id,
            supportRoleId: supportRole.id,
            transcriptChannelId: ticketLogChannel.id,
            panelEmbedTitle: panelEmbedTitle || null,
            panelEmbedDescription: panelEmbedDescription || null,
            ticketEmbedTitle: ticketEmbedTitle || null,
            ticketEmbedDescription: ticketEmbedDescription || null,
        };

        saveConfig(config);

            console.log(`[TicketSetup] Ticket-System gesetzt für ${interaction.guild.name} (${interaction.guild.id})`);


        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(panelEmbedTitle || getTranslatedText(lang, 'ticket_setup_command.TICKET_PANEL_TITLE'))
            .setDescription(panelEmbedDescription || getTranslatedText(lang, 'ticket_setup_command.TICKET_PANEL_DESCRIPTION'))
            .addFields(
                { name: getTranslatedText(lang, 'ticket_setup_command.TICKET_CATEGORY_FIELD'), value: `<#${category.id}>`, inline: true },
                { name: getTranslatedText(lang, 'ticket_setup_command.TICKET_SUPPORT_ROLE_FIELD'), value: `<@&${supportRole.id}>`, inline: true },
                { name: getTranslatedText(lang, 'ticket_setup_command.TICKET_LOG_CHANNEL_FIELD'), value: `<#${ticketLogChannel.id}>`, inline: true }
            )
            .setTimestamp();

        const ticketButton = new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel(getTranslatedText(lang, 'buttons.BUTTON_OPEN_TICKET'))
            .setStyle(ButtonStyle.Success)
            .setEmoji('📧');

        const row = new ActionRowBuilder().addComponents(ticketButton);

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
