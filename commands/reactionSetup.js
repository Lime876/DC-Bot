const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/ticketConfig.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reaction-setup')
        .setDescription('Richtet das Ticket-System auf dem Server ein.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Der Kanal, in dem der Ticket-Erstellungs-Button angezeigt werden soll.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('support_rolle')
                .setDescription('Die Rolle, die Zugriff auf Tickets haben soll (z.B. Support-Team).')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('kategorie')
                .setDescription('Die Kategorie, in der neue Ticket-Kanäle erstellt werden sollen.')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)
        )
        // NEU: Optionen für die Nachricht im Ticket-Kanal
        .addStringOption(option =>
            option.setName('ticket_titel')
                .setDescription('Titel der Willkommensnachricht im erstellten Ticket-Kanal.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('ticket_beschreibung')
                .setDescription('Beschreibung der Willkommensnachricht im erstellten Ticket-Kanal.')
                .setRequired(false)
        )
        // NEU: Option für den Transkript-Kanal
        .addChannelOption(option =>
            option.setName('transkript_kanal')
                .setDescription('Kanal, in den Ticket-Transkripte gesendet werden sollen.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option => // Alte Option, nur zur Vollständigkeit
            option.setName('titel')
                .setDescription('Titel der Nachricht, die den Ticket-Button enthält.')
                .setRequired(false)
        )
        .addStringOption(option => // Alte Option, nur zur Vollständigkeit
            option.setName('beschreibung')
                .setDescription('Beschreibung der Nachricht, die den Ticket-Button enthält.')
                .setRequired(false)
        ),
    async execute(interaction) {
        const setupChannel = interaction.options.getChannel('kanal');
        const supportRole = interaction.options.getRole('support_rolle');
        const ticketCategory = interaction.options.getChannel('kategorie');
        const displayTitle = interaction.options.getString('titel') || 'Support Ticket öffnen';
        const displayDescription = interaction.options.getString('beschreibung') || 'Klicke auf den Button unten, um ein neues Support-Ticket zu öffnen.';

        // NEU: Ticket-Nachricht Optionen
        const ticketMessageTitle = interaction.options.getString('ticket_titel') || '📩 Ticket geöffnet';
        const ticketMessageDescription = interaction.options.getString('ticket_beschreibung') || 'Bitte beschreibe dein Anliegen hier. Ein Teammitglied wird sich bald bei dir melden.';
        const transcriptChannel = interaction.options.getChannel('transkript_kanal');

        // Berechtigungsprüfung für den Bot (wie gehabt)
        if (!interaction.guild.members.me.permissionsIn(ticketCategory).has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: `❌ Ich habe nicht die Berechtigung, Kanäle in der Kategorie \`${ticketCategory.name}\` zu verwalten. Bitte gib mir die nötigen Berechtigungen.`,
                ephemeral: true
            });
        }
        if (!interaction.guild.members.me.permissionsIn(setupChannel).has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: `❌ Ich habe nicht die Berechtigung, Nachrichten im Kanal ${setupChannel} zu senden.`,
                ephemeral: true
            });
        }
        // NEU: Berechtigungsprüfung für Transkript-Kanal
        if (transcriptChannel && !interaction.guild.members.me.permissionsIn(transcriptChannel).has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: `❌ Ich habe nicht die Berechtigung, Nachrichten im Transkript-Kanal ${transcriptChannel} zu senden.`,
                ephemeral: true
            });
        }


        try {
            const embed = new EmbedBuilder()
                .setTitle(displayTitle)
                .setDescription(displayDescription)
                .setColor('Green')
                .setFooter({ text: 'Bitte nur bei echten Problemen ein Ticket öffnen!' });

            const button = new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Ticket öffnen')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✉️');

            const row = new ActionRowBuilder().addComponents(button);

            const sentMessage = await setupChannel.send({ embeds: [embed], components: [row] });

            const configData = {
                guildId: interaction.guild.id,
                setupChannelId: setupChannel.id,
                supportRoleId: supportRole.id,
                ticketCategoryId: ticketCategory.id,
                ticketMessageId: sentMessage.id,
                // NEU: Speichern der angepassten Ticket-Nachricht und des Transkript-Kanals
                ticketWelcomeTitle: ticketMessageTitle,
                ticketWelcomeDescription: ticketMessageDescription,
                transcriptChannelId: transcriptChannel ? transcriptChannel.id : null // Speichere die ID, oder null wenn nicht gesetzt
            };

            fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

            await interaction.reply({
                content: `✅ Ticket-System erfolgreich im Kanal ${setupChannel} eingerichtet! Support-Rolle: <@&${supportRole.id}>. Ticket-Kanäle werden in Kategorie "${ticketCategory.name}" erstellt.${transcriptChannel ? ` Transkripte werden in ${transcriptChannel} gesendet.` : ''}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Fehler beim Einrichten des Ticket-Systems:', error);
            await interaction.reply({
                content: '❌ Es gab einen Fehler beim Einrichten des Ticket-Systems. Bitte überprüfe meine Berechtigungen und versuche es erneut.',
                ephemeral: true
            });
        }
    },
};