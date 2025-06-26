// commands\admin\ticket-setup.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const log = require('../../utils/logUtils'); // Make sure logUtils is correctly set up as discussed earlier

// Path to the configuration file
const configPath = path.join(__dirname, '../../data/reactionSetupConfig.json');

// --- Helper functions for loading and saving configuration ---
// These functions should ideally be in a shared utility if used by multiple commands,
// but defining them here is fine for this specific command's needs.
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            log.error(`[TicketSetup] Error parsing config file ${configPath}:`, e);
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
        log.error(`[TicketSetup] Error writing to config file ${configPath}:`, e);
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Setzt das Ticket-System für den Server auf.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Die Kategorie, in der Tickets erstellt werden sollen.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('support_role')
                .setDescription('Die Rolle, die Support-Mitarbeiter haben sollen.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('ticket_log_channel') // Option for the log channel
                .setDescription('Der Kanal, in dem Ticket-Logs (Transkripte) gesendet werden sollen.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('welcome_title')
                .setDescription('Optional: Benutzerdefinierter Titel für die Willkommensnachricht des Tickets.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('welcome_description')
                .setDescription('Optional: Benutzerdefinierte Beschreibung für die Willkommensnachricht des Tickets.')
                .setRequired(false)),
    async execute(interaction) {
        const lang = getGuildLanguage(interaction.guildId);

        const category = interaction.options.getChannel('category');
        const supportRole = interaction.options.getRole('support_role');
        const ticketLogChannel = interaction.options.getChannel('ticket_log_channel'); // Renamed to avoid confusion with log function
        const welcomeTitle = interaction.options.getString('welcome_title');
        const welcomeDescription = interaction.options.getString('welcome_description');

        // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
        if (category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: getTranslatedText(lang, 'jtc_command.invalid_category_type'), ephemeral: true }); // Ich habe hier 'jtc_command.invalid_category_type' angenommen, da du keinen spezifischen Schlüssel für diesen Fall in ticket_setup_command hattest. Wenn du einen besseren hast, ersetze ihn.
        }

        // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
        if (!supportRole || !category || !ticketLogChannel) {
            return interaction.reply({ content: getTranslatedText(lang, 'ticket_setup_command.TICKET_SETUP_MISSING_OPTIONS'), ephemeral: true });
        }

        let currentConfig = loadConfig();
        if (!currentConfig[interaction.guild.id]) {
            currentConfig[interaction.guild.id] = {};
        }

        currentConfig[interaction.guild.id].ticketCategoryId = category.id;
        currentConfig[interaction.guild.id].supportRoleId = supportRole.id;
        currentConfig[interaction.guild.id].transcriptChannelId = ticketLogChannel.id; // Store the log channel ID in config

        if (welcomeTitle) currentConfig[interaction.guild.id].ticketWelcomeTitle = welcomeTitle;
        if (welcomeDescription) currentConfig[interaction.guild.id].ticketWelcomeDescription = welcomeDescription;

        saveConfig(currentConfig); // Save the updated configuration

        // ... Rest of your code for sending the confirmation message and button ...

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
            .setTitle(getTranslatedText(lang, 'ticket_setup_command.TICKET_SETUP_EMBED_TITLE'))
            // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
            .setDescription(getTranslatedText(lang, 'ticket_setup_command.TICKET_SETUP_EMBED_DESCRIPTION', { category: category.name, supportRole: supportRole.name, logChannel: ticketLogChannel.name })) // Use ticketLogChannel.name here
            .addFields(
                // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
                { name: getTranslatedText(lang, 'ticket_system.TICKET_CATEGORY_FIELD'), value: `<#${category.id}>`, inline: true }, // Annahme: Du willst 'ticket_system' hier nutzen. Wenn nicht, ändere es zu 'ticket_setup_command.TICKET_CATEGORY_FIELD'
                // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
                { name: getTranslatedText(lang, 'ticket_system.TICKET_SUPPORT_ROLE_FIELD'), value: `<@&${supportRole.id}>`, inline: true }, // Annahme: Du willst 'ticket_system' hier nutzen. Wenn nicht, ändere es zu 'ticket_setup_command.TICKET_SUPPORT_ROLE_FIELD'
                // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
                { name: getTranslatedText(lang, 'ticket_system.TICKET_LOG_CHANNEL_FIELD'), value: `<#${ticketLogChannel.id}>`, inline: true } // Annahme: Du willst 'ticket_system' hier nutzen. Wenn nicht, ändere es zu 'ticket_setup_command.TICKET_LOG_CHANNEL_FIELD'
            )
            .setTimestamp();

        const ticketButton = new ButtonBuilder()
            .setCustomId('open_ticket')
            // Korrigiert: Nutzt den vollen Pfad zum Übersetzungsschlüssel
            .setLabel(getTranslatedText(lang, 'buttons.BUTTON_OPEN_TICKET'))
            .setStyle(ButtonStyle.Success)
            .setEmoji('📧');

        const row = new ActionRowBuilder().addComponents(ticketButton);

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};