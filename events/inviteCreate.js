// events/inviteCreate.js
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
    name: Events.InviteCreate,
    async execute(invite, client) { // Client-Parameter hinzugefügt, um auf alle Guilds/Invites zugreifen zu können
        const trackerConfig = loadTrackerConfig();
        const guildId = invite.guild.id;

        if (!trackerConfig[guildId] || !trackerConfig[guildId].enabled) {
            return; // Tracker ist für diesen Server nicht aktiviert
        }

        const inviteData = loadInviteData();
        if (!inviteData[guildId]) {
            inviteData[guildId] = {};
        }

        // Aktualisiere den Cache des Bots und speichere den neuen Invite
        client.guilds.cache.get(guildId).invites.cache.set(invite.code, invite);
        inviteData[guildId][invite.code] = {
            inviterId: invite.inviter.id,
            uses: invite.uses || 0, // Start bei 0 oder aktuellen Wert, falls schon genutzt
            maxUses: invite.maxUses,
            expiresAt: invite.expiresTimestamp // null, wenn nie abläuft
        };
        saveInviteData(inviteData);
        console.log(`[InviteCreate] Neuer Invite im Cache: ${invite.code} von ${invite.inviter.tag}`);
    },
};