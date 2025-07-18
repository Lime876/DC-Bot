// utils/config.js
const fs = require('node:fs'); // Verwende 'node:fs' für Klarheit
const path = require('node:path'); // Verwende 'node:path' für Klarheit
const logger = require('./logger'); // Importiere den Logger

// Pfad zur Log-Kanal-Konfigurationsdatei
const logChannelsPath = path.join(__dirname, '../data/logChannels.json');

// Cache für Log-Kanäle
let logChannelsCache = {};

/**
 * Lädt die Log-Kanal-Konfiguration aus der Datei.
 * Diese Funktion wird beim Bot-Start aufgerufen.
 */
const loadLogChannels = () => {
    logger.debug(`[Config] Versuche, Log-Kanal-Konfiguration von ${logChannelsPath} zu laden.`);
    if (fs.existsSync(logChannelsPath)) {
        try {
            const data = fs.readFileSync(logChannelsPath, 'utf8');
            logChannelsCache = JSON.parse(data);
            logger.info('[Config] Log-Kanal-Konfiguration geladen.');
        } catch (e) {
            logger.error('[Config] Fehler beim Parsen der Log-Kanal-Konfiguration:', e);
            logChannelsCache = {}; // Setze Cache zurück bei Fehler
        }
    } else {
        // Erstelle die Datei und das Verzeichnis, falls sie nicht existieren
        try {
            const dir = path.dirname(logChannelsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.debug(`[Config] Verzeichnis ${dir} erstellt.`);
            }
            fs.writeFileSync(logChannelsPath, JSON.stringify({}, null, 4), 'utf8');
            logger.warn('[Config] logChannels.json nicht gefunden. Leere Log-Kanal-Konfigurationsdatei erstellt.');
        } catch (e) {
            logger.error('[Config] Fehler beim Erstellen der Log-Kanal-Konfigurationsdatei:', e);
        }
    }
};

/**
 * Speichert die Log-Kanal-Konfiguration in der Datei.
 */
const saveLogChannels = () => {
    try {
        fs.writeFileSync(logChannelsPath, JSON.stringify(logChannelsCache, null, 4), 'utf8');
        logger.debug('[Config] Log-Kanal-Konfiguration gespeichert.');
    } catch (e) {
        logger.error('[Config] Fehler beim Speichern der Log-Kanal-Konfiguration:', e);
    }
};

/**
 * Ruft die ID des konfigurierten Log-Kanals für eine bestimmte Gilde und einen Log-Typ ab.
 * @param {string} guildId - Die ID der Gilde.
 * @param {string} logType - Der Typ des Logs (z.B. 'message_delete', 'member_update').
 * @returns {string|null} Die Kanal-ID oder null, wenn nicht gefunden.
 */
const getLogChannelId = (guildId, logType) => {
    return logChannelsCache[guildId]?.[logType] || null;
};

/**
 * Setzt die ID des Log-Kanals für eine bestimmte Gilde und einen Log-Typ.
 * @param {string} guildId - Die ID der Gilde.
 * @param {string} logType - Der Typ des Logs (z.B. 'message_delete').
 * @param {string|null} channelId - Die ID des Kanals, der gesetzt werden soll, oder null zum Entfernen.
 */
const setLogChannelId = (guildId, logType, channelId) => {
    if (!logChannelsCache[guildId]) {
        logChannelsCache[guildId] = {};
    }

    if (channelId) {
        logChannelsCache[guildId][logType] = channelId;
        logger.info(`[Config] Log-Kanal für '${logType}' in Gilde ${guildId} auf ${channelId} gesetzt.`);
    } else {
        delete logChannelsCache[guildId][logType];
        if (Object.keys(logChannelsCache[guildId]).length === 0) {
            delete logChannelsCache[guildId];
        }
        logger.info(`[Config] Log-Kanal für '${logType}' in Gilde ${guildId} entfernt.`);
    }
    saveLogChannels(); // Speichere Änderungen sofort
};

// Lade die Log-Kanal-Konfiguration beim Bot-Start
loadLogChannels();

module.exports = {
    getLogChannelId,
    setLogChannelId,
    // Du kannst hier auch loadLogChannels exportieren, falls es an anderer Stelle manuell neu geladen werden muss
    // loadLogChannels, 
};