// events/inviteCreate.js
import { Events } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../utils/logger.js';
import { fileURLToPath } from 'node:url'; // Import für __dirname

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pfade zu den Konfigurationsdateien, jetzt robuster
const INVITE_DATA_PATH = path.resolve(__dirname, '../data/inviteData.json');
const TRACKER_CONFIG_PATH = path.resolve(__dirname, '../data/trackerConfig.json');

// Verwende Maps für die Konfigurationen
let inviteData = new Map();
let trackerConfigs = new Map();

/**
 * Lädt die Einladungsdaten aus der Datei.
 * @returns {Promise<void>}
 */
async function loadInviteData() {
    try {
        const data = await fs.readFile(INVITE_DATA_PATH, 'utf8');
        inviteData = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[InviteTracker Event] Invite-Daten geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[InviteTracker Event] inviteData.json nicht gefunden, erstelle leere Daten.');
            inviteData = new Map();
            await saveInviteData();
        } else {
            logger.error('[InviteTracker Event] Fehler beim Laden der Invite-Daten:', error);
            inviteData = new Map();
        }
    }
}

/**
 * Speichert die Einladungsdaten in der Datei.
 * @param {Map<string, object>} data - Die zu speichernden Einladungsdaten.
 * @returns {Promise<void>}
 */
async function saveInviteData(data = inviteData) {
    try {
        const dir = path.dirname(INVITE_DATA_PATH);
        await fs.mkdir(dir, { recursive: true }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(INVITE_DATA_PATH, JSON.stringify(Object.fromEntries(data), null, 2), 'utf8');
        logger.debug('[InviteTracker Event] Invite-Daten gespeichert.');
    } catch (e) {
        logger.error(`[InviteTracker Event] Fehler beim Schreiben in ${INVITE_DATA_PATH}:`, e);
    }
}

/**
 * Lädt die Tracker-Konfiguration aus der Datei.
 * @returns {Promise<void>}
 */
async function loadTrackerConfig() {
    try {
        const data = await fs.readFile(TRACKER_CONFIG_PATH, 'utf8');
        trackerConfigs = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[InviteTracker Event] Tracker-Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[InviteTracker Event] trackerConfig.json nicht gefunden, erstelle leere Konfiguration.');
            trackerConfigs = new Map();
            await saveTrackerConfig();
        } else {
            logger.error('[InviteTracker Event] Fehler beim Laden der Tracker-Konfiguration:', error);
            trackerConfigs = new Map();
        }
    }
}

/**
 * Speichert die Tracker-Konfiguration in der Datei.
 * @param {Map<string, object>} configs - Die zu speichernde Konfiguration.
 * @returns {Promise<void>}
 */
async function saveTrackerConfig(configs = trackerConfigs) {
    try {
        const dir = path.dirname(TRACKER_CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(TRACKER_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
        logger.debug('[InviteTracker Event] Tracker-Konfiguration gespeichert.');
    } catch (e) {
        logger.error(`[InviteTracker Event] Fehler beim Schreiben in ${TRACKER_CONFIG_PATH}:`, e);
    }
}

// Lade Daten beim Modulstart
await loadInviteData();
await loadTrackerConfig();

export default {
    name: Events.InviteCreate,
    async execute(invite, client) {
        const guildId = invite.guild.id;
        const guildTrackerConfig = trackerConfigs.get(guildId);
        if (!guildTrackerConfig || !guildTrackerConfig.enabled) return;

        if (!client.invites) client.invites = new Map();
        if (!client.invites.has(guildId)) client.invites.set(guildId, new Map());
        client.invites.get(guildId).set(invite.code, invite);

        let currentInviteData = inviteData.get(guildId) || {};
        currentInviteData[invite.code] = {
            inviterId: invite.inviter ? invite.inviter.id : null,
            uses: invite.uses || 0,
            maxUses: invite.maxUses,
            expiresAt: invite.expiresTimestamp
        };
        inviteData.set(guildId, currentInviteData);
        await saveInviteData();

        logger.info(`[InviteCreate Event] Neuer Invite erstellt in Gilde ${invite.guild.name} (${guildId}): Code ${invite.code} von ${invite.inviter ? invite.inviter.tag : 'Unbekannt'}. (PID: ${process.pid})`);
    }
};
