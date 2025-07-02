// utils/jtcUtils.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'data', 'jtcConfig.json'); // Pfad zur JTC-Konfigurationsdatei
let jtcConfigs = {}; // In-Memory-Speicher für die Konfigurationen

/**
 * Lädt die JTC-Konfigurationen aus der Datei.
 */
function loadJTCConfig() {
    console.log(`[JTC Config] Attempting to load JTC config from: ${configPath}`);
    // SICHERSTELLEN, dass das Verzeichnis existiert, bevor wir versuchen zu lesen/schreiben
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[JTC Config] Created directory: ${dir}`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error creating directory ${dir}:`, e);
            // Wenn das Verzeichnis nicht erstellt werden kann, können wir die Datei auch nicht speichern.
            // Der Bot sollte hier aber nicht abstürzen, nur warnen.
        }
    }

    if (fs.existsSync(configPath)) {
        try {
            jtcConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`[JTC Config] Loaded JTC configuration.`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error loading or parsing jtcConfig.json:`, e);
            jtcConfigs = {}; // Setze auf leeres Objekt bei Fehler
        }
    } else {
        console.warn(`[JTC Config] jtcConfig.json not found at ${configPath}. Starting with empty JTC config.`);
        jtcConfigs = {};
        // Optional: Leere Datei direkt erstellen, um weitere "not found" Warnungen zu vermeiden
        try {
            fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf8');
            console.log(`[JTC Config] Created empty jtcConfig.json.`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error creating empty jtcConfig.json:`, e);
        }
    }
}

/**
 * Speichert die aktuelle JTC-Konfiguration in die Datei.
 */
function saveJTCConfig() {
    try {
        // Das Verzeichnis sollte bereits von loadJTCConfig() erstellt worden sein,
        // aber ein doppelter Check ist nicht schädlich. Besser noch, die Erstellung in loadJTCConfig() zentralisieren.
        // const dir = path.dirname(configPath);
        // if (!fs.existsSync(dir)) {
        //     fs.mkdirSync(dir, { recursive: true }); // Diesen Aufruf in loadJTCConfig() verlagern
        // }
        fs.writeFileSync(configPath, JSON.stringify(jtcConfigs, null, 2), 'utf8');
        console.log(`[JTC Config] Saved JTC configuration.`);
    } catch (e) {
        console.error(`[JTC Config ERROR] Error saving jtcConfig.json:`, e);
    }
}

/**
 * Ruft die JTC-Konfiguration für eine bestimmte Gilde ab.
 * @param {string} guildId Die ID der Gilde.
 * @returns {object|null} Die Konfiguration der Gilde oder null, wenn nicht gefunden.
 */
function getJTCConfigForGuild(guildId) {
    return jtcConfigs[guildId] || null;
}

/**
 * Setzt oder aktualisiert die JTC-Konfiguration für eine Gilde.
 * @param {string} guildId Die ID der Gilde.
 * @param {string} channelId Die ID des JTC-Kanals.
 * @param {string|null} categoryId Die ID der Kategorie oder null.
 */
function setJTCConfigForGuild(guildId, channelId, categoryId) {
    jtcConfigs[guildId] = { channelId, categoryId };
    saveJTCConfig();
    console.log(`[JTC Config] Set config for guild ${guildId}: Channel ${channelId}, Category ${categoryId}`);
}

/**
 * Entfernt die JTC-Konfiguration für eine Gilde.
 * @param {string} guildId Die ID der Gilde.
 */
function deleteJTCConfigForGuild(guildId) {
    if (jtcConfigs[guildId]) {
        delete jtcConfigs[guildId];
        saveJTCConfig();
        console.log(`[JTC Config] Deleted config for guild ${guildId}.`);
        return true;
    }
    return false;
}

// Lade Konfiguration beim Modul-Import
loadJTCConfig();

module.exports = {
    loadJTCConfig,
    getJTCConfigForGuild,
    setJTCConfigForGuild,
    deleteJTCConfigForGuild,
    jtcConfigs // Exportiert für direkten Zugriff, falls erforderlich (siehe Anmerkungen oben)
};