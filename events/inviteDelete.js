// events/inviteDelete.js
const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const inviteDataPath = path.join(__dirname, '../data/inviteData.json');
const trackerConfigPath = path.join(__dirname, '../data/trackerConfig.json');

const loadInviteData = () => {
    if (fs.existsSync(inviteDataPath)) {
        try {
            return JSON.parse(fs.readFileSync(inviteDataPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${inviteDataPath}:`, e);
            return {};
        }
    }
    return {};
};

const saveInviteData = (data) => {
    try {
        fs.writeFileSync(inviteDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Fehler beim Schreiben in ${inviteDataPath}:`, e);
    }
};

const loadTrackerConfig = () => {
    if (fs.existsSync(trackerConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(trackerConfigPath, 'utf8'));
        } catch (e) {
            console.error(`Fehler beim Parsen von ${trackerConfigPath}:`, e);
            return {};
        }
    }
    return {};
};

module.exports = {
    name: Events.InviteDelete,
    async execute(invite, client) {
        const trackerConfig = loadTrackerConfig();
        const guildId = invite.guild.id;

        if (!trackerConfig[guildId] || !trackerConfig[guildId].enabled) {
            return; // Tracker ist für diesen Server nicht aktiviert
        }

        const inviteData = loadInviteData();
        if (inviteData[guildId] && inviteData[guildId][invite.code]) {
            delete inviteData[guildId][invite.code]; // Lösche den Invite aus unseren Daten
            saveInviteData(inviteData);
            console.log(`[InviteDelete] Invite ${invite.code} aus Daten gelöscht.`);
        }
        // Entferne auch aus dem Discord.js Cache
        client.guilds.cache.get(guildId).invites.cache.delete(invite.code);
    },
};