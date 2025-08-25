// Befehl zum Bearbeiten des Ticket-Panels
import {
    SlashCommandBuilder,
    PermissionFlagsBits
} from 'discord.js';

// Korrigierter Import: Der Name der Funktion wurde von `setTicketConfigForGuild`
// zu `setTicketConfig` geändert, um dem Export in der `ticketConfig.js`-Datei zu entsprechen.
import {
    setTicketConfig,
    getTicketConfigForGuild
} from '../../utils/ticketConfig.js';

import logger from '../../utils/logger.js';

export default {
    // Die Definition des Slash-Befehls
    data: new SlashCommandBuilder()
        .setName('edit-ticket-panel')
        .setDescription('Bearbeitet ein bestehendes Ticket-Panel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('message-id')
            .setDescription('Die ID der Nachricht mit dem Ticket-Panel.')
            .setRequired(true))
        .addChannelOption(option =>
            option.setName('category')
            .setDescription('Der Kategorie-Kanal für neue Tickets.')
            .setRequired(false))
        .addRoleOption(option =>
            option.setName('support-role')
            .setDescription('Die Rolle, die Support-Tickets verwalten darf.')
            .setRequired(false))
        .addChannelOption(option =>
            option.setName('log-channel')
            .setDescription('Der Kanal, in dem Ticket-Logs gesendet werden.')
            .setRequired(false)),

    // Die Ausführungslogik für den Befehl
    async execute(interaction) {
        const {
            guildId
        } = interaction;
        const messageId = interaction.options.getString('message-id');
        const categoryChannel = interaction.options.getChannel('category');
        const supportRole = interaction.options.getRole('support-role');
        const logChannel = interaction.options.getChannel('log-channel');

        // Lade die aktuelle Konfiguration der Gilde
        const currentConfig = getTicketConfigForGuild(guildId);

        if (!currentConfig) {
            await interaction.reply({
                content: 'Es wurde keine Ticket-Konfiguration für diese Gilde gefunden.',
                ephemeral: true
            });
            return;
        }

        // Aktualisiere die Konfiguration nur mit den übergebenen Werten
        const newConfig = {
            ...currentConfig,
            categoryId: categoryChannel ? categoryChannel.id : currentConfig.categoryId,
            supportRoleId: supportRole ? supportRole.id : currentConfig.supportRoleId,
            logChannelId: logChannel ? logChannel.id : currentConfig.logChannelId,
            ticketMessageId: messageId
        };

        // Speichere die aktualisierte Konfiguration.
        // Wir verwenden die in ticketConfig.js definierte Funktion 'setTicketConfig'.
        setTicketConfig(
            guildId,
            newConfig.categoryId,
            newConfig.supportRoleId,
            newConfig.logChannelId,
            newConfig.messageChannelId,
            newConfig.ticketMessageId
        );

        logger.info(`[EDIT TICKET PANEL] Gilde ${guildId} hat das Ticket-Panel bearbeitet.`);

        await interaction.reply({
            content: 'Das Ticket-Panel wurde erfolgreich aktualisiert!',
            ephemeral: true
        });
    },
};
