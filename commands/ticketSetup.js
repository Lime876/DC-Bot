// commands/ticket-setup.js
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/ticketConfig.json'); // Pfad zur Konfigurationsdatei

// Funktion zum Laden/Speichern der Konfiguration
const loadConfig = () => {
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
};

const saveConfig = (config) => {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Richtet das Ticket-System für diesen Server ein.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Der Kanal, in dem die Ticket-Erstellungsnachricht gesendet werden soll.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Die Kategorie, in der neue Ticket-Kanäle erstellt werden sollen.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('staff-role')
                .setDescription('Die Rolle, die Zugriff auf die Ticket-Kanäle haben soll (z.B. Moderatoren).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Der Titel der Ticket-Erstellungsnachricht.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Die Beschreibung der Ticket-Erstellungsnachricht.')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Nur Admins dürfen dies einrichten
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const setupChannel = interaction.options.getChannel('channel');
        const ticketCategory = interaction.options.getChannel('category');
        const staffRole = interaction.options.getRole('staff-role'); // Dies ist bereits das Role-Objekt!
        const title = interaction.options.getString('title') || 'Support-Ticket erstellen';
        const description = interaction.options.getString('description') || 'Klicke auf den Button, um ein Support-Ticket zu erstellen und mit dem Team in Kontakt zu treten.';

        if (!setupChannel.isTextBased() || setupChannel.type !== ChannelType.GuildText) {
            return interaction.editReply({ content: '❌ Der angegebene Kanal muss ein Textkanal sein.', ephemeral: true });
        }
        if (ticketCategory.type !== ChannelType.GuildCategory) {
            return interaction.editReply({ content: '❌ Die angegebene Kategorie ist keine gültige Kategorie.', ephemeral: true });
        }
        if (!staffRole) {
            return interaction.editReply({ content: '❌ Die angegebene Rolle ist ungültig.', ephemeral: true });
        }

        // Berechtigungen prüfen
        const botPermissionsInSetupChannel = setupChannel.permissionsFor(interaction.client.user);
        if (!botPermissionsInSetupChannel.has(PermissionFlagsBits.SendMessages) || !botPermissionsInSetupChannel.has(PermissionFlagsBits.ViewChannel)) {
            return interaction.editReply({ content: `❌ Ich habe keine Berechtigung, Nachrichten in ${setupChannel} zu senden oder ihn zu sehen.`, ephemeral: true });
        }
        const botPermissionsInCategory = ticketCategory.permissionsFor(interaction.client.user);
        if (!botPermissionsInCategory.has(PermissionFlagsBits.ManageChannels) || !botPermissionsInCategory.has(PermissionFlagsBits.ViewChannel)) {
            return interaction.editReply({ content: `❌ Ich habe keine Berechtigung, Kanäle in der Kategorie ${ticketCategory} zu erstellen oder zu sehen.`, ephemeral: true });
        }

        try {
            const ticketEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'Klicke auf den Button, um ein Ticket zu öffnen.' });

            const ticketButton = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Ticket erstellen')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(ticketButton);

            const sentMessage = await setupChannel.send({
                embeds: [ticketEmbed],
                components: [row],
            });

            // Konfiguration speichern
            let config = loadConfig();
            config[interaction.guild.id] = {
                ticketMessageId: sentMessage.id,
                setupChannelId: setupChannel.id,
                ticketCategoryId: ticketCategory.id,
                staffRoleId: staffRole.id, // Nur die ID speichern
            };
            saveConfig(config);

            await interaction.editReply({ content: `✅ Ticket-System erfolgreich in ${setupChannel} eingerichtet!`, ephemeral: true });

        } catch (error) {
            console.error('Fehler beim Einrichten des Ticket-Systems:', error);
            await interaction.editReply({
                content: '❌ Es gab einen Fehler beim Einrichten des Ticket-Systems. Bitte überprüfe meine Berechtigungen.',
                ephemeral: true,
            });
        }
    },
};