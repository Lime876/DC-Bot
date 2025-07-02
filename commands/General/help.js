// commands/General/help.js
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags, ComponentType } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');

// Temporäre In-Memory-Flutkontrolle für Hilfesitzungen
const activeHelpSessions = new Map(); // Map: messageId -> { userId, currentPageIndex }

// Definierte Hilfeseiten mit Schlüsseln für Übersetzungen
// Die Titel und Beschreibungen werden aus den Language-Dateien über getTranslatedText geholt.
const helpPages = [
    { pageKey: "PAGE_0", titleKey: "PAGE_0_TITLE" }, // Allgemeine Befehle
    { pageKey: "PAGE_1", titleKey: "PAGE_1_TITLE" }, // Admin-Befehle
    { pageKey: "PAGE_2", titleKey: "PAGE_2_TITLE" }, // Moderations-Befehle
    { pageKey: "PAGE_3", titleKey: "PAGE_3_TITLE" }, // Ticket-System
    { pageKey: "PAGE_4", titleKey: "PAGE_4_TITLE" }  // JTC (Join to Create)
    // Füge hier weitere Seiten/Kategorien hinzu, mit entsprechenden pageKeys und titleKeys für die Übersetzungen
];

/**
 * Erstellt den Embed für die Hilfeseite.
 * @param {number} pageIndex Der Index der anzuzeigenden Seite.
 * @param {string} lang Die Sprache für die Übersetzungen.
 * @returns {EmbedBuilder} Der fertige Embed.
 */
const getHelpEmbed = (pageIndex, lang) => {
    const pageData = helpPages[pageIndex];
    // Die tatsächlichen Titel und Beschreibungen werden hier aus den Sprachdateien geholt.
    const pageTitle = getTranslatedText(lang, `help_command.${pageData.titleKey}`);
    const pageDescription = getTranslatedText(lang, `help_command.${pageData.pageKey}_DESCRIPTION`);

    return new EmbedBuilder()
        .setColor('Blue')
        .setTitle(pageTitle)
        .setDescription(pageDescription)
        .setFooter({ text: getTranslatedText(lang, 'help_command.PAGE_FOOTER', { currentPage: pageIndex + 1, totalPages: helpPages.length }) });
};

/**
 * Erstellt die ActionRow mit dem Select-Menü für die Navigation.
 * @param {number} currentPageIndex Der aktuell ausgewählte Seitenindex.
 * @param {string} lang Die Sprache für die Übersetzungen.
 * @returns {ActionRowBuilder} Die ActionRow mit dem Select-Menü.
 */
