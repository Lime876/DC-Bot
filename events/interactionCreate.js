// events/interactionCreate.js
const { Events, MessageFlags } = require('discord.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');

/**
 * Antwortet sicher auf eine Interaktion, egal ob sie bereits beantwortet oder verzögert wurde.
 * Verwendet `reply` oder `followUp` entsprechend.
 * @param {Interaction} interaction - Die Discord-Interaktion.
 * @param {string} content - Der Inhalt der Antwort.
 * @param {object} options - Zusätzliche Optionen für die Antwort (z.B. embeds, components, flags).
 */
async function safeReply(interaction, content, options = {}) {
    const replyOptions = { ...options, content: content };

    // KORREKTUR: Korrekte Handhabung des 'ephemeral'-Flags
    if (options.ephemeral) {
        // Kombiniere das Ephemeral-Flag mit bestehenden Flags (falls vorhanden)
        replyOptions.flags = (replyOptions.flags || 0) | MessageFlags.Ephemeral;
        delete replyOptions.ephemeral; // Entferne die veraltete 'ephemeral'-Eigenschaft
    }

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyOptions);
        } else {
            await interaction.reply(replyOptions);
        }
    } catch (error) {
        console.error(`[SafeReply Error] Fehler beim Antworten auf Interaktion (ID: ${interaction.id}, CustomId: ${interaction.customId || 'N/A'}):`, error);
    }
}


