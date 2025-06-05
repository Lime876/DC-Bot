// events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
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
    name: Events.GuildMemberAdd,
    async execute(member, client) { // Client-Parameter hinzugefügt
        const guildId = member.guild.id;
        const trackerConfig = loadTrackerConfig();

        if (!trackerConfig[guildId] || !trackerConfig[guildId].enabled) {
            return; // Tracker ist für diesen Server nicht aktiviert
        }

        const inviteData = loadInviteData();
        if (!inviteData[guildId]) {
            inviteData[guildId] = {};
        }

        // Cache alle aktuellen Invites des Servers
        const newInvites = await member.guild.invites.fetch();
        const oldInvites = client.guilds.cache.get(guildId).invites.cache;

        let usedInvite = null;

        // Finde den Invite, dessen Nutzung sich erhöht hat
        for (const [code, invite] of newInvites) {
            const oldInvite = oldInvites.get(code);
            // Überprüfe, ob der Invite existiert, nicht abgelaufen ist und die Nutzung erhöht wurde
            if (oldInvite && invite.uses > oldInvite.uses) {
                usedInvite = invite;
                break;
            }
        }
        
        // Aktualisiere den Cache des Bots für zukünftige Vergleiche
        client.guilds.cache.get(guildId).invites.cache = newInvites;


        let inviter = null;
        let inviterUses = 0;
        let inviteCode = 'Unbekannt';

        if (usedInvite) {
            inviter = usedInvite.inviter;
            inviteCode = usedInvite.code;

            // Aktualisiere die Nutzung im inviteData.json
            if (inviteData[guildId][inviteCode]) {
                inviteData[guildId][inviteCode].uses = usedInvite.uses;
                saveInviteData(inviteData);
            } else {
                 // Falls der Invite nicht in unserer inviteData ist (z.B. Bot war offline bei Erstellung)
                inviteData[guildId][inviteCode] = {
                    inviterId: inviter ? inviter.id : null,
                    uses: usedInvite.uses,
                    maxUses: usedInvite.maxUses,
                    expiresAt: usedInvite.expiresTimestamp
                };
                saveInviteData(inviteData);
            }

            // Hole die Gesamtnutzung des Einladenden
            inviterUses = Object.values(inviteData[guildId]).filter(inv => inv.inviterId === inviter?.id).reduce((sum, inv) => sum + inv.uses, 0);

        } else {
            // Fallback für System-Invites oder nicht verfolgte Invites
            console.log(`[GuildMemberAdd] ${member.user.tag} ist über einen nicht verfolgten Invite beigetreten oder kein Invite gefunden.`);
        }

        // Sende eine Nachricht in den konfigurierten Log-Kanal
        const logChannelId = trackerConfig[guildId]?.channelId;
        if (logChannelId) {
            const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);

            if (logChannel && logChannel.isTextBased()) {
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('👋 Neues Mitglied beigetreten!')
                    .setDescription(`${member.user.tag} ist dem Server beigetreten!`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: 'Benutzer', value: `<@${member.user.id}> (${member.user.id})`, inline: true },
                        { name: 'Beigetreten über', value: usedInvite ? `\`${inviteCode}\`` : 'Unbekannt', inline: true },
                        { name: 'Eingeladen von', value: inviter ? `<@${inviter.id}> (${inviter.tag})` : 'Unbekannt', inline: true }
                    )
                    .setTimestamp();
                
                if (inviter) {
                     welcomeEmbed.addFields(
                        { name: 'Invites von Einlader', value: `${inviterUses} Mal`, inline: true }
                    );
                }

                await logChannel.send({ embeds: [welcomeEmbed] });
            } else {
                console.warn(`[Invite Tracker] Konfigurierter Log-Kanal (${logChannelId}) existiert nicht oder ist kein Textkanal.`);
            }
        }
    },
};