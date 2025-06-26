// commands/utility/embeds.js
const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    MessageFlags,
    ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../../utils/languageUtils');
const { v4: uuidv4 } = require('uuid'); // Für eindeutige IDs

// Pfade für die Speicherung der Daten
const savedEmbedsPath = path.join(__dirname, '../../data/savedEmbeds.json'); // Speichert die Embed-Daten selbst
const activeSessionPath = path.join(__dirname, '../../data/activeEmbedSessions.json'); // Speichert nur die aktiven Editor-Sitzungen

// Zustandsvariablen im Speicher
let savedEmbeds = {}; // savedEmbeds[userId][embedUuid] = { name, embedData, lastActivity }
let activeSessions = {}; // activeSessions[userId][messageId] = { embedUuid, channelId, targetChannelId, lang, lastActivity, isInitialCommandContext, initialInteractionId }

// --- Lade-/Speicherfunktionen ---

/**
 * Lädt die gespeicherten Embed-Daten aus savedEmbeds.json.
 */
const loadSavedEmbeds = () => {
    if (fs.existsSync(savedEmbedsPath)) {
        try {
            const data = fs.readFileSync(savedEmbedsPath, 'utf8');
            savedEmbeds = JSON.parse(data);
            for (const userId in savedEmbeds) {
                if (savedEmbeds.hasOwnProperty(userId) && (typeof savedEmbeds[userId] !== 'object' || savedEmbeds[userId] === null || Array.isArray(savedEmbeds[userId]))) {
                    console.warn(`[Embed Builder] Ungültiger savedEmbeds-Eintrag für Benutzer ${userId}. Lösche Eintrag.`);
                    delete savedEmbeds[userId];
                    continue;
                }
                for (const embedUuid in savedEmbeds[userId]) {
                    if (savedEmbeds[userId].hasOwnProperty(embedUuid)) {
                        let embedData = savedEmbeds[userId][embedUuid];
                        if (typeof embedData !== 'object' || embedData === null || !embedData.embed) {
                            console.warn(`[Embed Builder] Ungültiges Embed-Datenobjekt für UUID ${embedUuid} von Benutzer ${userId}. Erstelle Standard-Embed.`);
                            const defaultEmbed = new EmbedBuilder()
                                .setTitle(getTranslatedText('en', 'embed_builder.DEFAULT_TITLE'))
                                .setDescription(getTranslatedText('en', 'embed_builder.DEFAULT_DESCRIPTION'))
                                .setColor(0x0099FF);
                            savedEmbeds[userId][embedUuid] = {
                                name: `Corrupted Embed ${embedUuid.substring(0, 4)}`,
                                embed: defaultEmbed.toJSON(),
                                lastActivity: Date.now()
                            }; // Ersetze den gesamten Eintrag
                            embedData = savedEmbeds[userId][embedUuid]; // Aktualisiere Referenz
                        }
                        // Sicherstellen, dass die Beschreibung immer ein String ist
                        if (embedData.embed && typeof embedData.embed.description !== 'string') {
                            embedData.embed.description = embedData.embed.description || '';
                        }
                        // Sicherstellen, dass ein Name vorhanden ist
                        if (!embedData.name) {
                            embedData.name = `Unbenanntes Embed ${Object.keys(savedEmbeds[userId]).indexOf(embedUuid) + 1}`;
                        }
                    }
                }
                if (Object.keys(savedEmbeds[userId]).length === 0) {
                    delete savedEmbeds[userId];
                }
            }
        } catch (e) {
            console.error(`[Embed Builder] Fehler beim Parsen von ${savedEmbedsPath}:`, e);
            savedEmbeds = {};
        }
    } else {
        try {
            const dir = path.dirname(savedEmbedsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(savedEmbedsPath, JSON.stringify({}), 'utf8');
        } catch (e) {
            console.error(`[Embed Builder] Fehler beim Erstellen von ${savedEmbedsPath}:`, e);
        }
    }
};

/**
 * Speichert die gespeicherten Embed-Daten in savedEmbeds.json.
 */
const saveSavedEmbeds = () => {
    try {
        fs.writeFileSync(savedEmbedsPath, JSON.stringify(savedEmbeds, null, 4), 'utf8');
    } catch (e) {
        console.error(`[Embed Builder] Fehler beim Speichern von ${savedEmbedsPath}:`, e);
    }
};

/**
 * Lädt die aktiven Editor-Sitzungen aus activeEmbedSessions.json.
 */
const loadActiveSessions = () => {
    if (fs.existsSync(activeSessionPath)) {
        try {
            const data = fs.readFileSync(activeSessionPath, 'utf8');
            activeSessions = JSON.parse(data);
            for (const userId in activeSessions) {
                if (activeSessions.hasOwnProperty(userId) && (typeof activeSessions[userId] !== 'object' || activeSessions[userId] === null || Array.isArray(activeSessions[userId]))) {
                    console.warn(`[Embed Builder] Ungültiger activeSession-Eintrag für Benutzer ${userId}. Lösche Eintrag.`);
                    delete activeSessions[userId];
                    continue;
                }
                for (const messageId in activeSessions[userId]) {
                    if (activeSessions[userId].hasOwnProperty(messageId)) {
                        let session = activeSessions[userId][messageId];
                        // Ensure that messageId property exists for consistency, though it's the key
                        if (!session.messageId) {
                            session.messageId = messageId;
                        }
                        if (typeof session !== 'object' || session === null || (!session.embedUuid && !session.isInitialCommandContext) || !session.lastActivity) { // isInitialCommandContext ist optional
                            console.warn(`[Embed Builder] Ungültiger Session-Eintrag für Nachricht ${messageId} von Benutzer ${userId}. Lösche Eintrag.`);
                            delete activeSessions[userId][messageId];
                        }
                    }
                }
                if (Object.keys(activeSessions[userId]).length === 0) {
                    delete activeSessions[userId];
                }
            }

        } catch (e) {
            console.error(`[Embed Builder] Fehler beim Parsen von ${activeSessionPath}:`, e);
            activeSessions = {};
        }
    } else {
        try {
            const dir = path.dirname(activeSessionPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(activeSessionPath, JSON.stringify({}), 'utf8');
        } catch (e) {
            console.error(`[Embed Builder] Fehler beim Erstellen von ${activeSessionPath}:`, e);
        }
    }
};

/**
 * Speichert die aktiven Editor-Sitzungen in activeEmbedSessions.json.
 */
const saveActiveSessions = () => {
    try {
        fs.writeFileSync(activeSessionPath, JSON.stringify(activeSessions, null, 4), 'utf8');
    } catch (e) {
        console.error(`[Embed Builder] Fehler beim Speichern von ${activeSessionPath}:`, e);
    }
};

// Laden beim Bot-Start
loadSavedEmbeds();
loadActiveSessions();


const BUILDER_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minuten

/**
 * Bereinigt abgelaufene Editor-Sitzungen.
 * Diese Funktion bereinigt nur 'activeSessions', nicht 'savedEmbeds'.
 * @param {Client} client - Der Discord-Client-Instanz.
 */
const cleanupExpiredSessions = async (client) => {
    const now = Date.now();
    let updated = false;
    const newActiveSessions = {};

    for (const userId in activeSessions) {
        if (activeSessions.hasOwnProperty(userId)) {
            newActiveSessions[userId] = {};
            for (const messageId in activeSessions[userId]) {
                if (activeSessions[userId].hasOwnProperty(messageId)) {
                    const sessionState = activeSessions[userId][messageId];
                    if (now - sessionState.lastActivity > BUILDER_TIMEOUT_MS) {
                        console.log(`[Embed Builder] Bereinige abgelaufene Editor-Sitzung für Benutzer ${userId}, Nachricht ${messageId}.`);
                        try {
                            const channel = await client.channels.fetch(sessionState.channelId).catch(() => null);
                            if (channel) {
                                // Stellen Sie sicher, dass wir nur versuchen, Nachrichten zu bearbeiten, die vom Bot gesendet wurden.
                                // Interaktionen (wie Modals) haben keine messageId.
                                if (sessionState.messageId && channel.messages) { 
                                    const message = await channel.messages.fetch(sessionState.messageId).catch(() => null);
                                    if (message && message.editable) { // Prüfe ob Nachricht editierbar ist
                                        await message.edit({
                                            content: getTranslatedText(sessionState.lang, 'embed_builder.BUILDER_EXPIRED'),
                                            embeds: [],
                                            components: []
                                        }).catch(() => {});
                                    }
                                }
                            }
                        } catch (e) {
                            console.error(`[Embed Builder] Fehler beim Aufräumen der Nachricht ${messageId} für Benutzer ${userId}:`, e);
                        }
                        updated = true;
                    } else {
                        newActiveSessions[userId][messageId] = sessionState;
                    }
                }
            }
            if (Object.keys(newActiveSessions[userId]).length === 0) {
                delete newActiveSessions[userId];
            }
        }
    }
    
    if (updated || JSON.stringify(activeSessions) !== JSON.stringify(newActiveSessions)) {
        activeSessions = newActiveSessions;
        saveActiveSessions();
    }
};

/**
 * Überprüft, ob eine gegebene Zeichenkette eine gültige URL ist.
 * Leere Strings werden als gültig betrachtet.
 */
const isValidUrl = (string) => {
    if (!string) return true;
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

/**
 * Erstellt die Komponenten (Select-Menü und Buttons) für den Embed Builder-Editor.
 * @param {string} lang - Die Sprache für die Übersetzungen.
 * @returns {Array<ActionRowBuilder>} - Eine Reihe von ActionRowBuildern.
 */
const createBuilderComponents = (lang) => {
    const editSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('embed_edit_select')
        .setPlaceholder(getTranslatedText(lang, 'embed_builder.SELECT_EDIT_OPTION'))
        .addOptions(
            { label: getTranslatedText(lang, 'embed_builder.OPTION_TITLE'), value: 'edit_title', emoji: '📝' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_DESCRIPTION'), value: 'edit_description', emoji: '💬' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_COLOR'), value: 'edit_color', emoji: '🎨' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_AUTHOR'), value: 'edit_author', emoji: '👤' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_FOOTER'), value: 'edit_footer', emoji: '🦶' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_THUMBNAIL'), value: 'edit_thumbnail', emoji: '🖼️' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_IMAGE'), value: 'edit_image', emoji: '📸' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_TIMESTAMP'), value: 'toggle_timestamp', emoji: '⏰' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_URL'), value: 'edit_url', emoji: '🔗' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_ADD_FIELD'), value: 'add_field', emoji: '➕' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_EDIT_FIELD'), value: 'edit_field', emoji: '✏️' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_REMOVE_FIELD'), value: 'remove_field', emoji: '➖' },
            { label: getTranslatedText(lang, 'embed_builder.OPTION_CLEAR_ALL_FIELDS'), value: 'clear_all_fields', emoji: '🗑️' }
        );

    const actionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('send_embed').setLabel(getTranslatedText(lang, 'embed_builder.BUTTON_SEND')).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('reset_embed').setLabel(getTranslatedText(lang, 'embed_builder.BUTTON_RESET')).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_builder').setLabel(getTranslatedText(lang, 'embed_builder.BUTTON_CANCEL')).setStyle(ButtonStyle.Secondary)
        );
    
    return [new ActionRowBuilder().addComponents(editSelectMenu), actionButtons];
};

