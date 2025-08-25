import { Events, MessageFlags, InteractionType, DiscordAPIError } from 'discord.js';
import { getTranslatedText, getGuildLanguage } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';
// Korrigierter Import-Pfad für embeds.js - Bitte prüfe diesen Pfad
import { handleEmbedBuilderInteraction } from '../commands/services/embeds.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Stelle sicher, dass der client verfügbar ist
        if (!client) client = interaction.client;

        const lang = await getGuildLanguage(interaction.guildId);

        // Ein einzelner, großer try-catch-Block, um alle Interaktionen abzudecken
        try {
            // Die Interaktion muss auf einem Server stattfinden.
            if (!interaction.guild) {
                if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isStringSelectMenu() || interaction.type === InteractionType.ModalSubmit) {
                    await interaction.reply({
                        content: getTranslatedText(lang, 'bot_messages.ONLY_IN_GUILDS'),
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => {});
                    return;
                }
            }

            // Behandle Chat-Befehle
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) {
                    logger.error(`[InteractionCreate] Kein Befehl gefunden, der mit ${interaction.commandName} übereinstimmt.`);
                    const replyOptions = { content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), flags: [MessageFlags.Ephemeral] };
                    await interaction.reply(replyOptions).catch(err => logger.error(err));
                    return;
                }
                await command.execute(interaction, client);
            }
            // Behandle alle embed-spezifischen Interaktionen, die über customIds identifiziert werden
            else if (interaction.customId && (interaction.customId.startsWith('embed_') || interaction.customId.startsWith('modal_edit_'))) {
                // Die Logik für den Embed-Builder wird in einem anderen Modul behandelt
                await handleEmbedBuilderInteraction(interaction);
            }
            // Behandle Autocomplete-Interaktionen
            else if (interaction.isAutocomplete()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) { try { await interaction.respond([]); } catch {} return; }
                if (command.autocomplete) await command.autocomplete(interaction, client);
            }
            // Behandle andere, nicht explizit gehandhabte Interaktionen
            else {
                if (!interaction.replied && !interaction.deferred) {
                     await interaction.reply({ content: getTranslatedText(lang, 'bot_messages.UNKNOWN_INTERACTION'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                } else if (interaction.deferred) {
                     await interaction.followUp({ content: getTranslatedText(lang, 'bot_messages.UNKNOWN_INTERACTION'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }
            }
        } catch (error) {
            // Dies ist der zentrale Fehler-Handler für alle Interaktionen, die nicht spezifisch abgefangen wurden
            if (error instanceof DiscordAPIError && error.code === 10008) {
                logger.warn(`[InteractionCreate] Nachricht nicht gefunden (10008). Keine weitere Antwort gesendet.`);
                return;
            }
            logger.error(`[InteractionCreate] Fehler bei der Verarbeitung der Interaktion:`, error);
            const errorMessage = getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_COMMAND_EXECUTION', { commandName: interaction.commandName || 'unbekannter Befehl', errorMessage: error.message });
            const replyOptions = { content: errorMessage, flags: [MessageFlags.Ephemeral] };

            if (interaction.replied) await interaction.followUp(replyOptions).catch(err => logger.error(err));
            else if (interaction.deferred) await interaction.editReply(replyOptions).catch(err => logger.error(err));
            else await interaction.reply(replyOptions).catch(err => logger.error(err));
        }
    }
};

