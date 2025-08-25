// commands/utility/embeds.js
import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    ChannelType,
    PermissionFlagsBits,
    DiscordAPIError,
    InteractionType
} from 'discord.js';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.debug('[Embeds Command] embeds.js module geladen.');

const embedsFilePath = path.resolve(__dirname, '../../data/savedEmbeds.json');
const sessionsFilePath = path.resolve(__dirname, '../../data/activeEmbedSessions.json');

// Verwende globale Maps, die einmalig geladen und bei Änderungen aktualisiert werden.
let savedEmbeds = new Map();
let activeSessions = new Map();

/**
 * Lädt die gespeicherten Embeds aus der Datei.
 * @returns {Promise<void>}
 */
async function loadSavedEmbeds() {
    try {
        const data = await fs.readFile(embedsFilePath, 'utf8');
        if (!data || data.trim().length === 0) {
            savedEmbeds = new Map();
            logger.warn('[Embeds Command] savedEmbeds.json war leer oder ungültig. Initialisiere mit leerer Map.');
            return;
        }
        const parsedData = JSON.parse(data);
        if (Array.isArray(parsedData)) {
            savedEmbeds = new Map(parsedData);
            logger.debug('[Embeds Command] Gespeicherte Embeds erfolgreich geladen.');
        } else {
            savedEmbeds = new Map();
            logger.error('[Embeds Command] savedEmbeds.json enthielt kein gültiges Array. Initialisiere mit leerer Map.');
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[Embeds Command] savedEmbeds.json nicht gefunden. Erstelle eine leere Map.');
            savedEmbeds = new Map();
        } else {
            logger.error('[Embeds Command] Fehler beim Laden der gespeicherten Embeds:', error);
            savedEmbeds = new Map();
        }
    }
}

/**
 * Lädt die aktiven Sessions aus der Datei.
 * @returns {Promise<void>}
 */
async function loadActiveSessions() {
    try {
        const data = await fs.readFile(sessionsFilePath, 'utf8');
        if (!data || data.trim().length === 0) {
            activeSessions = new Map();
            logger.warn('[Embeds Command] activeEmbedSessions.json war leer oder ungültig. Initialisiere mit leerer Map.');
            return;
        }
        const parsedData = JSON.parse(data);
        if (Array.isArray(parsedData)) {
            activeSessions = new Map(parsedData);
            logger.debug('[Embeds Command] Aktive Sessions erfolgreich geladen.');
        } else {
            activeSessions = new Map();
            logger.error('[Embeds Command] activeEmbedSessions.json enthielt kein gültiges Array. Initialisiere mit leerer Map.');
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[Embeds Command] activeEmbedSessions.json nicht gefunden. Erstelle eine leere Map.');
            activeSessions = new Map();
        } else {
            logger.error('[Embeds Command] Fehler beim Laden der aktiven Sessions:', error);
            activeSessions = new Map();
        }
    }
}

/**
 * Speichert die aktiven Sessions in der Datei.
 * @returns {Promise<void>}
 */
async function saveActiveSessions() {
    try {
        const data = JSON.stringify(Array.from(activeSessions.entries()));
        await fs.writeFile(sessionsFilePath, data, 'utf8');
    } catch (error) {
        logger.error('[Embeds Command] Fehler beim Speichern der aktiven Sessions:', error);
    }
}

/**
 * Sendet eine private Fehlerantwort an den Nutzer.
 * @param {import('discord.js').Interaction} interaction
 * @param {string} lang
 * @param {string} errorKey
 */
async function sendErrorResponse(interaction, lang, errorKey = 'GENERAL_ERROR') {
    const errorMessage = getTranslatedText(lang, `embeds_command.errors.${errorKey}`);
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    } catch (e) {
        logger.error('[Embeds Command] Konnte Fehlerantwort nicht senden:', e);
    }
}

/**
 * Erstellt die ActionRows für den Embed-Builder.
 * @param {string} lang
 * @returns {Array<import('discord.js').ActionRowBuilder>}
 */