/**
 * Erstellt die Komponenten für das anfängliche Embed-Management-Menü,
 * einschließlich des Buttons zum Erstellen eines neuen Embeds und
 * individueller Bearbeitungs- und Löschen-Buttons für jedes gespeicherte Embed.
 * @param {string} userId - Die ID des Benutzers.
 * @param {string} lang - Die Sprache für die Übersetzungen.
 * @returns {Array<ActionRowBuilder>} - Eine Reihe von ActionRowBuildern.
 */
const createInitialManagementComponents = (userId, lang) => {
    const components = [];
    const userSavedEmbeds = savedEmbeds[userId] || {};
    const sortedEmbedUuids = Object.keys(userSavedEmbeds).sort((a, b) => userSavedEmbeds[b].lastActivity - userSavedEmbeds[a].lastActivity);

    // Button zum Erstellen eines neuen Embeds
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('embed_create_new')
            .setLabel(getTranslatedText(lang, 'embed_builder.OPTION_CREATE_NEW_EMBED'))
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✨')
    ));

    // Buttons für jedes gespeicherte Embed
    if (sortedEmbedUuids.length > 0) {
        const embedListTitle = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('embed_list_title_placeholder') // Platzhalter, nicht interaktiv
                .setLabel(getTranslatedText(lang, 'embed_builder.YOUR_SAVED_EMBEDS'))
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true) // Nicht interaktiv
        );
        components.push(embedListTitle);


        for (const embedUuid of sortedEmbedUuids) {
            const embedData = userSavedEmbeds[embedUuid];
            let name = embedData.name || `Unbenanntes Embed ${embedUuid.substring(0, 4)}`;

            const row = new ActionRowBuilder();
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`embed_edit_specific_${embedUuid}`)
                    .setLabel(`${getTranslatedText(lang, 'embed_builder.BUTTON_EDIT')} ${name.substring(0, 30)}...`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId(`embed_delete_specific_${embedUuid}`)
                    .setLabel(`${getTranslatedText(lang, 'embed_builder.BUTTON_DELETE')}`)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
            );
            components.push(row);
        }
    } else {
         components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('embed_no_saved_placeholder') // Platzhalter, nicht interaktiv
                .setLabel(getTranslatedText(lang, 'embed_builder.NO_SAVED_EMBEDS_MESSAGE'))
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true) // Nicht interaktiv
        ));
    }


    return components;
};


