// events/messageReactionAdd.js
import { Events, EmbedBuilder } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../utils/logger.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import { fileURLToPath } from 'node:url'; // Import für __dirname

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfad zur Konfigurationsdatei für Reaction Roles
const CONFIG_PATH = path.resolve(__dirname, '../data/reactionRoles.json');
let config = new Map();

/**
 * Lädt die Konfiguration aus der Datei.
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        config = new Map(Object.entries(JSON.parse(data)));
        logger.info('[ReactionRoles] Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[ReactionRoles] Config nicht gefunden, erstelle leere.');
            config = new Map();
            await saveConfig();
        } else {
            logger.error('[ReactionRoles] Fehler beim Laden der Config:', error);
            config = new Map();
        }
    }
}

/**
 * Speichert die Konfiguration in der Datei.
 * @param {Map<string, object>} newConfig - Die zu speichernde Konfiguration.
 * @returns {Promise<void>}
 */
async function saveConfig(newConfig = config) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(Object.fromEntries(newConfig), null, 2), 'utf8');
        logger.info('[ReactionRoles] Konfiguration gespeichert.');
    } catch (e) {
        logger.error('[ReactionRoles] Fehler beim Speichern der Config:', e);
    }
}

// Lade die Konfiguration beim Modulstart
await loadConfig();

export default {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        // Ignoriere Reaktionen von Bots
        if (user.bot) return;

        const { message, emoji } = reaction;
        const guild = message.guild;
        if (!guild) return;

        const lang = await getGuildLanguage(guild.id);
        const guildConfig = config.get(guild.id);

        if (!guildConfig || !guildConfig.channels) return;

        // Überprüfen, ob der Kanal und die Nachricht konfiguriert sind
        const channelConfig = guildConfig.channels.find(c => c.channelId === message.channel.id);
        if (!channelConfig) return;

        const messageConfig = channelConfig.messages.find(m => m.messageId === message.id);
        if (!messageConfig) return;

        // Finde die Rolle, die dem Emoji zugeordnet ist
        const roleConfig = messageConfig.roles.find(r => r.emoji === emoji.name);
        if (!roleConfig) return;

        const member = await guild.members.fetch(user.id).catch(err => {
            logger.error(`[ReactionRoles] Fehler beim Abrufen des Mitglieds ${user.id}:`, err);
        });

        if (!member) return;

        // Füge die Rolle hinzu
        try {
            const role = guild.roles.cache.get(roleConfig.roleId);
            if (role) {
                await member.roles.add(role);
                logger.info(`[ReactionRoles] Rolle ${role.name} (${role.id}) wurde Mitglied ${user.tag} in Gilde ${guild.name} hinzugefügt.`);
            }
        } catch (error) {
            logger.error(`[ReactionRoles] Fehler beim Hinzufügen der Rolle ${roleConfig.roleId} zu Mitglied ${user.tag}:`, error);
        }
    }
};
