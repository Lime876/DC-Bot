// utils/config.js
const fs = require('fs');
const path = require('path');

// Pfad zur Log-Kanal-Konfigurationsdatei
const logChannelsPath = path.join(__dirname, '../data/logChannels.json');

// Cache für Log-Kanäle
let logChannelsCache = {};

/**
 * Lädt die Log-Kanal-Konfiguration aus der Datei.
 * Diese Funktion wird beim Bot-Start aufgerufen.
 */
const loadLogChannels = () => {
    if (fs.existsSync(logChannelsPath)) {
        try {
            const data = fs.readFileSync(logChannelsPath, 'utf8');
            logChannelsCache = JSON.parse(data);
            console.log('[Config] Log-Kanal-Konfiguration geladen.');
        } catch (e) {
            console.error('[Config] Fehler beim Parsen der Log-Kanal-Konfiguration:', e);
            logChannelsCache = {};
        }
    } else {
        // Erstelle die Datei und das Verzeichnis, falls sie nicht existieren
        try {
            const dir = path.dirname(logChannelsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(logChannelsPath, JSON.stringify({}), 'utf8');
            console.log('[Config] Leere Log-Kanal-Konfigurationsdatei erstellt.');
        } catch (e) {
            console.error('[Config] Fehler beim Erstellen der Log-Kanal-Konfigurationsdatei:', e);
        }
    }
};

/**
 * Speichert die Log-Kanal-Konfiguration in der Datei.
 */
const saveLogChannels = () => {
    try {
        fs.writeFileSync(logChannelsPath, JSON.stringify(logChannelsCache, null, 4), 'utf8');
        console.log('[Config] Log-Kanal-Konfiguration gespeichert.');
    } catch (e) {
        console.error('[Config] Fehler beim Speichern der Log-Kanal-Konfiguration:', e);
    }
};

/**
 * Ruft die ID des konfigurierten Log-Kanals für eine bestimmte Gilde und einen Log-Typ ab.
 * @param {string} guildId - Die ID der Gilde.
 * @param {string} logType - Der Typ des Logs (z.B. 'message_delete', 'member_join').
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
    } else {
        delete logChannelsCache[guildId][logType];
        if (Object.keys(logChannelsCache[guildId]).length === 0) {
            delete logChannelsCache[guildId];
        }
    }
    saveLogChannels(); // Speichere Änderungen sofort
};

// Lade die Log-Kanal-Konfiguration beim Bot-Start
loadLogChannels();

module.exports = {
    // Exportiere hier auch alle anderen Konfigurationsfunktionen oder -variablen, die du hast
    getLogChannelId,
    setLogChannelId,
};