module.exports = {
    data: new SlashCommandBuilder()
        .setName('embeds')
        .setDescription('Manage multiple embed messages.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
        .addChannelOption(option => 
            option.setName('channel')
            .setDescription('The channel where the embed will be sent to (defaults to current channel for new embeds).')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)),

    async execute(interaction) {
        const lang = getGuildLanguage(interaction.guildId);
        const userId = interaction.user.id;
        const initialTargetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Sende die initiale Antwort und fange das Nachricht-Objekt ab
        const replyMessage = await interaction.reply({
            content: getTranslatedText(lang, 'embed_builder.MANAGE_EMBEDS_PROMPT'),
            components: createInitialManagementComponents(userId, lang),
            flags: [MessageFlags.Ephemeral],
            withResponse: true // Stellt sicher, dass das Message-Objekt zurückgegeben wird
        });
        
        console.log(`[Embed Builder Debug] Raw replyMessage object:`, replyMessage);
        // NEU: Greife auf die tatsächliche Message ID zu, die im replyMessage Objekt enthalten ist
        let sessionKey;
        if (replyMessage.message?.id) { // Discord.js v14
            sessionKey = replyMessage.message.id;
            console.log(`[Embed Builder Debug] Using replyMessage.message.id as session key: ${sessionKey}`);
        } else if (replyMessage.resource?.message?.id) { // Alternativer Pfad in manchen Fällen (ältere Discord.js Versionen oder spezielle Interaktionen)
             sessionKey = replyMessage.resource.message.id;
             console.log(`[Embed Builder Debug] Using replyMessage.resource.message.id as session key: ${sessionKey}`);
        }
        
        if (!sessionKey) { // Fallback: Wenn immer noch keine Message ID gefunden wurde
            sessionKey = interaction.id; // Dann bleibt die interaction ID als letzter Ausweg (Weniger ideal für nachfolgende Edits, aber als Notlösung)
            console.warn(`[Embed Builder Warn] Could not get reply message ID. Falling back to interaction.id as session key: ${sessionKey}`);
        }


        if (!activeSessions[userId]) activeSessions[userId] = {};
        activeSessions[userId][sessionKey] = { // *** Wichtig: sessionKey hier verwenden ***
            messageId: sessionKey, // Speichere die Message ID der initialen Nachricht in der Session
            channelId: interaction.channel.id, 
            targetChannelId: initialTargetChannel.id, 
            lang: lang,
            lastActivity: Date.now(),
            isInitialCommandContext: true,
            initialInteractionId: interaction.id // Original Interaction ID speichern (für Modals, die keine messageId haben)
        };
        saveActiveSessions();
        console.log(`[Embed Builder Debug] Initial command session stored for user ${userId} with sessionKey: ${sessionKey}`);
        // console.log(`[Embed Builder Debug] Active sessions for user ${userId}:`, activeSessions[userId]); // <- DIESE ZEILE WURDE KOMMENTIERT
    },

    /**
     * Behandelt alle nachfolgenden Interaktionen (Buttons, Select-Menüs, Modals) für den Embed Builder.
     * @param {Interaction} interaction - Die Discord-Interaktion.
     * @param {Client} client - Der Discord-Client-Instanz.
     */
    async handleInteraction(interaction, client) {
        const userId = interaction.user.id;
        // Für Buttons/Selects ist dies die Message-ID der Nachricht, auf der interagiert wurde.
        // Für Modals ist dies null/undefined.
        const interactionMessageId = interaction.message?.id; 

        const lang = getGuildLanguage(interaction.guildId);

        console.log(`[Embed Builder Debug] handleInteraction called. User: ${userId}, Interaction Message ID: ${interactionMessageId}, Custom ID: ${interaction.customId}`);
        // console.log(`[Embed Builder Debug] Current active sessions for user ${userId}:`, activeSessions[userId]); // <- DIESE ZEILE WURDE KOMMENTIERT

        let currentSessionState = null;
        let initialCommandContext = null; // Dies wird die "Management"-Session sein

        // 1. VERSUCH: Finde die Session direkt über die Message-ID der Interaktion (für Buttons/Selects)
        if (interactionMessageId && activeSessions[userId]?.[interactionMessageId]) {
            currentSessionState = activeSessions[userId][interactionMessageId];
            console.log(`[Embed Builder Debug] Session found directly via interaction.message.id: ${interactionMessageId}`);
        } 
        
        // 2. VERSUCH: Finde die Session über die initialInteractionId (hauptsächlich für Modals, da sie keine message.id haben)
        // Dies durchsucht alle Sessions des Benutzers, um diejenige zu finden, die diese Interaction ID als initiale hat.
        if (!currentSessionState) {
            for (const sessionId in activeSessions[userId]) {
                if (activeSessions[userId].hasOwnProperty(sessionId)) {
                    const session = activeSessions[userId][sessionId];
                    if (session.initialInteractionId === interaction.id) {
                        currentSessionState = session;
                        console.log(`[Embed Builder Debug] Session found via initialInteractionId: ${sessionId}`);
                        break; 
                    }
                    // Wenn es eine "editor" Session ist, die den initialCommandContext als ihre Parent-Interaktion hat (implizit)
                    // Oder wenn die aktuelle Interaktion ein Button/Select AUF der initialen Management-Nachricht ist
                    // Wir müssen auch sicherstellen, dass wir die "initialCommandContext" Session finden, um sie später zu aktualisieren.
                    // Die isInitialCommandContext-Sitzung ist immer die "Hauptsitzung".
                    if (session.isInitialCommandContext && (session.messageId === interactionMessageId || session.initialInteractionId === interaction.id)) {
                        initialCommandContext = session;
                        console.log(`[Embed Builder Debug] Initial command context identified (messageId: ${session.messageId}, initialInteractionId: ${session.initialInteractionId}).`);
                    }
                }
            }
        }

        // Falls currentSessionState immer noch null ist, suchen wir explizit nach der initialen Command-Sitzung,
        // da viele Interaktionen (z.B. Button-Klicks auf dem Management-Menü) diese als die relevante Sitzung haben.
        if (!currentSessionState && interactionMessageId) {
            if (activeSessions[userId]?.[interactionMessageId]?.isInitialCommandContext) {
                 currentSessionState = activeSessions[userId][interactionMessageId];
                 console.log(`[Embed Builder Debug] Current session is the initial command context: ${interactionMessageId}`);
            }
        }

        // Stelle sicher, dass wir immer die initialCommandContext-Sitzung haben, wenn wir auf dem Management-Menü sind
        // Dies ist wichtig, um die Management-Nachricht später aktualisieren zu können.
        if (!initialCommandContext) {
            for (const sessionId in activeSessions[userId]) {
                if (activeSessions[userId].hasOwnProperty(sessionId)) {
                    if (activeSessions[userId][sessionId].isInitialCommandContext) {
                        initialCommandContext = activeSessions[userId][sessionId];
                        console.log(`[Embed Builder Debug] Found initial command context for update purposes: ${initialCommandContext.messageId}`);
                        break;
                    }
                }
            }
        }


        if (!currentSessionState) {
            console.warn(`[Embed Builder Warn] No active session found for user ${userId} with current interaction context.`);
            await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
            return;
        }
        
        console.log(`[Embed Builder Debug] Final session state selected:`, currentSessionState);

        // Aktualisiere die letzte Aktivität der gefundenen Sitzung
        currentSessionState.lastActivity = Date.now();
        saveActiveSessions(); // Speichere sofort nach dem Aktualisieren der Aktivität

        // Bestimme, ob es sich um eine Editor-Sitzung oder den initialen Befehlskontext handelt
        let editorSession = null;
        // Wenn es der initiale Kontext ist UND NICHT die Buttons zum Erstellen/Bearbeiten geklickt wurden,
        // dann ist es die Management-Sitzung.
        // Bei Modals, die von einem Editor-Select-Menü (z.B. edit_description) ausgelöst werden,
        // ist initialCommandContext die Management-Sitzung, currentSessionState aber die Editor-Sitzung.
        if (currentSessionState.isInitialCommandContext && !interaction.customId.startsWith('embed_edit_specific_') && interaction.customId !== 'embed_create_new' && !interaction.isModalSubmit()) {
            initialCommandContext = currentSessionState;
            console.log(`[Embed Builder Debug] Identified as initial command context for current interaction.`);
        } else if (!currentSessionState.isInitialCommandContext || interaction.customId.startsWith('embed_edit_specific_') || interaction.customId === 'embed_create_new') {
            editorSession = currentSessionState; // Es ist eine Editor-Sitzung (oder der Start einer neuen)
            console.log(`[Embed Builder Debug] Identified as editor session.`);
        }

        let currentEmbedData = null; 
        if (editorSession && savedEmbeds[userId]?.[editorSession.embedUuid]) {
            currentEmbedData = savedEmbeds[userId][editorSession.embedUuid];
            currentEmbedData.lastActivity = Date.now();
            saveSavedEmbeds(); // Aktualisiere auch die Aktivität des gespeicherten Embeds
            console.log(`[Embed Builder Debug] Loaded embed data for UUID: ${editorSession.embedUuid}`);
        } else if (editorSession) { 
             console.warn("[Embed Builder] currentEmbedData was null for an active editor session. Embed UUID not found in savedEmbeds. Initializing with default embed.");
             currentEmbedData = { // Initialisiere mit einem leeren/Standard-Embed, um Fehler zu vermeiden
                name: "Corrupted/New Embed",
                embed: new EmbedBuilder()
                    .setTitle(getTranslatedText(lang, 'embed_builder.DEFAULT_TITLE'))
                    .setDescription(getTranslatedText(lang, 'embed_builder.DEFAULT_DESCRIPTION'))
                    .setColor(0x0099FF).toJSON(),
                lastActivity: Date.now()
             };
             // Da es sich hier um einen Fehler oder ein unerwartetes Szenario handelt,
             // speichern wir es nicht sofort in savedEmbeds, es sei denn, es werden Änderungen vorgenommen.
        }


        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : null;
        
        const willShowModal = (interaction.isStringSelectMenu() && 
                              ['edit_title', 'edit_description', 'edit_color', 'edit_author', 'edit_footer', 
                               'edit_thumbnail', 'edit_image', 'edit_url', 'add_field', 'embed_edit_field_select'].includes(selectedValue)) ||
                              (interaction.isButton() && interaction.customId.startsWith('embed_delete_specific_')) || // Delete button shows modal
                              (interaction.customId.startsWith('embed_edit_specific_field_modal_')); // Editing a specific field shows a modal
        
        // Allgemeine Deferral-Logik: Defer Update, wenn keine Modals angezeigt werden und die Interaktion nicht bereits beantwortet ist.
        // Die speziellen Button-Handler (create_new, edit_specific, delete_specific) behandeln ihr Deferring selbst.
        // WICHTIG: KEIN deferUpdate() VOR showModal()! showModal() beantwortet die Interaktion selbst.
        if (!willShowModal && !interaction.deferred && !interaction.replied && 
            !interaction.customId.startsWith('embed_create_new') && 
            !interaction.customId.startsWith('embed_edit_specific_') && 
            !interaction.customId.startsWith('embed_delete_specific_') && // Delete button shows modal, handled below
            !interaction.isModalSubmit()) { // Modal submits don't need deferral here either
             console.log(`[Embed Builder Debug] Deferring update for custom ID: ${interaction.customId}`);
             await interaction.deferUpdate().catch(e => console.warn(`[Embed Builder Warn] Failed to deferUpdate for ${interaction.customId}: ${e.message}`));
        } else {
            console.log(`[Embed Builder Debug] Not deferring: willShowModal=${willShowModal}, deferred=${interaction.deferred}, replied=${interaction.replied}, customId=${interaction.customId}`);
        }
        
        let builderEnded = false; 
        let changesMade = false; 

        let currentEmbedBuilder;
        // Initialisiere currentEmbedBuilder NUR wenn currentEmbedData vorhanden ist
        if (currentEmbedData) {
            currentEmbedBuilder = new EmbedBuilder(JSON.parse(JSON.stringify(currentEmbedData.embed)));
            if (typeof currentEmbedBuilder.data.description !== 'string') {
                currentEmbedBuilder.setDescription(currentEmbedBuilder.data.description || '');
            }
        } else {
             // Dies ist der Fall, wo currentEmbedData fehlt (z.B. beim Löschen)
             // In diesen Fällen ist es nicht notwendig, einen EmbedBuilder zu haben,
             // da keine Bearbeitung des Embeds stattfindet.
             console.log("[Embed Builder Debug] currentEmbedBuilder not initialized as no currentEmbedData was found or needed for this interaction.");
             // Setze es auf null, um spätere unbeabsichtigte Zugriffe zu vermeiden.
             currentEmbedBuilder = null;
        }


        try {
            if (interaction.isStringSelectMenu()) {
                console.log(`[Embed Builder Debug] StringSelectMenu interaction: ${interaction.customId}, value: ${selectedValue}`);
                switch (interaction.customId) {
                    case 'embed_edit_select': 
                        if (!editorSession || !currentEmbedData || !currentEmbedBuilder) {
                             await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                             return;
                        }
                        let modal;
                        switch (selectedValue) {
                            case 'edit_title':
                                modal = new ModalBuilder().setCustomId('embed_title_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_TITLE'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedTitleInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_TITLE')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.title || '').setRequired(false)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_title_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_description':
                                modal = new ModalBuilder().setCustomId('embed_description_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_DESCRIPTION'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedDescriptionInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_DESCRIPTION')).setStyle(TextInputStyle.Paragraph).setValue(currentEmbedBuilder.data.description || '').setRequired(false)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_description_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_color':
                                modal = new ModalBuilder().setCustomId('embed_color_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_COLOR'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedColorInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_COLOR')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.color ? '#' + currentEmbedBuilder.data.color.toString(16).padStart(6, '0').toUpperCase() : '').setPlaceholder('#RRGGBB').setRequired(true)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_color_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_author':
                                modal = new ModalBuilder().setCustomId('embed_author_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_AUTHOR'));
                                modal.addComponents(
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedAuthorNameInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_AUTHOR_NAME')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.author?.name || '').setRequired(false)),
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedAuthorUrlInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_AUTHOR_URL')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.author?.url || '').setRequired(false)),
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedAuthorIconInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_AUTHOR_ICON')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.author?.icon_url || '').setRequired(false))
                                );
                                console.log(`[Embed Builder Debug] Showing modal: embed_author_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_footer':
                                modal = new ModalBuilder().setCustomId('embed_footer_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_FOOTER'));
                                modal.addComponents(
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedFooterTextInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FOOTER_TEXT')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.footer?.text || '').setRequired(false)),
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedFooterIconInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FOOTER_ICON')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.footer?.icon_url || '').setRequired(false))
                                );
                                console.log(`[Embed Builder Debug] Showing modal: embed_footer_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_thumbnail':
                                modal = new ModalBuilder().setCustomId('embed_thumbnail_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_THUMBNAIL'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedThumbnailInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_THUMBNAIL')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.thumbnail?.url || '').setRequired(false)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_thumbnail_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_image':
                                modal = new ModalBuilder().setCustomId('embed_image_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_IMAGE'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedImageInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_IMAGE')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.image?.url || '').setRequired(false)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_image_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'toggle_timestamp':
                                console.log(`[Embed Builder Debug] Toggling timestamp. Current: ${currentEmbedBuilder.data.timestamp}`);
                                if (currentEmbedBuilder.data.timestamp) {
                                    currentEmbedBuilder.setTimestamp(null);
                                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.TIMESTAMP_REMOVED'), flags: [MessageFlags.Ephemeral] });
                                } else {
                                    currentEmbedBuilder.setTimestamp(new Date());
                                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.TIMESTAMP_ADDED'), flags: [MessageFlags.Ephemeral] });
                                }
                                changesMade = true;
                                break;
                            case 'edit_url':
                                modal = new ModalBuilder().setCustomId('embed_url_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_URL'));
                                modal.addComponents(new ActionRowBuilder().addComponents(
                                    new TextInputBuilder().setCustomId('embedUrlInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_URL')).setStyle(TextInputStyle.Short).setValue(currentEmbedBuilder.data.url || '').setRequired(false)
                                ));
                                console.log(`[Embed Builder Debug] Showing modal: embed_url_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'add_field':
                                modal = new ModalBuilder().setCustomId('embed_add_field_modal').setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_ADD_FIELD'));
                                modal.addComponents(
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldTitleInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_TITLE')).setStyle(TextInputStyle.Short).setRequired(true)),
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldValueInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_VALUE')).setStyle(TextInputStyle.Paragraph).setRequired(true)),
                                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldInlineInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_INLINE')).setStyle(TextInputStyle.Short).setValue('false').setRequired(false))
                                );
                                console.log(`[Embed Builder Debug] Showing modal: embed_add_field_modal`);
                                // KEIN deferUpdate() VOR showModal()
                                await interaction.showModal(modal);
                                break;
                            case 'edit_field':
                                console.log(`[Embed Builder Debug] Edit field selected. Current fields: ${currentEmbedBuilder.data.fields?.length}`);
                                if (currentEmbedBuilder.data.fields && currentEmbedBuilder.data.fields.length > 0) {
                                    const fieldSelect = new StringSelectMenuBuilder()
                                        .setCustomId('embed_edit_field_select')
                                        .setPlaceholder(getTranslatedText(lang, 'embed_builder.FIELD_SELECT_EDIT_PLACEHOLDER', { count: currentEmbedBuilder.data.fields.length }))
                                        .addOptions(currentEmbedBuilder.data.fields.map((field, index) => ({
                                            label: field.name.substring(0, 100),
                                            value: `${index}`,
                                            description: field.value.substring(0, 50)
                                        })));
                                    await interaction.followUp({
                                        content: getTranslatedText(lang, 'embed_builder.FIELD_SELECT_EDIT_PROMPT'),
                                        components: [new ActionRowBuilder().addComponents(fieldSelect)],
                                        flags: [MessageFlags.Ephemeral]
                                    });
                                } else {
                                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.NO_FIELDS_TO_EDIT'), flags: [MessageFlags.Ephemeral] });
                                }
                                break;
                            case 'remove_field':
                                console.log(`[Embed Builder Debug] Remove field selected. Current fields: ${currentEmbedBuilder.data.fields?.length}`);
                                if (currentEmbedBuilder.data.fields && currentEmbedBuilder.data.fields.length > 0) {
                                    const fieldSelect = new StringSelectMenuBuilder()
                                        .setCustomId('embed_remove_field_select')
                                        .setPlaceholder(getTranslatedText(lang, 'embed_builder.FIELD_SELECT_REMOVE_PLACEHOLDER', { count: currentEmbedBuilder.data.fields.length }))
                                        .addOptions(currentEmbedBuilder.data.fields.map((field, index) => ({
                                            label: field.name.substring(0, 100),
                                            value: `${index}`,
                                            description: field.value.substring(0, 50)
                                        })));
                                    await interaction.followUp({
                                        content: getTranslatedText(lang, 'embed_builder.FIELD_SELECT_REMOVE_PROMPT'),
                                        components: [new ActionRowBuilder().addComponents(fieldSelect)],
                                        flags: [MessageFlags.Ephemeral]
                                    });
                                } else {
                                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.NO_FIELDS_TO_REMOVE'), flags: [MessageFlags.Ephemeral] });
                                }
                                break;
                            case 'clear_all_fields':
                                currentEmbedBuilder.setFields([]);
                                await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.ALL_FIELDS_CLEARED'), flags: [MessageFlags.Ephemeral] });
                                changesMade = true;
                                console.log(`[Embed Builder Debug] All fields cleared.`);
                                break;
                            default:
                                await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.OPTION_NOT_IMPLEMENTED', { optionName: selectedValue }), flags: [MessageFlags.Ephemeral] });
                                break;
                        }
                        break;
                    case 'embed_edit_field_select': { // Bearbeiten eines spezifischen Feldes nach Auswahl
                        console.log(`[Embed Builder Debug] Selected field for edit: index ${selectedValue}`);
                        if (!editorSession || !currentEmbedData || !currentEmbedBuilder) {
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                            return;
                        }
                        const fieldIndex = parseInt(selectedValue);
                        const fieldToEdit = currentEmbedBuilder.data.fields[fieldIndex];
                        if (fieldToEdit) {
                            const modal = new ModalBuilder().setCustomId(`embed_edit_specific_field_modal_${fieldIndex}`).setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_EDIT_FIELD', { fieldName: fieldToEdit.name.substring(0, 40) }));
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldTitleInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_TITLE')).setStyle(TextInputStyle.Short).setValue(fieldToEdit.name).setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldValueInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_VALUE')).setStyle(TextInputStyle.Paragraph).setValue(fieldToEdit.value).setRequired(true)),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fieldInlineInput').setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_FIELD_INLINE')).setStyle(TextInputStyle.Short).setValue(String(fieldToEdit.inline || false)).setRequired(false))
                            );
                            console.log(`[Embed Builder Debug] Showing modal for specific field edit: ${fieldIndex}`);
                            // KEIN deferUpdate() VOR showModal()
                            await interaction.showModal(modal);
                        } else {
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.FIELD_NOT_FOUND'), flags: [MessageFlags.Ephemeral] });
                        }
                        break;
                    }
                    case 'embed_remove_field_select': { // Entfernen eines spezifischen Feldes nach Auswahl
                        console.log(`[Embed Builder Debug] Selected field for removal: index ${selectedValue}`);
                        if (!editorSession || !currentEmbedData || !currentEmbedBuilder) {
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                            return;
                        }
                        const fieldIndex = parseInt(selectedValue);
                        const fieldToRemove = currentEmbedBuilder.data.fields[fieldIndex];
                        if (fieldToRemove) {
                            currentEmbedBuilder.data.fields.splice(fieldIndex, 1);
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.FIELD_REMOVED_SUCCESS', { fieldName: fieldToRemove.name }), flags: [MessageFlags.Ephemeral] });
                            changesMade = true;
                            console.log(`[Embed Builder Debug] Field removed: ${fieldToRemove.name}`);
                        } else {
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.FIELD_NOT_FOUND'), flags: [MessageFlags.Ephemeral] });
                        }
                        break;
                    }
                }

            } else if (interaction.isButton()) {
                console.log(`[Embed Builder Debug] Button interaction: ${interaction.customId}`);
                // Logik für "Create New Embed" Button (vom Management-Menü)
                if (interaction.customId === 'embed_create_new') {
                    console.log(`[Embed Builder Debug] 'Create New Embed' button clicked.`);
                    // Defer Update here is fine as it's not immediately followed by a modal
                    await interaction.deferUpdate({ flags: [MessageFlags.Ephemeral] }); 
                    console.log(`[Embed Builder Debug] Button deferred (create_new).`);

                    // Verwende den targetChannel aus dem initialen Kontext, falls vorhanden, sonst den aktuellen Kanal.
                    const targetChannelForNewEmbed = initialCommandContext?.targetChannelId || interaction.channel.id;

                    const newEmbedUuid = uuidv4();
                    // Muss hier initialisiert werden, da es ein neuer Embed ist
                    currentEmbedBuilder = new EmbedBuilder() 
                        .setTitle(getTranslatedText(lang, 'embed_builder.DEFAULT_TITLE'))
                        .setDescription(getTranslatedText(lang, 'embed_builder.DEFAULT_DESCRIPTION'))
                        .setColor(0x0099FF);

                    if (!savedEmbeds[userId]) savedEmbeds[userId] = {};
                    savedEmbeds[userId][newEmbedUuid] = {
                        name: `Embed ${Object.keys(savedEmbeds[userId]).length + 1}`,
                        embed: currentEmbedBuilder.toJSON(),
                        lastActivity: Date.now()
                    };
                    saveSavedEmbeds();
                    console.log(`[Embed Builder Debug] New embed saved with UUID: ${newEmbedUuid}`);


                    const newEditorReply = await interaction.followUp({
                        content: getTranslatedText(lang, 'embed_builder.BUILDER_STARTED', {
                            channel: `<#${targetChannelForNewEmbed}>` 
                        }),
                        embeds: [currentEmbedBuilder],
                        components: createBuilderComponents(lang),
                        flags: [MessageFlags.Ephemeral],
                        withResponse: true
                    });
                    console.log(`[Embed Builder Debug] New editor message sent with ID: ${newEditorReply.id}`);


                    if (!activeSessions[userId]) activeSessions[userId] = {};
                    // Speichere die neue Editor-Sitzung, der Schlüssel ist die ID der neuen ephemeren Nachricht.
                    activeSessions[userId][newEditorReply.id] = { 
                        embedUuid: newEmbedUuid,
                        messageId: newEditorReply.id, // Die ID der Editor-Nachricht
                        channelId: interaction.channel.id, 
                        targetChannelId: targetChannelForNewEmbed,
                        lang: lang,
                        lastActivity: Date.now(),
                        // Die initialInteractionId hier ist die des Buttons "Create New Embed"
                        initialInteractionId: interaction.id 
                    };
                    saveActiveSessions();
                    console.log(`[Embed Builder Debug] New editor session stored for messageId: ${newEditorReply.id}`);

                    // Die Aktualisierung der initialen Command-Nachricht wird nun am Ende des Builder-Zyklus behandelt.
                    return; 
                } 
                // Logik für "Edit Specific Embed" Button (vom Management-Menü)
                else if (interaction.customId.startsWith('embed_edit_specific_')) {
                    console.log(`[Embed Builder Debug] 'Edit Specific Embed' button clicked.`);
                    // Defer Update here is fine as it's not immediately followed by a modal
                    await interaction.deferUpdate({ flags: [MessageFlags.Ephemeral] });
                    console.log(`[Embed Builder Debug] Button deferred (edit_specific).`);

                    const embedUuidToEdit = interaction.customId.split('_').pop();
                    const selectedEmbedData = savedEmbeds[userId]?.[embedUuidToEdit];

                    if (selectedEmbedData && typeof selectedEmbedData.embed === 'object') {
                        currentEmbedBuilder = new EmbedBuilder(JSON.parse(JSON.stringify(selectedEmbedData.embed)));
                        if (typeof currentEmbedBuilder.data.description !== 'string') {
                            currentEmbedBuilder.setDescription(currentEmbedBuilder.data.description || '');
                        }

                        const targetChannelForEditor = initialCommandContext?.targetChannelId || interaction.channel.id;

                        const existingEmbedMessageContent = getTranslatedText(lang, 'embed_builder.BUILDER_STARTED', {
                            channel: `<#${targetChannelForEditor}>`
                        });

                        const newEditorReply = await interaction.followUp({
                            content: existingEmbedMessageContent,
                            embeds: [currentEmbedBuilder],
                            components: createBuilderComponents(lang),
                            flags: [MessageFlags.Ephemeral],
                            withResponse: true
                        });
                        console.log(`[Embed Builder Debug] New editor message sent with ID: ${newEditorReply.id}`);


                        if (!activeSessions[userId]) activeSessions[userId] = {};
                        activeSessions[userId][newEditorReply.id] = { 
                            embedUuid: embedUuidToEdit,
                            messageId: newEditorReply.id,
                            channelId: interaction.channel.id,
                            targetChannelId: targetChannelForEditor,
                            lang: lang,
                            lastActivity: Date.now(),
                            initialInteractionId: interaction.id 
                        };
                        saveActiveSessions();
                        console.log(`[Embed Builder Debug] Existing editor session stored for messageId: ${newEditorReply.id}`);
                        
                        selectedEmbedData.lastActivity = Date.now();
                        saveSavedEmbeds();

                        // Die Aktualisierung der initialen Command-Nachricht wird nun am Ende des Builder-Zyklus behandelt.
                        return; 
                    } else {
                        await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.GENERIC_ERROR'), flags: [MessageFlags.Ephemeral] });
                        return;
                    }
                }
                // Logik für "Delete Specific Embed" Button (vom Management-Menü)
                else if (interaction.customId.startsWith('embed_delete_specific_')) {
                    console.log(`[Embed Builder Debug] 'Delete Specific Embed' button clicked.`);
                    const embedUuidToDelete = interaction.customId.split('_').pop();
                    const embedToDeleteData = savedEmbeds[userId]?.[embedUuidToDelete];

                    if (embedToDeleteData) {
                        const modal = new ModalBuilder()
                            .setCustomId(`confirm_delete_embed_modal_${embedUuidToDelete}`)
                            .setTitle(getTranslatedText(lang, 'embed_builder.MODAL_TITLE_CONFIRM_DELETE'));
                        
                        modal.addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('confirmDeleteInput')
                                    .setLabel(getTranslatedText(lang, 'embed_builder.MODAL_LABEL_CONFIRM_DELETE', { embedName: embedToDeleteData.name }))
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder(getTranslatedText(lang, 'embed_builder.CONFIRM_DELETE_INPUT_PLACEHOLDER'))
                                    .setRequired(true)
                            )
                        );
                        console.log(`[Embed Builder Debug] Showing delete confirmation modal.`);
                        // KEIN deferUpdate() VOR showModal()
                        await interaction.showModal(modal);
                        return; 
                    } else {
                        await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.GENERIC_ERROR'), flags: [MessageFlags.Ephemeral] });
                        return;
                    }
                }

                // Logik für allgemeine Buttons (Send, Reset, Cancel) - nur relevant, wenn im EDITOR geklickt
                switch (interaction.customId) {
                    case 'send_embed':
                        console.log(`[Embed Builder Debug] 'Send Embed' button clicked.`);
                        if (!editorSession || !currentEmbedData || !currentEmbedBuilder) {
                            await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                            return;
                        }
                        {
                            const targetChannel = await client.channels.fetch(editorSession.targetChannelId).catch(() => null);
                            if (!targetChannel) {
                                await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.CHANNEL_NOT_FOUND'), flags: [MessageFlags.Ephemeral] });
                                console.log(`[Embed Builder Debug] Target channel not found.`);
                            } else {
                                await targetChannel.send({ embeds: [currentEmbedBuilder] });
                                await interaction.editReply({ content: getTranslatedText(lang, 'embed_builder.EMBED_SENT_SUCCESS', { channelId: targetChannel.id }), embeds: [], components: [] });
                                builderEnded = true; 
                                console.log(`[Embed Builder Debug] Embed sent and builder ended.`);
                            }
                        }
                        break;
                    case 'reset_embed':
                        console.log(`[Embed Builder Debug] 'Reset Embed' button clicked.`);
                        if (!editorSession || !currentEmbedData) {
                            await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                            return;
                        }
                        currentEmbedBuilder = new EmbedBuilder()
                            .setTitle(getTranslatedText(lang, 'embed_builder.DEFAULT_TITLE'))
                            .setDescription(getTranslatedText(lang, 'embed_builder.DEFAULT_DESCRIPTION'))
                            .setColor(0x0099FF);
                        await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.EMBED_RESET'), flags: [MessageFlags.Ephemeral] });
                        changesMade = true;
                        console.log(`[Embed Builder Debug] Embed reset.`);
                        break;
                    case 'cancel_builder':
                        console.log(`[Embed Builder Debug] 'Cancel Builder' button clicked.`);
                        if (!editorSession) {
                            await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                            return;
                        }
                        await interaction.editReply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_CANCELLED'), embeds: [], components: [] });
                        builderEnded = true; 
                        console.log(`[Embed Builder Debug] Builder cancelled.`);
                        break;
                }
            } else if (interaction.isModalSubmit()) {
                console.log(`[Embed Builder Debug] Modal submitted: ${interaction.customId}`);
                if (interaction.customId.startsWith('confirm_delete_embed_modal_')) {
                    console.log(`[Embed Builder Debug] Delete confirmation modal submitted.`);
                    const embedUuidToDelete = interaction.customId.split('_').pop();
                    const confirmationText = interaction.fields.getTextInputValue('confirmDeleteInput');
                    const embedToDeleteData = savedEmbeds[userId]?.[embedUuidToDelete];

                    if (embedToDeleteData && confirmationText.toLowerCase() === 'löschen') {
                        delete savedEmbeds[userId][embedUuidToDelete];
                        if (Object.keys(savedEmbeds[userId]).length === 0) {
                            delete savedEmbeds[userId];
                        }
                        saveSavedEmbeds();
                        console.log(`[Embed Builder Debug] Embed ${embedUuidToDelete} deleted from savedEmbeds.`);


                        // Schließe alle Editor-Sitzungen, die diesen Embed bearbeiten
                        for (const msgId in activeSessions[userId]) {
                            if (activeSessions[userId].hasOwnProperty(msgId) && activeSessions[userId][msgId].embedUuid === embedUuidToDelete) {
                                try {
                                    console.log(`[Embed Builder Debug] Cleaning up active editor session ${msgId} linked to deleted embed.`);
                                    const sessionChannel = await client.channels.fetch(activeSessions[userId][msgId].channelId).catch(() => null);
                                    if (sessionChannel && activeSessions[userId][msgId].messageId) {
                                        const sessionMessage = await sessionChannel.messages.fetch(activeSessions[userId][msgId].messageId).catch(() => null);
                                        if (sessionMessage && sessionMessage.editable) {
                                            await sessionMessage.edit({
                                                    content: getTranslatedText(activeSessions[userId][msgId].lang, 'embed_builder.BUILDER_EXPIRED_DELETED'), // Neue spezifischere Nachricht
                                                    embeds: [],
                                                    components: []
                                                }).catch(() => {});
                                        }
                                    }
                                } catch (e) {
                                    console.error(`[Embed Builder] Fehler beim Aufräumen einer verknüpften Sitzungsnachricht ${msgId}:`, e);
                                }
                                delete activeSessions[userId][msgId];
                            }
                        }
                        saveActiveSessions();
                        console.log(`[Embed Builder Debug] Linked active sessions cleaned up.`);


                        // Bearbeite die ursprüngliche Management-Nachricht, um die Liste zu aktualisieren
                        // Verwende initialCommandContext.messageId, die korrekt gespeichert sein sollte
                        if (initialCommandContext && initialCommandContext.messageId) { 
                            console.log(`[Embed Builder Debug] Attempting to update initial command message (after delete) with ID: ${initialCommandContext.messageId}`);
                            const initialCommandMessage = await client.channels.fetch(initialCommandContext.channelId).then(channel => channel.messages.fetch(initialCommandContext.messageId)).catch((e) => {
                                console.warn(`[Embed Builder Warn] Failed to fetch initial command message ${initialCommandContext.messageId} (after delete, possibly dismissed by user): ${e.message}`);
                                return null;
                            });
                            if (initialCommandMessage && initialCommandMessage.editable) {
                                await initialCommandMessage.edit({ 
                                    content: getTranslatedText(lang, 'embed_builder.MANAGE_EMBEDS_PROMPT'), // Setze den Inhalt wieder auf den ursprünglichen Management-Prompt
                                    components: createInitialManagementComponents(userId, lang), 
                                    embeds: []
                                }).catch(e => console.error("Error updating initial command message after embed deletion:", e));
                                console.log(`[Embed Builder Debug] Initial command message updated (after delete).`);
                            } else {
                                console.warn("[Embed Builder] Initial command message not found or not editable after delete, could not update. This can happen if the original ephemeral message was dismissed or permissions are missing.");
                                // Fallback: Wenn initiale Nachricht nicht aktualisiert werden kann, senden Sie eine Follow-up-Nachricht.
                                if (!interaction.replied && !interaction.deferred) {
                                    await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.EMBED_DELETED_SUCCESS_NO_UI_UPDATE', { embedName: embedToDeleteData.name }), flags: [MessageFlags.Ephemeral] });
                                } else if (interaction.deferred) { // If deferred by the button click
                                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.EMBED_DELETED_SUCCESS_NO_UI_UPDATE', { embedName: embedToDeleteData.name }), flags: [MessageFlags.Ephemeral] });
                                }
                            }
                        } else {
                            console.warn("[Embed Builder] Konnte initialCommandContext oder dessen messageId nicht finden nach dem Löschen eines Embeds. Dies sollte nicht passieren, wenn die initiale Interaktion korrekt war.");
                             // Falls initialCommandContext fehlt, sende eine separate Bestätigung
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.EMBED_DELETED_SUCCESS_NO_UI_UPDATE', { embedName: embedToDeleteData.name }), flags: [MessageFlags.Ephemeral] });
                            } else if (interaction.deferred) {
                                await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.EMBED_DELETED_SUCCESS_NO_UI_UPDATE', { embedName: embedToDeleteData.name }), flags: [MessageFlags.Ephemeral] });
                            }
                        }
                        // WICHTIG: Nach einem Modal-Submit muss immer eine Antwort erfolgen.
                        // Wenn die obige Logik bereits eine Antwort gesendet hat (z.B. wenn initialCommandMessage nicht aktualisiert werden konnte),
                        // dann senden wir hier KEINE weitere Antwort. Andernfalls antworten wir.
                        if (!interaction.replied && !interaction.deferred) {
                             await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.EMBED_DELETED_CONFIRMATION_ONLY', { embedName: embedToDeleteData.name }), flags: [MessageFlags.Ephemeral] });
                        } else {
                            console.log(`[Embed Builder Debug] Interaction already replied/deferred for delete confirmation. No further reply needed from modal handler.`);
                        }
                        return; 
                    } else {
                        console.log(`[Embed Builder Debug] Delete confirmation failed. Expected 'löschen', received: '${confirmationText}'.`);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.DELETE_CONFIRMATION_FAILED'), flags: [MessageFlags.Ephemeral] });
                        } else if (interaction.deferred) { // If deferred by the button click
                            await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.DELETE_CONFIRMATION_FAILED'), flags: [MessageFlags.Ephemeral] });
                        }
                    }
                    return; 
                }

                // Für alle anderen Modals: Prüfe, ob eine Editor-Sitzung aktiv ist und currentEmbedBuilder gesetzt ist
                // (currentEmbedBuilder kann null sein, wenn es sich um eine Interaktion handelt, die keinen Embed bearbeitet, z.B. das Löschen)
                if (!editorSession || !currentEmbedData || currentEmbedBuilder === null) {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                    } else if (interaction.deferred) {
                        await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.BUILDER_NOT_ACTIVE'), flags: [MessageFlags.Ephemeral] }).catch(() => {});
                    }
                    return;
                }
                let modalChangesMade = false;
                let modalErrorOccurred = false;
                let modalErrorMessage = '';

                switch (interaction.customId) {
                    case 'embed_title_modal':
                        currentEmbedBuilder.setTitle(interaction.fields.getTextInputValue('embedTitleInput') || null);
                        modalChangesMade = true;
                        break;
                    case 'embed_description_modal':
                        currentEmbedBuilder.setDescription(interaction.fields.getTextInputValue('embedDescriptionInput') || null);
                        modalChangesMade = true;
                        break;
                    case 'embed_color_modal':
                        const colorInput = interaction.fields.getTextInputValue('embedColorInput').replace('#', '');
                        const newColor = parseInt(colorInput, 16);
                        if (!isNaN(newColor) && colorInput.length === 6) {
                            currentEmbedBuilder.setColor(newColor);
                            modalChangesMade = true;
                        } else {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_COLOR');
                        }
                        break;
                    case 'embed_thumbnail_modal':
                        const thumbUrl = interaction.fields.getTextInputValue('embedThumbnailInput');
                        if (!isValidUrl(thumbUrl)) {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_URL');
                        } else {
                            currentEmbedBuilder.setThumbnail(thumbUrl || null);
                            modalChangesMade = true;
                        }
                        break;
                    case 'embed_image_modal':
                        const imageUrl = interaction.fields.getTextInputValue('embedImageInput');
                        if (!isValidUrl(imageUrl)) {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_URL');
                        } else {
                            currentEmbedBuilder.setImage(imageUrl || null);
                            modalChangesMade = true;
                        }
                        break;
                    case 'embed_url_modal':
                        const titleUrl = interaction.fields.getTextInputValue('embedUrlInput');
                        if (!isValidUrl(titleUrl)) {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_URL');
                        } else {
                            currentEmbedBuilder.setURL(titleUrl || null);
                            modalChangesMade = true;
                        }
                        break;
                    case 'embed_author_modal':
                        const authorName = interaction.fields.getTextInputValue('embedAuthorNameInput');
                        const authorUrl = interaction.fields.getTextInputValue('embedAuthorUrlInput');
                        const authorIcon = interaction.fields.getTextInputValue('embedAuthorIconInput');

                        if (!isValidUrl(authorUrl) || !isValidUrl(authorIcon)) {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_URL');
                        } else {
                            if (authorName) {
                                currentEmbedBuilder.setAuthor({
                                    name: authorName,
                                    url: authorUrl || undefined,
                                    iconURL: authorIcon || undefined
                                });
                            } else {
                                currentEmbedBuilder.setAuthor(null);
                            }
                            modalChangesMade = true;
                        }
                        break;
                    case 'embed_footer_modal':
                        const footerText = interaction.fields.getTextInputValue('embedFooterTextInput');
                        const footerIcon = interaction.fields.getTextInputValue('embedFooterIconInput');

                        if (!isValidUrl(footerIcon)) {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.INVALID_URL');
                        } else {
                            if (footerText) {
                                currentEmbedBuilder.setFooter({
                                    text: footerText,
                                    iconURL: footerIcon || undefined
                                });
                            } else {
                                currentEmbedBuilder.setFooter(null);
                            }
                            modalChangesMade = true;
                        }
                        break;
                    case 'embed_add_field_modal':
                        const fieldTitle = interaction.fields.getTextInputValue('fieldTitleInput');
                        const fieldValue = interaction.fields.getTextInputValue('fieldValueInput');
                        const fieldInline = interaction.fields.getTextInputValue('fieldInlineInput').toLowerCase() === 'true';

                        if (fieldTitle && fieldValue) {
                            currentEmbedBuilder.addFields({ name: fieldTitle, value: fieldValue, inline: fieldInline });
                            modalChangesMade = true;
                        } else {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.FIELD_TITLE_VALUE_EMPTY');
                        }
                        break;
                    default:
                        if (interaction.customId.startsWith('embed_edit_specific_field_modal_')) {
                            const fieldIndex = parseInt(interaction.customId.split('_').pop());
                            const newFieldTitle = interaction.fields.getTextInputValue('fieldTitleInput');
                            const newFieldValue = interaction.fields.getTextInputValue('fieldValueInput');
                            const newFieldInline = interaction.fields.getTextInputValue('fieldInlineInput').toLowerCase() === 'true';

                            if (currentEmbedBuilder.data.fields && currentEmbedBuilder.data.fields[fieldIndex]) {
                                currentEmbedBuilder.data.fields[fieldIndex] = {
                                    name: newFieldTitle,
                                    value: newFieldValue,
                                    inline: newFieldInline
                                };
                                modalChangesMade = true;
                            } else {
                                modalErrorOccurred = true;
                                modalErrorMessage = getTranslatedText(lang, 'embed_builder.FIELD_EDIT_NOT_FOUND_ERROR');
                            }
                        } else {
                            modalErrorOccurred = true;
                            modalErrorMessage = getTranslatedText(lang, 'embed_builder.GENERIC_ERROR');
                        }
                        break;
                }
                
                // Nach Modal-Submit: Wir müssen antworten.
                if (!interaction.replied && !interaction.deferred) {
                    if (modalErrorOccurred) {
                        console.log(`[Embed Builder Debug] Modal error. Replying with error message.`);
                        await interaction.reply({ content: modalErrorMessage, flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error replying to modal submit (error): ${e.message}`);
                        });
                    } else if (modalChangesMade) {
                        console.log(`[Embed Builder Debug] Modal changes made. Replying with confirmation.`);
                        await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.EMBED_UPDATED'), flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error replying to modal submit (success): ${e.message}`);
                        });
                        changesMade = true; // Markiere, dass Änderungen gemacht wurden, damit die Hauptnachricht aktualisiert wird
                    } else {
                        console.log(`[Embed Builder Debug] No modal changes made. Replying with no changes confirmation.`);
                        await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.NO_CHANGES_MADE'), flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error replying to modal submit (no changes): ${e.message}`);
                        });
                    }
                } else {
                    // Dies sollte nicht passieren, wenn showModal korrekt verwendet wird, da showModal die Interaktion abschließt.
                    // Aber falls doch, loggen wir es.
                    console.warn(`[Embed Builder Warn] Modal submit was already replied/deferred. This is unexpected.`);
                    if (modalErrorOccurred) {
                        await interaction.followUp({ content: modalErrorMessage, flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error following up on modal submit (error, already replied/deferred): ${e.message}`);
                        });
                    } else if (modalChangesMade) {
                        await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.EMBED_UPDATED'), flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error following up on modal submit (success, already replied/deferred): ${e.message}`);
                        });
                        changesMade = true;
                    } else {
                        await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.NO_CHANGES_MADE'), flags: [MessageFlags.Ephemeral] }).catch(e => {
                            console.error(`[Embed Builder] Error following up on modal submit (no changes, already replied/deferred): ${e.message}`);
                        });
                    }
                }
            }

            // Wenn der Builder beendet wurde (Send, Cancel), lösche die Editor-Sitzung
            if (builderEnded && editorSession) {
                console.log(`[Embed Builder Debug] Builder ended. Cleaning up editor session for ${editorSession.messageId}.`);
                if (activeSessions[userId] && activeSessions[userId][editorSession.messageId]) {
                    delete activeSessions[userId][editorSession.messageId]; 
                    if (Object.keys(activeSessions[userId]).length === 0) {
                        delete activeSessions[userId];
                    }
                }
                
                // Finde die ID der InitialCommandContext Nachricht, um sie zu aktualisieren.
                if (initialCommandContext && initialCommandContext.messageId) { 
                    try {
                        console.log(`[Embed Builder Debug] Attempting to update initial command message (after builder end) with ID: ${initialCommandContext.messageId}`);
                        const initialCommandMessage = await client.channels.fetch(initialCommandContext.channelId).then(channel => channel.messages.fetch(initialCommandContext.messageId)).catch((e) => {
                            // Erwarteter Fehler, wenn ephemere Nachricht geschlossen wurde.
                            console.warn(`[Embed Builder Warn] Failed to fetch initial command message ${initialCommandContext.messageId} (after builder end, possibly dismissed by user): ${e.message}`);
                            return null;
                        });
                        if (initialCommandMessage && initialCommandMessage.editable) {
                            await initialCommandMessage.edit({
                                content: getTranslatedText(lang, 'embed_builder.MANAGE_EMBEDS_PROMPT'), // Setze den Inhalt wieder auf den ursprünglichen Management-Prompt
                                components: createInitialManagementComponents(userId, lang),
                                embeds: []
                            }).catch(e => console.error("Fehler beim Aktualisieren der initialen Command-Nachricht nach Editor-Ende:", e));
                            console.log(`[Embed Builder Debug] Initial command message updated (after builder end).`);
                        } else {
                            console.warn("[Embed Builder] Initial command message not found or not editable after builder end, could not update. This can happen if the original ephemeral message was dismissed or permissions are missing.");
                        }
                    } catch (e) {
                        console.error("Fehler beim Abrufen/Aktualisieren der initialen Command-Nachricht nach Editor-Ende:", e);
                    }
                }
            }
            
            // Speichere Änderungen und aktualisiere die Editor-Nachricht, wenn es sich um den Editor handelt
            // Diese Prüfung stellt sicher, dass wir nur die EDITOR-Nachricht aktualisieren, NICHT die initiale Management-Nachricht
            // Die Aktualisierung der Editor-Nachricht sollte nur erfolgen, wenn es tatsächlich eine Editor-Sitzung gibt
            // und Änderungen gemacht wurden UND currentEmbedBuilder existiert (nicht null ist).
            if (changesMade && editorSession && currentEmbedData && currentEmbedBuilder) { 
                
                currentEmbedData.embed = currentEmbedBuilder.toJSON();
                saveSavedEmbeds(); // Speichere Änderungen am Embed selbst
                console.log(`[Embed Builder Debug] Changes made and saved for embed UUID: ${editorSession.embedUuid}`);

                // Bearbeite die Editor-Nachricht, die die Interaktion ausgelöst hat
                // Dies sollte die Nachricht sein, deren ID in editorSession.messageId gespeichert ist.
                try {
                    const editorChannel = await client.channels.fetch(editorSession.channelId).catch(() => null);
                    if (editorChannel && editorSession.messageId) {
                        const editorMessage = await editorChannel.messages.fetch(editorSession.messageId).catch(() => null);
                        if (editorMessage && editorMessage.editable) {
                            console.log(`[Embed Builder Debug] Editing editor message (ID: ${editorMessage.id}) after changes.`);
                            await editorMessage.edit({
                                embeds: [currentEmbedBuilder],
                                components: createBuilderComponents(lang),
                            }).catch(e => console.error(`[Embed Builder] Fehler beim Bearbeiten der Editor-Nachricht ${editorMessage.id}:`, e));
                        } else {
                            console.warn(`[Embed Builder] Editor message ${editorSession.messageId} not found or not editable for update.`);
                        }
                    }
                } catch (e) {
                    console.error(`[Embed Builder] Fehler beim Abrufen/Bearbeiten der Editor-Nachricht:`, e);
                }
            }

        } catch (error) {
            console.error('[Embed Builder] Ein Fehler ist im Interaktions-Handler aufgetreten:', error);
            try {
                // Versuche, eine Antwort nur zu senden, wenn noch keine Antwort gesendet oder defered wurde
                if (!interaction.replied && !interaction.deferred) {
                    console.log(`[Embed Builder Debug] Replying with generic error (not replied/deferred).`);
                    await interaction.reply({ content: getTranslatedText(lang, 'embed_builder.GENERIC_ERROR'), flags: [MessageFlags.Ephemeral] });
                } else {
                    // Wenn bereits geantwortet/defered, sende eine Follow-up-Nachricht
                    console.log(`[Embed Builder Debug] Following up with generic error (already replied/deferred).`);
                    await interaction.followUp({ content: getTranslatedText(lang, 'embed_builder.GENERIC_ERROR'), flags: [MessageFlags.Ephemeral] });
                }
            } catch (e) {
                console.error('[Embed Builder] Fehler beim Senden der Fehlermeldung:', e);
            }
        } finally {
            saveActiveSessions();
            console.log(`[Embed Builder Debug] handleInteraction finished. Active sessions saved.`);
        }
    },

    cleanupExpiredSessions
};