function createBuilderComponents(lang) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('embed_select_menu')
        .setPlaceholder(getTranslatedText(lang, 'embeds_command.placeholder'))
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.title'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.title_desc'))
                .setValue('edit_title')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.description'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.description_desc'))
                .setValue('edit_description')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.color'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.color_desc'))
                .setValue('edit_color')
                .setEmoji('🎨'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.image'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.image_desc'))
                .setValue('edit_image')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.thumbnail'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.thumbnail_desc'))
                .setValue('edit_thumbnail')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.footer'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.footer_desc'))
                .setValue('edit_footer')
                .setEmoji('🦶'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.author'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.author_desc'))
                .setValue('edit_author')
                .setEmoji('👤'),
            new StringSelectMenuOptionBuilder()
                .setLabel(getTranslatedText(lang, 'embeds_command.menu.fields'))
                .setDescription(getTranslatedText(lang, 'embeds_command.menu.fields_desc'))
                .setValue('edit_fields')
                .setEmoji('📑'),
        );
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('send_embed')
                .setLabel(getTranslatedText(lang, 'embeds_command.send_button'))
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('save_embed')
                .setLabel(getTranslatedText(lang, 'embeds_command.save_button'))
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💾'),
            new ButtonBuilder()
                .setCustomId('cancel_embed')
                .setLabel(getTranslatedText(lang, 'embeds_command.cancel_button'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

    return [selectRow, buttonRow];
}

/**
 * Aktualisiert die Session-Nachricht mit dem aktuellen Embed und den Komponenten.
 * @param {import('discord.js').Interaction} interaction
 * @param {object} session
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function updateSessionMessage(interaction, session, embed) {
    const lang = getGuildLanguage(interaction.guildId);
    const components = createBuilderComponents(lang);
    
    try {
        logger.debug(`[Embed Builder] Versuche, Session-Nachricht zu aktualisieren für ${interaction.user.id}`);
        
        await interaction.update({
            content: getTranslatedText(lang, 'embeds_command.interaction_message'),
            embeds: [embed],
            components: components,
            flags: [MessageFlags.Ephemeral]
        });

        session.embed = embed.toJSON(); // Aktualisiere die in-memory Session
        await saveActiveSessions();
        
        logger.debug(`[Embed Builder] Session-Nachricht erfolgreich aktualisiert für ${interaction.user.id}.`);
    } catch (error) {
        logger.error(`[Embed Builder] Fehler beim Aktualisieren der Session-Nachricht für ${interaction.user.id}:`, error);
        // Nicht die Session löschen, sondern nur eine Fehlermeldung senden
        await interaction.followUp({
            content: getTranslatedText(lang, 'embeds_command.errors.GENERAL_ERROR'),
            ephemeral: true
        });
    }
}

/**
 * Behandelt alle Interaktionen für den Embed-Builder.
 * @param {import('discord.js').Interaction} interaction
 */
export async function handleEmbedBuilderInteraction(interaction) {
    const lang = getGuildLanguage(interaction.guildId);

    try {
        // Zuerst die gespeicherten und aktiven Sessions aus dem Speicher abrufen
        const session = activeSessions.get(interaction.user.id);

        if (interaction.isCommand() && interaction.commandName === 'embeds') {
            const subcommand = interaction.options.getSubcommand(false);

            if (!subcommand) {
                await interaction.reply({
                    content: getTranslatedText(lang, 'embeds_command.errors.NO_SUBCOMMAND'),
                    ephemeral: true
                });
                return;
            }

            if (subcommand === 'create') {
                if (activeSessions.has(interaction.user.id)) {
                    await interaction.reply({
                        content: getTranslatedText(lang, 'embeds_command.already_running'),
                        ephemeral: true
                    });
                    return;
                }

                const newEmbed = new EmbedBuilder()
                    .setTitle(getTranslatedText(lang, 'embeds_command.default_title'))
                    .setDescription(getTranslatedText(lang, 'embeds_command.default_description'));

                const components = createBuilderComponents(lang);

                const reply = await interaction.reply({
                    content: getTranslatedText(lang, 'embeds_command.interaction_message'),
                    embeds: [newEmbed],
                    components: components,
                    flags: [MessageFlags.Ephemeral]
                });

                activeSessions.set(interaction.user.id, {
                    messageId: reply.id,
                    embed: newEmbed.toJSON()
                });
                await saveActiveSessions();
                logger.debug(`[Embed Builder] Neue Session für Nutzer ${interaction.user.id} gestartet.`);
            }
        } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
            logger.debug(`[Embed Builder] Interaktion empfangen von ${interaction.user.id}: ${interaction.customId}`);

            if (!session) {
                logger.warn(`[Embed Builder] Interaktion von ${interaction.user.id} hat keine aktive Session. Session abgelaufen.`);
                await interaction.reply({
                    content: getTranslatedText(lang, 'embeds_command.errors.SESSION_EXPIRED'),
                    ephemeral: true
                });
                return;
            }

            const embed = new EmbedBuilder(session.embed);
            
            if (interaction.isStringSelectMenu()) {
                switch (interaction.customId) {
                    case 'embed_select_menu':
                        const selectedValue = interaction.values[0];
                        let modal;
                        switch (selectedValue) {
                            case 'edit_title':
                                modal = new ModalBuilder()
                                    .setCustomId('modal_edit_title')
                                    .setTitle(getTranslatedText(lang, 'embeds_command.menu.title'));
                                modal.addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new TextInputBuilder()
                                            .setCustomId('input_title')
                                            .setLabel(getTranslatedText(lang, 'embeds_command.menu.title'))
                                            .setStyle(TextInputStyle.Short)
                                            .setRequired(true)
                                            .setValue(embed.data.title || '')
                                    )
                                );
                                await interaction.showModal(modal);
                                break;
                            case 'edit_description':
                                modal = new ModalBuilder()
                                    .setCustomId('modal_edit_description')
                                    .setTitle(getTranslatedText(lang, 'embeds_command.menu.description'));
                                modal.addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new TextInputBuilder()
                                            .setCustomId('input_description')
                                            .setLabel(getTranslatedText(lang, 'embeds_command.menu.description'))
                                            .setStyle(TextInputStyle.Paragraph)
                                            .setRequired(true)
                                            .setValue(embed.data.description || '')
                                    )
                                );
                                await interaction.showModal(modal);
                                break;
                            // ... weitere Fälle für andere Menüoptionen
                        }
                        break;
                }
            } else if (interaction.isButton()) {
                switch (interaction.customId) {
                    case 'send_embed':
                        logger.debug(`[Embed Builder] "Senden"-Button geklickt von ${interaction.user.id}`);
                        const embedChannel = interaction.channel;
                        try {
                            await embedChannel.send({ embeds: [embed] });
                            await interaction.update({
                                content: getTranslatedText(lang, 'embeds_command.send_success'),
                                embeds: [],
                                components: []
                            });
                            activeSessions.delete(interaction.user.id);
                            await saveActiveSessions();
                        } catch (error) {
                            logger.error(`[Embed Builder] Fehler beim Senden des Embeds in Kanal ${embedChannel.id}:`, error);
                            await sendErrorResponse(interaction, lang, 'SENDING_FAILED');
                        }
                        break;
                    case 'save_embed':
                        logger.debug(`[Embed Builder] "Speichern"-Button geklickt von ${interaction.user.id}`);
                        const saveModal = new ModalBuilder()
                            .setCustomId('modal_save_embed')
                            .setTitle(getTranslatedText(lang, 'embeds_command.save_modal_title'));
                        saveModal.addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('input_save_name')
                                    .setLabel(getTranslatedText(lang, 'embeds_command.save_modal_label'))
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                            )
                        );
                        await interaction.showModal(saveModal);
                        break;
                    case 'cancel_embed':
                        logger.debug(`[Embed Builder] "Abbrechen"-Button geklickt von ${interaction.user.id}`);
                        await interaction.update({
                            content: getTranslatedText(lang, 'embeds_command.cancel_message'),
                            embeds: [],
                            components: []
                        });
                        activeSessions.delete(interaction.user.id);
                        await saveActiveSessions();
                        break;
                }
            } else if (interaction.isModalSubmit()) {
                logger.debug(`[Embed Builder] Modal-Interaktion empfangen von ${interaction.user.id}: ${interaction.customId}`);
                switch (interaction.customId) {
                    case 'modal_edit_title':
                        const title = interaction.fields.getTextInputValue('input_title');
                        embed.setTitle(title);
                        await updateSessionMessage(interaction, session, embed);
                        break;
                    case 'modal_edit_description':
                        const description = interaction.fields.getTextInputValue('input_description');
                        embed.setDescription(description);
                        await updateSessionMessage(interaction, session, embed);
                        break;
                    case 'modal_save_embed':
                        const saveName = interaction.fields.getTextInputValue('input_save_name');
                        savedEmbeds.set(saveName, embed.toJSON());
                        await fs.writeFile(embedsFilePath, JSON.stringify(Array.from(savedEmbeds.entries())), 'utf8');
                        logger.debug(`[Embed Builder] Embed unter dem Namen "${saveName}" gespeichert.`);
                        await interaction.update({
                            content: getTranslatedText(lang, 'embeds_command.save_success', { embedName: saveName }),
                            embeds: [],
                            components: []
                        });
                        activeSessions.delete(interaction.user.id);
                        await saveActiveSessions();
                        break;
                }
            }
        }
    } catch (error) {
        logger.error(`[Embed Builder] Allgemeiner Fehler in der Interaktion für Nutzer ${interaction.user.id}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await sendErrorResponse(interaction, lang);
        }
        if (session) {
            activeSessions.delete(interaction.user.id);
            await saveActiveSessions();
        }
    }
}

// Lade die Sessions und Embeds einmalig beim Start des Moduls
(async () => {
    await loadSavedEmbeds();
    await loadActiveSessions();
})();

// Export the data and execute function as before
export const data = new SlashCommandBuilder()
    .setName('embeds')
    .setDescription('Creates and manages Discord embeds.')
    .setDescriptionLocalizations({
        de: getTranslatedText('de', 'embeds_command.DESCRIPTION'),
        'en-US': getTranslatedText('en', 'embeds_command.DESCRIPTION'),
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
        subcommand
        .setName('create')
        .setDescription('Starts the embed builder to create a new embed.')
        .setDescriptionLocalizations({
            de: getTranslatedText('de', 'embeds_command.CREATE_SUBCOMMAND_DESCRIPTION'),
            'en-US': getTranslatedText('en', 'embeds_command.CREATE_SUBCOMMAND_DESCRIPTION'),
        }));

export const category = 'Utility';

export async function execute(interaction) {
    await handleEmbedBuilderInteraction(interaction);
}
export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const choices = Array.from(savedEmbeds.keys()).filter(choice => choice.toLowerCase().includes(focusedValue.toLowerCase()));
    await interaction.respond(choices.map(choice => ({ name: choice, value: choice })));
}