const getSelectMenuRow = (currentPageIndex, lang) => {
    const options = helpPages.map((page, index) => ({
        label: getTranslatedText(lang, `help_command.${page.titleKey}`), // Titel der Seite als Label
        value: index.toString(), // Seitenindex als Wert
        description: getTranslatedText(lang, `help_command.${page.pageKey}_SHORT_DESCRIPTION`) || '', // Kurze Beschreibung für die Option
        default: index === currentPageIndex // Setzt die aktuell ausgewählte Seite als Standard
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_select_menu')
        .setPlaceholder(getTranslatedText(lang, 'help_command.SELECT_MENU_PLACEHOLDER'))
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a list of commands.') // Fallback-Beschreibung
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'help_command.DESCRIPTION'),
            'en-US': getTranslatedText('en', 'help_command.DESCRIPTION'),
        }),

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);

        let currentPageIndex = 0; // Start mit der ersten Seite

        const initialEmbed = getHelpEmbed(currentPageIndex, lang);
        const initialRow = getSelectMenuRow(currentPageIndex, lang);

        const message = await interaction.reply({
            embeds: [initialEmbed],
            components: [initialRow],
            fetchReply: true, // Wichtig, um die Nachricht für den Collector zu erhalten
        });

        // Speichere den Zustand für diese spezifische Hilfesitzung
        activeHelpSessions.set(message.id, {
            userId: userId,
            currentPageIndex: currentPageIndex,
        });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.message.id === message.id && i.customId === 'help_select_menu',
            componentType: ComponentType.StringSelect, // Filtert auf StringSelect-Menü
            time: 300000, // Collector 5 Minuten aktiv
        });

        collector.on('collect', async i => {
            // Die Interaktion hier ist die Auswahl im Select-Menü, die vom Collector gesammelt wurde.
            // Die handleInteraction Logik ist bereits so aufgebaut, dass sie prüft, ob die Sitzung noch aktiv ist.
            await module.exports.handleInteraction(i, client);
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                try {
                    const session = activeHelpSessions.get(message.id);
                    if (session) {
                        const disabledRow = getSelectMenuRow(session.currentPageIndex, lang);
                        disabledRow.components.forEach(comp => {
                            if (comp instanceof StringSelectMenuBuilder) {
                                comp.setDisabled(true); // Deaktiviere das Select-Menü
                            }
                        });
                        // Sicherstellen, dass die Nachricht noch existiert, bevor sie bearbeitet wird
                        if (message && !message.deleted) {
                            await message.edit({ components: [disabledRow] });
                        }
                        activeHelpSessions.delete(message.id); // Bereinige den Zustand
                    }
                } catch (error) {
                    // Ignoriere 10008 (Unknown Message) Fehler, wenn Nachricht gelöscht wurde
                    if (error.code !== 10008) {
                        console.error('Fehler beim Deaktivieren der Hilfe-Select-Menü nach Zeitüberschreitung:', error);
                    }
                }
            }
        });
    },

    async handleInteraction(interaction, client) {
        const messageId = interaction.message.id;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);

        let session = activeHelpSessions.get(messageId);

        // Defer die Interaktion sofort, um Timeout zu vermeiden
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (deferError) {
            console.error(`[Help Command] Fehler beim Deferring der Select-Menü-Interaktion:`, deferError);
            // Wenn wir hier einen Fehler haben, ist die Interaktion möglicherweise bereits abgelaufen.
            // Wir versuchen trotzdem fortzufahren, aber mit Vorsicht.
        }

        // Überprüfe, ob eine gültige Sitzung existiert und ob der Benutzer der Richtige ist
        if (!session || session.userId !== userId) {
            console.warn(`[Help Command] Interaktion für abgelaufene oder fremde Help-Sitzung: Message ID ${messageId}, User ID ${userId}`);
            try {
                // Wenn bereits deferred, verwenden Sie editReply, sonst followUp
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        content: getTranslatedText(lang, 'bot_messages.INTERACTION_EXPIRED_OR_NOT_YOURS'),
                        flags: MessageFlags.Ephemeral
                    });
                } else {
                    await interaction.followUp({ // Dies sollte nicht passieren, wenn deferUpdate() erfolgreich war
                        content: getTranslatedText(lang, 'bot_messages.INTERACTION_EXPIRED_OR_NOT_YOURS'),
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (error) {
                // Fehler 10062 bedeutet "Unknown Interaction" (bereits abgelaufen/bestätigt)
                if (error.code === 10062) {
                    console.error(`[Help Command] Konnte auf abgelaufene Select-Menü-Interaktion nicht antworten (handleInteraction).`);
                } else {
                    console.error(`[Help Command] Fehler in handleInteraction bei abgelaufener/fremder Sitzung (Folgenachricht):`, error);
                }
            }
            return;
        }

        try {
            // Paginierungslogik für Select-Menü
            if (interaction.customId === 'help_select_menu') {
                session.currentPageIndex = parseInt(interaction.values[0]); // Der ausgewählte Wert ist der Seitenindex
            }

            // Hole das aktualisierte Embed und die Buttons
            const updatedEmbed = getHelpEmbed(session.currentPageIndex, lang);
            const updatedRow = getSelectMenuRow(session.currentPageIndex, lang);

            // Aktualisiere die ursprüngliche Nachricht
            await interaction.editReply({ embeds: [updatedEmbed], components: [updatedRow] });

            // Zustand in der Map aktualisieren
            activeHelpSessions.set(messageId, session);

        } catch (error) {
            // Behandelt den Fall, dass die ursprüngliche Nachricht nicht mehr existiert
            if (error.code === 10008) { // Unknown Message
                console.warn(`[Help Command] Ursprüngliche Hilfe-Nachricht wurde gelöscht, kann nicht bearbeitet werden. ID: ${messageId}`);
                activeHelpSessions.delete(messageId); // Sitzung bereinigen
                return;
            }
            // Fehler 10062 bedeutet "Unknown Interaction" (bereits abgelaufen/bestätigt)
            if (error.code === 10062) {
                console.error(`[Help Command] Interaktion abgelaufen (handleInteraction), konnte Select-Menü-Klick nicht verarbeiten. User: ${interaction.user.tag}`);
                try {
                    // Sende eine neue, ephemere Nachricht, da die ursprüngliche Interaktion abgelaufen ist
                    await interaction.channel.send({
                        content: getTranslatedText(lang, 'bot_messages.INTERACTION_EXPIRED_RESTART_COMMAND'),
                        flags: MessageFlags.Ephemeral, // Macht die Nachricht nur für den Benutzer sichtbar
                    }).catch(sendError => {
                        console.error(`Konnte abgelaufene Interaktionsnachricht nicht senden (handleInteraction):`, sendError);
                    });
                } catch (sendErrorFallback) {
                    console.error(`Konnte abgelaufene Interaktionsnachricht nicht senden (handleInteraction Fallback):`, sendErrorFallback);
                }
            } else {
                console.error(`[Help Command] Unerwarteter Fehler in handleInteraction:`, error);
                try {
                    // Wenn wir hier sind, ist deferUpdate() wahrscheinlich fehlgeschlagen oder die Interaktion war bereits abgelaufen.
                    // Versuchen Sie, eine Follow-up-Nachricht zu senden, wenn nicht bereits geantwortet/deferred
                    if (!interaction.deferred && !interaction.replied) {
                         await interaction.followUp({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), flags: MessageFlags.Ephemeral });
                    } else {
                         await interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), flags: MessageFlags.Ephemeral });
                    }
                } catch (followupError) {
                    console.error(`Konnte Fehlermeldung nach handleInteraction-Fehler nicht senden:`, followupError);
                }
            }
        }
    },
};
