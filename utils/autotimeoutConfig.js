// utils/autotimeoutConfig.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/autotimeoutConfig.json');

/**
 * Lädt die automatische Timeout-Konfiguration aus der Datei.
 * @returns {object} Die Konfiguration oder ein leeres Objekt.
 */
const loadAutotimeoutConfig = () => {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[Autotimeout Config] Fehler beim Parsen von ${configPath}:`, e);
            return {};
        }
    }
    return {};
};

/**
 * Speichert die automatische Timeout-Konfiguration in der Datei.
 * @param {object} config - Die zu speichernde Konfiguration.
 */
const saveAutotimeoutConfig = (config) => {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(`[Autotimeout Config] Fehler beim Schreiben in ${configPath}:`, e);
    }
};

// Standardkonfiguration für eine neue Gilde
const getDefaultAutotimeoutConfig = () => ({
    enabled: false,
    durationMs: 600000, // 10 Minuten Standard-Timeout-Dauer
    violationsThreshold: 3, // 3 Verstöße vor Timeout
    moderationLogChannelId: null // Kann den Spam-Log-Kanal wiederverwenden oder einen dedizierten haben
});

/**
 * Ruft die automatische Timeout-Konfiguration für eine bestimmte Gilde ab,
 * initialisiert diese mit Standardwerten, falls nicht vorhanden.
 * @param {string} guildId - Die ID der Gilde.
 * @returns {object} Die automatische Timeout-Konfiguration der Gilde.
 */
const getGuildAutotimeoutConfig = (guildId) => {
    let configs = loadAutotimeoutConfig();
    if (!configs[guildId]) {
        configs[guildId] = getDefaultAutotimeoutConfig();
        saveAutotimeoutConfig(configs);
    } else {
        // Sicherstellen, dass alle Standardeigenschaften in bestehenden Konfigurationen vorhanden sind
        configs[guildId] = { ...getDefaultAutotimeoutConfig(), ...configs[guildId] };
        saveAutotimeoutConfig(configs);
    }
    return configs[guildId];
};

/**
 * Setzt die automatische Timeout-Konfiguration für eine bestimmte Gilde.
 * @param {string} guildId - Die ID der Gilde.
 * @param {object} newConfig - Das neue Konfigurationsobjekt (teilweise oder vollständig).
 */
const setGuildAutotimeoutConfig = (guildId, newConfig) => {
    let configs = loadAutotimeoutConfig();
    configs[guildId] = { ...getGuildAutotimeoutConfig(guildId), ...newConfig }; // Mit bestehenden Werten zusammenführen
    saveAutotimeoutConfig(configs);
};

module.exports = {
    loadAutotimeoutConfig,
    saveAutotimeoutConfig,
    getGuildAutotimeoutConfig,
    setGuildAutotimeoutConfig
};
