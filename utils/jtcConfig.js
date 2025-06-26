const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'data', 'jtcConfig.json'); // Pfad zur JTC-Konfigurationsdatei
let jtcConfigs = {}; // In-Memory-Speicher für die Konfigurationen

/**
 * Lädt die JTC-Konfigurationen aus der Datei.
 */
function loadJTCConfig() {
    console.log(`[JTC Config] Attempting to load JTC config from: ${configPath}`);
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
    }
}

/**
 * Speichert die aktuelle JTC-Konfiguration in die Datei.
 */
function saveJTCConfig() {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
    loadJTCConfig, // Exponiere, falls du es manuell neu laden möchtest
    getJTCConfigForGuild,
    setJTCConfigForGuild,
    deleteJTCConfigForGuild,
    // (Optional) Wenn getJTCConfig() im voiceStateUpdate verwendet wird, muss es umbenannt werden
    // oder eine separate Funktion dafür erstellt werden, die jtcConfigs direkt zurückgibt.
    // Aber es ist besser, getJTCConfigForGuild(guild.id) zu verwenden.
    jtcConfigs // Exponiere für voiceStateUpdate, um alle Konfigurationen zu erhalten
};