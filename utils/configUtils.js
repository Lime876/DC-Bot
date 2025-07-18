// utils/configUtils.js
const fs = require('node:fs/promises');
const path = require('node:path');
const logger = require('./logger'); // Importiere den neuen Logger

const GUILD_CONFIGS_PATH = path.join(__dirname, '..', 'data', 'guildConfigs.json');

// In-memory Cache für Gilden-Konfigurationen
let guildConfigsCache = {};

/**
 * Lädt alle Gilden-Konfigurationen aus der Datei.
 * @returns {Promise<object>} Ein Objekt mit Gilden-Konfigurationen.
 */
async function loadGuildConfigs() {
    try {
        const data = await fs.readFile(GUILD_CONFIGS_PATH, 'utf8');
        guildConfigsCache = JSON.parse(data);
        logger.info('[ConfigUtils] Gilden-Konfigurationen geladen.');
        return guildConfigsCache;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[ConfigUtils] guildConfigs.json nicht gefunden, erstelle leere Konfiguration.');
            guildConfigsCache = {}; // Starte mit leerem Objekt, wenn Datei nicht existiert
            await saveGuildConfigs(guildConfigsCache); // Speichere leere Konfiguration
            return guildConfigsCache;
        }
        logger.error('[ConfigUtils] Fehler beim Laden der Gilden-Konfigurationen:', error);
        return {};
    }
}

/**
 * Speichert die aktuellen Gilden-Konfigurationen in die Datei.
 * @param {object} configs - Das Objekt mit den Gilden-Konfigurationen.
 * @returns {Promise<void>}
 */
async function saveGuildConfigs(configs) {
    try {
        await fs.writeFile(GUILD_CONFIGS_PATH, JSON.stringify(configs, null, 2), 'utf8');
        guildConfigsCache = configs; // Aktualisiere den Cache
        logger.info('[ConfigUtils] Gilden-Konfigurationen gespeichert.');
    } catch (error) {
        logger.error('[ConfigUtils] Fehler beim Speichern der Gilden-Konfigurationen:', error);
    }
}

/**
 * Holt die Konfiguration für eine spezifische Gilde.
 * Lädt die Konfigurationen bei Bedarf.
 * @param {string} guildId - Die ID der Gilde.
 * @returns {Promise<object>} Die Konfiguration der Gilde oder ein leeres Objekt, wenn nicht gefunden.
 */
async function getGuildConfig(guildId) {
    if (Object.keys(guildConfigsCache).length === 0) {
        await loadGuildConfigs(); // Lade, falls Cache leer ist
    }
    return guildConfigsCache[guildId] || {};
}

/**
 * Aktualisiert die Konfiguration für eine spezifische Gilde und speichert sie.
 * @param {string} guildId - Die ID der Gilde.
 * @param {object} newConfig - Das Objekt mit den zu aktualisierenden Konfigurationsdaten.
 * @returns {Promise<void>}
 */
async function updateGuildConfig(guildId, newConfig) {
    if (Object.keys(guildConfigsCache).length === 0) {
        await loadGuildConfigs(); // Lade, falls Cache leer ist
    }
    guildConfigsCache[guildId] = { ...guildConfigsCache[guildId], ...newConfig };
    await saveGuildConfigs(guildConfigsCache);
}

// Lade Konfigurationen beim Start des Moduls
loadGuildConfigs();

module.exports = {
    loadGuildConfigs,
    saveGuildConfigs,
    getGuildConfig,
    updateGuildConfig
};
