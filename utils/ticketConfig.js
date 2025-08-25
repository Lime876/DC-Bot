// utils/ticketConfig.js
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const configPath = path.join(process.cwd(), 'data', 'ticketConfig.json');
let ticketConfigs = {};

// Ticket-Konfiguration laden oder erstellen
try {
    if (fs.existsSync(configPath)) {
        ticketConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        logger.info('[TicketConfig] Ticket-Konfiguration geladen.');
    } else {
        logger.info('[TicketConfig] Keine ticketConfig.json gefunden. Erstelle leere Konfiguration.');
        fs.writeFileSync(configPath, JSON.stringify({}, null, 2), 'utf8');
    }
} catch (error) {
    logger.error(`[TicketConfig] Fehler beim Laden der Ticket-Konfiguration: ${error.message}`);
}

function saveTicketConfigs() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(ticketConfigs, null, 2), 'utf8');
        logger.debug?.('[TicketConfig] Ticket-Konfiguration gespeichert.');
    } catch (error) {
        logger.error(`[TicketConfig] Fehler beim Speichern der Ticket-Konfiguration: ${error.message}`);
    }
}

export function getTicketConfigForGuild(guildId) {
    return ticketConfigs[guildId] || null;
}

export function setTicketConfig(guildId, categoryId, supportRoleId, logChannelId, messageChannelId, ticketMessageId) {
    ticketConfigs[guildId] = {
        categoryId,
        supportRoleId,
        logChannelId,
        messageChannelId,
        ticketMessageId
    };
    saveTicketConfigs();
}

export function updateTicketConfig(guildId, key, value) {
    if (ticketConfigs[guildId]) {
        ticketConfigs[guildId][key] = value;
        saveTicketConfigs();
        logger.debug?.(`[TicketConfig] Gilde ${guildId} aktualisiert: ${key} = ${value}`);
    } else {
        logger.warn(`[TicketConfig] Keine Konfiguration für Gilde ${guildId} gefunden.`);
    }
}

export function removeTicketConfig(guildId) {
    if (ticketConfigs[guildId]) {
        delete ticketConfigs[guildId];
        saveTicketConfigs();
        logger.info(`[TicketConfig] Konfiguration für Gilde ${guildId} entfernt.`);
    }
}
