import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../data/autotimeoutConfig.json');

let configsCache = null;

export function loadAutotimeoutConfig() {
    if (configsCache !== null) return configsCache;

    if (fs.existsSync(configPath)) {
        try {
            configsCache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`[Autotimeout Config] Fehler beim Parsen von ${configPath}:`, e);
            configsCache = {};
        }
    } else {
        configsCache = {};
    }
    return configsCache;
}

export function saveAutotimeoutConfig(config) {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        configsCache = config;
    } catch (e) {
        console.error(`[Autotimeout Config] Fehler beim Schreiben in ${configPath}:`, e);
    }
}

export const getDefaultAutotimeoutConfig = () => ({
    enabled: false,
    durationMs: 600000,
    violationsThreshold: 3,
    moderationLogChannelId: null,
});

export function getGuildAutotimeoutConfig(guildId) {
    const configs = loadAutotimeoutConfig();
    if (!configs[guildId]) {
        configs[guildId] = getDefaultAutotimeoutConfig();
        saveAutotimeoutConfig(configs);
    } else {
        configs[guildId] = { ...getDefaultAutotimeoutConfig(), ...configs[guildId] };
        saveAutotimeoutConfig(configs);
    }
    return configs[guildId];
}

export function setGuildAutotimeoutConfig(guildId, newConfig) {
    const configs = loadAutotimeoutConfig();
    configs[guildId] = { ...getGuildAutotimeoutConfig(guildId), ...newConfig };
    saveAutotimeoutConfig(configs);
}