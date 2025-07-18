// events/interactionCreate.js
const { Events, MessageFlags } = require('discord.js');
const { getTranslatedText, getGuildLanguage } = require('../utils/languageUtils');
const logger = require('../utils/logger'); // Importiere den neuen Logger

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Wenn es eine Chat-Befehlsinteraktion ist
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                logger.error(`[InteractionCreate] Kein Befehl gefunden, der mit ${interaction.commandName} übereinstimmt.`);
                const lang = await getGuildLanguage(interaction.guild.id);
                await interaction.reply({
                    content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                    flags: [MessageFlags.Ephemeral]
                }).catch(err => logger.error(`[InteractionCreate] Fehler beim Antworten auf unbekannten Befehl:`, err));
                return;
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                logger.error(`[InteractionCreate] Fehler beim Ausführen des Befehls ${interaction.commandName}:`, error);
                const lang = await getGuildLanguage(interaction.guild.id);
                const errorMessage = getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED');
                
                const replyOptions = { content: errorMessage, flags: [MessageFlags.Ephemeral] };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions).catch(err => logger.error(`[InteractionCreate] Fehler beim followUp nach Befehlsfehler:`, err));
                } else {
                    await interaction.reply(replyOptions).catch(err => logger.error(`[InteractionCreate] Fehler beim reply nach Befehlsfehler:`, err));
                }
            }
        } 
        // Wenn es eine Select-Menü-Interaktion ist
        else if (interaction.isStringSelectMenu()) {
            logger.debug(`[InteractionCreate] Select-Menü-Interaktion empfangen mit CustomId: '${interaction.customId}'`);

            // Wenn es das Help-Select-Menü ist, ignorieren wir es hier explizit.
            // Es wird vom Collector im Help-Befehl selbst behandelt.
            if (interaction.customId === 'help_select_menu') {
                logger.debug(`[InteractionCreate] Select-Menü '${interaction.customId}' wird vom Help-Befehl behandelt, ignoriere hier.`);
                return; 
            }

            const lang = await getGuildLanguage(interaction.guild.id);
            logger.warn(`[InteractionCreate] Unbekanntes Select-Menü '${interaction.customId}'.`);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: getTranslatedText(lang, 'bot_messages.UNKNOWN_SELECT_MENU_INTERACTION'), 
                    flags: [MessageFlags.Ephemeral] 
                }).catch(err => logger.error(`[InteractionCreate] Fehler beim Antworten auf unbekanntes Select-Menü:`, err));
            } else if (interaction.deferred) {
                await interaction.followUp({
                    content: getTranslatedText(lang, 'bot_messages.UNKNOWN_SELECT_MENU_INTERACTION'),
                    flags: [MessageFlags.Ephemeral]
                }).catch(err => logger.error(`[InteractionCreate] Fehler beim followUp für unbekanntes Select-Menü:`, err));
            } else {
                logger.warn(`[InteractionCreate] Interaktion für unbekanntes Select-Menü '${interaction.customId}' konnte nicht beantwortet werden (bereits beantwortet/deferiert).`);
            }
        }
        // Wenn es eine Button-Interaktion ist
        else if (interaction.isButton()) {
            // Liste der Buttons, die vom Ticket-System behandelt werden
            const handledButtonCustomIds = ['open_ticket', 'close_ticket', 'claim_ticket'];

            if (handledButtonCustomIds.includes(interaction.customId)) {
                // WICHTIG: NICHT deferUpdate(), NICHT deferReply(), NICHT antworten, NICHT loggen!
                // Nur return, damit das Ticket-System die Interaktion vollständig übernimmt.
                return;
            } else {
                // Dies ist ein unbekannter Button, der nicht explizit behandelt wird.
                const lang = await getGuildLanguage(interaction.guild.id);
                logger.warn(`[InteractionCreate] Unbekannter Button '${interaction.customId}'.`);

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'), 
                        flags: [MessageFlags.Ephemeral] 
                    }).catch(err => logger.error(`[InteractionCreate] Fehler beim Antworten auf unbekannten Button:`, err));
                } else if (interaction.deferred) {
                    await interaction.followUp({
                        content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED'),
                        flags: [MessageFlags.Ephemeral]
                    }).catch(err => logger.error(`[InteractionCreate] Fehler beim followUp für unbekannten Button:`, err));
                } else {
                    logger.warn(`[InteractionCreate] Interaktion für unbekannten Button '${interaction.customId}' konnte nicht beantwortet werden (bereits beantwortet/deferiert).`);
                }
            }
        }
    },
};