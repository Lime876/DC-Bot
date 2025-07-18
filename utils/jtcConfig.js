const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'data', 'jtcConfig.json');
let jtcConfigs = {};

/**
 * Lädt die JTC-Konfigurationen aus der Datei (async).
 */
async function loadJTCConfig() {
    console.log(`[JTC Config] Attempting to load JTC config from: ${configPath}`);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        try {
            await fs.promises.mkdir(dir, { recursive: true });
            console.log(`[JTC Config] Created directory: ${dir}`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error creating directory ${dir}:`, e);
        }
    }

    if (fs.existsSync(configPath)) {
        try {
            const data = await fs.promises.readFile(configPath, 'utf8');
            jtcConfigs = JSON.parse(data);
            console.log(`[JTC Config] Loaded JTC configuration.`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error loading or parsing jtcConfig.json:`, e);
            // Backup der defekten Datei erstellen
            const backupPath = configPath + '.bak-' + Date.now();
            try {
                await fs.promises.rename(configPath, backupPath);
                console.log(`[JTC Config] Backup der defekten Config erstellt: ${backupPath}`);
            } catch (backupErr) {
                console.error(`[JTC Config ERROR] Backup der defekten Config fehlgeschlagen:`, backupErr);
            }
            jtcConfigs = {};
        }
    } else {
        console.warn(`[JTC Config] jtcConfig.json not found at ${configPath}. Starting with empty JTC config.`);
        jtcConfigs = {};
        try {
            await fs.promises.writeFile(configPath, JSON.stringify({}, null, 2), 'utf8');
            console.log(`[JTC Config] Created empty jtcConfig.json.`);
        } catch (e) {
            console.error(`[JTC Config ERROR] Error creating empty jtcConfig.json:`, e);
        }
    }
}

/**
 * Speichert die aktuelle JTC-Konfiguration in die Datei (async).
 */
async function saveJTCConfig() {
    try {
        await fs.promises.writeFile(configPath, JSON.stringify(jtcConfigs, null, 2), 'utf8');
        console.log(`[JTC Config] Saved JTC configuration.`);
    } catch (e) {
        console.error(`[JTC Config ERROR] Error saving jtcConfig.json:`, e);
        // Optional: Backup schreiben oder Alarm werfen
    }
}

function getJTCConfigForGuild(guildId) {
    return jtcConfigs[guildId] || null;
}

async function setJTCConfigForGuild(guildId, channelId, categoryId) {
    jtcConfigs[guildId] = { channelId, categoryId };
    await saveJTCConfig();
    console.log(`[JTC Config] Set config for guild ${guildId}: Channel ${channelId}, Category ${categoryId}`);
}

async function deleteJTCConfigForGuild(guildId) {
    if (jtcConfigs[guildId]) {
        delete jtcConfigs[guildId];
        await saveJTCConfig();
        console.log(`[JTC Config] Deleted config for guild ${guildId}.`);
        return true;
    }
    return false;
}

// Async laden, falls du beim Start warten kannst
loadJTCConfig().catch(console.error);

module.exports = {
    loadJTCConfig,
    getJTCConfigForGuild,
    setJTCConfigForGuild,
    deleteJTCConfigForGuild,
};
