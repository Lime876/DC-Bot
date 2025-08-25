// utils/config.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logChannelsPath = path.join(__dirname, '../data/logChannels.json');

let logChannelsCache = {};

function loadLogChannels() {
    logger.debug(`[Config] Lade Log-Kanal-Konfiguration von ${logChannelsPath}`);
    if (fs.existsSync(logChannelsPath)) {
        try {
            const data = fs.readFileSync(logChannelsPath, 'utf8');
            logChannelsCache = JSON.parse(data);
            logger.info('[Config] Log-Kanal-Konfiguration geladen.');
        } catch (error) {
            logger.error('[Config] Fehler beim Parsen der Log-Kanal-Konfiguration:', error);
            logChannelsCache = {};
        }
    } else {
        try {
            const dir = path.dirname(logChannelsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {
                    recursive: true
                });
                logger.debug(`[Config] Verzeichnis ${dir} erstellt.`);
            }
            fs.writeFileSync(logChannelsPath, JSON.stringify({}, null, 4), 'utf8');
            logger.warn('[Config] logChannels.json nicht gefunden. Leere Konfigurationsdatei erstellt.');
            logChannelsCache = {};
        } catch (error) {
            logger.error('[Config] Fehler beim Erstellen der Log-Kanal-Konfigurationsdatei:', error);
        }
    }
}

function saveLogChannels() {
    try {
        fs.writeFileSync(logChannelsPath, JSON.stringify(logChannelsCache, null, 4), 'utf8');
        logger.debug('[Config] Log-Kanal-Konfiguration gespeichert.');
    } catch (error) {
        logger.error('[Config] Fehler beim Speichern der Log-Kanal-Konfiguration:', error);
    }
}

// Exports sind jetzt korrekt definiert
export function getLogChannelId(guildId, logType) {
    return logChannelsCache[guildId]?.[logType] || null;
}

export function setLogChannelId(guildId, logType, channelId) {
    if (!logChannelsCache[guildId]) logChannelsCache[guildId] = {};

    if (channelId) {
        logChannelsCache[guildId][logType] = channelId;
        logger.info(`[Config] Log-Kanal für '${logType}' in Gilde ${guildId} gesetzt: ${channelId}`);
    } else {
        delete logChannelsCache[guildId][logType];
        if (Object.keys(logChannelsCache[guildId]).length === 0) {
            delete logChannelsCache[guildId];
        }
        logger.info(`[Config] Log-Kanal für '${logType}' in Gilde ${guildId} entfernt.`);
    }

    saveLogChannels();
}

loadLogChannels();
