// utils/welcomeConfig.js – Verwaltung der Willkommensnachrichten-Konfiguration (ESM)

import fs from 'node:fs';
import path from 'node:path';
import logger from './logger.js';

const configPath = path.join(path.resolve(), 'data', 'welcomeConfig.json');
let welcomeConfigs = {};

export function loadWelcomeConfigs() {
    if (!fs.existsSync(configPath)) {
        logger.info('[WelcomeConfig] Keine Datei gefunden – erstelle leere Konfiguration.');
        saveWelcomeConfigs();
        return;
    }

    try {
        const data = fs.readFileSync(configPath, 'utf8');
        welcomeConfigs = JSON.parse(data);
        logger.info('[WelcomeConfig] Konfiguration geladen.');
    } catch (error) {
        logger.error('[WelcomeConfig] Fehler beim Laden:', error);
        welcomeConfigs = {};
    }
}

export function saveWelcomeConfigs() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(welcomeConfigs, null, 2), 'utf8');
        logger.debug('[WelcomeConfig] Konfiguration gespeichert.');
    } catch (error) {
        logger.error('[WelcomeConfig] Fehler beim Speichern:', error);
    }
}

export function getWelcomeConfigForGuild(guildId) {
    return welcomeConfigs[guildId] || null;
}

export function setWelcomeConfig(guildId, channelId, messageContent) {
    welcomeConfigs[guildId] = { channelId, messageContent };
    saveWelcomeConfigs();
}

export function removeWelcomeConfig(guildId) {
    if (welcomeConfigs[guildId]) {
        delete welcomeConfigs[guildId];
        saveWelcomeConfigs();
    }
}

// Automatisches Laden beim Importieren
loadWelcomeConfigs();
