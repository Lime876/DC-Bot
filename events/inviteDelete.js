// events/inviteDelete.js
import { Events } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const __dirname = path.resolve();
const INVITE_DATA_PATH = path.resolve(__dirname, '../data/inviteData.json');
const TRACKER_CONFIG_PATH = path.resolve(__dirname, '../data/trackerConfig.json');

let inviteData = new Map();
let trackerConfigs = new Map();

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

async function saveInviteData(data = inviteData) {
  try {
    const dir = path.dirname(INVITE_DATA_PATH);
    await fs.mkdir(dir, { recursive: true }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    await fs.writeFile(INVITE_DATA_PATH, JSON.stringify(Object.fromEntries(data), null, 2), 'utf8');
    logger.debug('[InviteTracker Event] Invite-Daten gespeichert.');
  } catch (e) {
    logger.error(`[InviteTracker Event] Fehler beim Schreiben in ${INVITE_DATA_PATH}:`, e);
  }
}

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

async function saveTrackerConfig(configs = trackerConfigs) {
  try {
    const dir = path.dirname(TRACKER_CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    await fs.writeFile(TRACKER_CONFIG_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
    logger.debug('[InviteTracker Event] Tracker-Konfiguration gespeichert.');
  } catch (e) {
    logger.error(`[InviteTracker Event] Fehler beim Schreiben in ${TRACKER_CONFIG_PATH}:`, e);
  }
}

await loadInviteData();
await loadTrackerConfig();

export default {
  name: Events.InviteDelete,
  async execute(invite, client) {
    const guildId = invite.guild.id;
    const guildTrackerConfig = trackerConfigs.get(guildId);
    if (!guildTrackerConfig || !guildTrackerConfig.enabled) return;

    let currentInviteData = inviteData.get(guildId);
    if (currentInviteData && currentInviteData[invite.code]) {
      delete currentInviteData[invite.code];
      inviteData.set(guildId, currentInviteData);
      await saveInviteData();
      logger.info(`[InviteDelete Event] Invite ${invite.code} aus Daten für Gilde ${invite.guild.name} (${guildId}) gelöscht. (PID: ${process.pid})`);
    } else {
      logger.debug(`[InviteDelete Event] Invite ${invite.code} nicht in lokalen Daten für Gilde ${guildId} gefunden.`);
    }

    if (client.invites && client.invites.has(guildId)) {
      client.invites.get(guildId).delete(invite.code);
      logger.debug(`[InviteDelete Event] Invite ${invite.code} aus Client-Cache für Gilde ${guildId} gelöscht.`);
    } else {
      logger.debug(`[InviteDelete Event] Client-Cache für Gilde ${guildId} oder Invite ${invite.code} nicht gefunden.`);
    }
  }
};