module.exports = {
    name: Events.InteractionCreate,
    /**
     * Führt Code aus, wenn eine Interaktion erstellt wird.
     * @param {Interaction} interaction - Die empfangene Discord-Interaktion.
     * @param {Client} client - Der Discord-Client-Instanz.
     */
    async execute(interaction, client) {
        // Ignoriere Interaktionen von Bots
        if (interaction.user.bot) return;

        // Ignoriere Interaktionen außerhalb eines Guilds (z.B. DMs), wenn sie nicht explizit behandelt werden sollen
        if (!interaction.guild) {
            console.log(`[InteractionCreate] Interaktion außerhalb eines Guilds empfangen: ${interaction.id}`);
            // Du könntest hier auch eine Antwort in den DMs senden, wenn gewünscht.
            return;
        }

        const guildId = interaction.guild.id;
        const lang = getGuildLanguage(guildId);

        try {
            // Behandelt Slash Commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`[InteractionCreate] Kein Command mit dem Namen '${interaction.commandName}' gefunden.`);
                    return safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_COMMAND'), { ephemeral: true });
                }

                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    console.error(`[InteractionCreate] Fehler beim Ausführen von Command '${interaction.commandName}':`, error);
                    await safeReply(interaction, getTranslatedText(lang, 'bot_messages.ERROR_EXECUTING_COMMAND'), { ephemeral: true });
                }
            }
            // Behandelt Button-Interaktionen
            else if (interaction.isButton()) {
                // Delegiert alle Embed-bezogenen Buttons an den 'embeds' Befehl
                if (interaction.customId === 'send_embed' ||
                    interaction.customId === 'reset_embed' ||
                    interaction.customId === 'cancel_builder' ||
                    interaction.customId.startsWith('embed_')) {

                    const embedsCommand = client.commands.get('embeds');
                    if (embedsCommand && embedsCommand.handleInteraction) {
                        await embedsCommand.handleInteraction(interaction, client);
                    } else {
                        console.warn(`[InteractionCreate] Embed-Button '${interaction.customId}' ohne zugehörigen Handler oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_BUTTON_INTERACTION'), { ephemeral: true });
                    }
                }
                // NEU: Delegiert alle Hilfe-bezogenen Buttons an den 'help' Befehl
                else if (interaction.customId.startsWith('help_')) { // Annahme: Hilfe-Buttons beginnen mit 'help_'
                    const helpCommand = client.commands.get('help');
                    // WICHTIG: Der 'help'-Befehl MUSS eine Methode 'handleInteraction' exportieren,
                    // die Interaktionen von Buttons (oder SelectMenus) verarbeitet.
                    if (helpCommand && helpCommand.handleInteraction) {
                        await helpCommand.handleInteraction(interaction, client);
                    } else {
                        console.warn(`[InteractionCreate] Hilfe-Button '${interaction.customId}' ohne zugehörigen Handler ('handleInteraction' fehlt im 'help'-Befehl) oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_BUTTON_INTERACTION'), { ephemeral: true });
                    }
                }
                else {
                    console.warn(`[InteractionCreate] Unbehandelte Button-Interaktion customId: ${interaction.customId}`);
                    await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_BUTTON_INTERACTION'), { ephemeral: true });
                }
            }
            // Behandelt String Select Menu-Interaktionen
            else if (interaction.isStringSelectMenu()) {
                // Delegiert alle Embed-bezogenen Select Menus an den 'embeds' Befehl
                if (interaction.customId.startsWith('embed_')) {
                    const embedsCommand = client.commands.get('embeds');
                    if (embedsCommand && embedsCommand.handleInteraction) {
                        await embedsCommand.handleInteraction(interaction, client);
                    } else {
                        console.warn(`[InteractionCreate] Embed-SelectMenu '${interaction.customId}' ohne zugehörigen Handler oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_SELECT_MENU_INTERACTION'), { ephemeral: true });
                    }
                }
                // NEU: Delegiert Hilfe-bezogene Select Menus (falls vorhanden) an den 'help' Befehl
                else if (interaction.customId.startsWith('help_')) {
                    const helpCommand = client.commands.get('help');
                    if (helpCommand && helpCommand.handleInteraction) {
                        await helpCommand.handleInteraction(interaction, client);
                    } else {
                        console.warn(`[InteractionCreate] Hilfe-SelectMenu '${interaction.customId}' ohne zugehörigen Handler oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_SELECT_MENU_INTERACTION'), { ephemeral: true });
                    }
                }
                else {
                    console.warn(`[InteractionCreate] Unbehandelte StringSelectMenu-Interaktion customId: ${interaction.customId}`);
                    await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_SELECT_MENU_INTERACTION'), { ephemeral: true });
                }
            }
            // Behandelt Kontextmenü-Befehle (Benutzer oder Nachricht)
            else if (interaction.isContextMenuCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (command) {
                    await command.execute(interaction, client);
                } else {
                    console.warn(`[InteractionCreate] Unbekannter Kontextmenü-Befehl: ${interaction.commandName}`);
                    await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_CONTEXT_MENU_COMMAND'), { ephemeral: true });
                }
            }
            // Behandelt Autocomplete-Interaktionen
            else if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`[InteractionCreate] Kein Command für Autovervollständigung mit dem Namen '${interaction.commandName}' gefunden.`);
                    return; // Autocomplete-Interaktionen müssen mit .respond() beantwortet werden, nicht mit safeReply
                }
                try {
                    await command.autocomplete(interaction, client);
                } catch (error) {
                    console.error(`[InteractionCreate] Fehler bei Autovervollständigung für Command '${interaction.commandName}':`, error);
                }
            }
            // Behandelt Modal-Submits
            else if (interaction.isModalSubmit()) {
                // Delegiert alle Embed-bezogenen Modals und das Lösch-Bestätigungs-Modal
                if (interaction.customId.startsWith('embed_') || interaction.customId.startsWith('confirm_delete_embed_modal_')) {
                    const embedsCommand = client.commands.get('embeds');
                    if (embedsCommand && embedsCommand.handleInteraction) {
                        try {
                            await embedsCommand.handleInteraction(interaction, client);
                            return;
                        } catch (error) {
                            console.error(`[ModalInteraction] Fehler beim Verarbeiten des Embed Builder Modals '${interaction.customId}':`, error);
                            await safeReply(interaction, getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), { ephemeral: true });
                            return;
                        }
                    } else {
                        console.warn(`[InteractionCreate] Embed-Modal '${interaction.customId}' ohne zugehörigen Handler oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_MODAL_SUBMIT', { modalId: interaction.customId }), { ephemeral: true });
                    }
                }
                // NEU: Delegiert Hilfe-bezogene Modals (falls vorhanden) an den 'help' Befehl
                else if (interaction.customId.startsWith('help_')) {
                    const helpCommand = client.commands.get('help');
                    if (helpCommand && helpCommand.handleInteraction) {
                        try {
                            await helpCommand.handleInteraction(interaction, client);
                            return;
                        } catch (error) {
                            console.error(`[ModalInteraction] Fehler beim Verarbeiten des Help Modals '${interaction.customId}':`, error);
                            await safeReply(interaction, getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), { ephemeral: true });
                            return;
                        }
                    } else {
                        console.warn(`[InteractionCreate] Hilfe-Modal '${interaction.customId}' ohne zugehörigen Handler oder falsche Delegation.`);
                        await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_MODAL_SUBMIT', { modalId: interaction.customId }), { ephemeral: true });
                    }
                }
                else {
                    console.warn(`[InteractionCreate] Unbehandelte Modal Submit customId: ${interaction.customId}`);
                    if (!interaction.replied && !interaction.deferred) {
                         await interaction.deferUpdate().catch(e => console.error("Fehler beim DeferUpdate für unbekanntes Modal:", e));
                    }
                    await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNKNOWN_MODAL_SUBMIT', { modalId: interaction.customId }), { ephemeral: true });
                }
            }
            // Andere Interaktionstypen
            else {
                console.warn(`[InteractionCreate] Unbekannter oder unbehandelter Interaktionstyp: ${interaction.type}, CustomId: ${interaction.customId || 'N/A'}`);
                if (!interaction.replied && !interaction.deferred) {
                    try {
                        await interaction.deferUpdate();
                    } catch (e) {
                        console.error("Fehler beim DeferUpdate für unbekannten Interaktionstyp:", e);
                    }
                }
                await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNEXPECTED_ERROR'), { ephemeral: true });
            }

        } catch (globalError) {
            console.error('Ein **globaler Fehler** in interactionCreate aufgetreten:', globalError);
            if (interaction.isRepliable()) {
                await safeReply(interaction, getTranslatedText(lang, 'bot_messages.UNEXPECTED_ERROR'), { ephemeral: true });
            }
        }
    },
};