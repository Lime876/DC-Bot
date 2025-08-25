import fs from 'node:fs/promises';
import path from 'node:path';
import logger from './logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GUILD_CONFIGS_PATH = path.join(__dirname, '..', 'data', 'guildConfigs.json');

let guildConfigsCache = {};

export async function loadGuildConfigs() {
    try {
        const data = await fs.readFile(GUILD_CONFIGS_PATH, 'utf8');
        guildConfigsCache = JSON.parse(data);
        logger.info('[ConfigUtils] Gilden-Konfigurationen geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[ConfigUtils] guildConfigs.json nicht gefunden, erstelle leere Konfiguration.');
            guildConfigsCache = {};
            await saveGuildConfigs(guildConfigsCache);
        } else {
            logger.error('[ConfigUtils] Fehler beim Laden der Gilden-Konfigurationen:', error);
            guildConfigsCache = {};
        }
    }
    return guildConfigsCache;
}

export async function saveGuildConfigs(configs) {
    try {
        await fs.writeFile(GUILD_CONFIGS_PATH, JSON.stringify(configs, null, 2), 'utf8');
        guildConfigsCache = configs;
        logger.info('[ConfigUtils] Gilden-Konfigurationen gespeichert.');
    } catch (error) {
        logger.error('[ConfigUtils] Fehler beim Speichern der Gilden-Konfigurationen:', error);
    }
}

export async function getGuildConfig(guildId) {
    if (Object.keys(guildConfigsCache).length === 0) {
        await loadGuildConfigs();
    }
    return guildConfigsCache[guildId] || {};
}

export async function updateGuildConfig(guildId, newConfig) {
    if (Object.keys(guildConfigsCache).length === 0) {
        await loadGuildConfigs();
    }
    guildConfigsCache[guildId] = { ...guildConfigsCache[guildId], ...newConfig };
    await saveGuildConfigs(guildConfigsCache);
}

// Initialer Lade-Versuch
loadGuildConfigs().catch(err => logger.error('[ConfigUtils] Fehler beim initialen Laden:', err));