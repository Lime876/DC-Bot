// events/guildMemberAdd.js
const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js'); // PermissionsBitField hinzugefügt
const fs = require('fs');
const path = require('path');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils'); // Import für Übersetzungen hinzugefügt

// Pfade für Invite Tracker
const inviteDataPath = path.join(__dirname, '../data/inviteData.json');
const trackerConfigPath = path.join(__dirname, '../data/trackerConfig.json');

// Pfad für Autorolle
const autoroleConfigPath = path.join(__dirname, '../data/autoroleConfig.json'); // NEU: Pfad zur Autorollen-Konfig

// Ladefunktion für Invite Data (bereits vorhanden)
const loadInviteData = () => {
    if (fs.existsSync(inviteDataPath)) {
        try {
            return JSON.parse(fs.readFileSync(inviteDataPath, 'utf8'));
        } catch (e) {
            console.error(`[Invite Tracker] Fehler beim Parsen von ${inviteDataPath}:`, e);
            return {};
        }
    }
    return {};
};

// Speicherfunktion für Invite Data (bereits vorhanden)
const saveInviteData = (data) => {
    try {
        fs.writeFileSync(inviteDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[Invite Tracker] Fehler beim Schreiben in ${inviteDataPath}:`, e);
    }
};

// Ladefunktion für Tracker Config (bereits vorhanden)
const loadTrackerConfig = () => {
    if (fs.existsSync(trackerConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(trackerConfigPath, 'utf8'));
        } catch (e) {
            console.error(`[Invite Tracker] Fehler beim Parsen von ${trackerConfigPath}:`, e);
            return {};
        }
    }
    return {};
};

// NEU: Ladefunktion für Autorollen-Konfiguration
const loadAutoroleConfig = () => {
    if (fs.existsSync(autoroleConfigPath)) {
        try {
            return JSON.parse(fs.readFileSync(autoroleConfigPath, 'utf8'));
        } catch (e) {
            console.error(`[Autorole Event] Fehler beim Parsen von ${autoroleConfigPath}:`, e);
            return {};
        }
    }
    return {};
};

// NEU: Speicherfunktion für Autorollen-Konfiguration (nicht direkt im Event verwendet, aber gute Praxis)
const saveAutoroleConfig = (config) => {
    try {
        const dir = path.dirname(autoroleConfigPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(autoroleConfigPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(`[Autorole Event] Fehler beim Schreiben in ${autoroleConfigPath}:`, e);
    }
};


module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const guildId = member.guild.id;
        const lang = getGuildLanguage(guildId); // Sprache für diesen Server abrufen

        // --- Start der Invite Tracker Logik (Dein bestehender Code) ---
        const trackerConfig = loadTrackerConfig();

        if (trackerConfig[guildId] && trackerConfig[guildId].enabled) { // Nur wenn der Tracker aktiviert ist
            const inviteData = loadInviteData();
            if (!inviteData[guildId]) {
                inviteData[guildId] = {};
            }

            // Cache alle aktuellen Invites des Servers
            const newInvites = await member.guild.invites.fetch();
            // Stellen Sie sicher, dass der Cache initialisiert ist, falls der Bot gerade gestartet wurde
            if (!client.guilds.cache.get(guildId) || !client.guilds.cache.get(guildId).invites) {
                console.log(`[Invite Tracker] Initialisiere Invite-Cache für ${member.guild.name} nach Beitritt.`);
                client.guilds.cache.get(guildId).invites = { cache: new Map() };
            }
            const oldInvites = client.guilds.cache.get(guildId).invites.cache;

            let usedInvite = null;

            // Finde den Invite, dessen Nutzung sich erhöht hat
            for (const [code, invite] of newInvites) {
                const oldInvite = oldInvites.get(code);
                if (oldInvite && invite.uses > oldInvite.uses) {
                    usedInvite = invite;
                    break;
                }
            }

            // Aktualisiere den Cache des Bots für zukünftige Vergleiche
            // Dies sollte NACH dem Vergleich passieren, um den alten Zustand für den nächsten Beitritt zu speichern
            // Und es sollte den gesamten neuen Cache überschreiben
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
                } else {
                    // Falls der Invite nicht in unserer inviteData ist (z.B. Bot war offline bei Erstellung)
                    inviteData[guildId][inviteCode] = {
                        inviterId: inviter ? inviter.id : null,
                        uses: usedInvite.uses,
                        maxUses: usedInvite.maxUses,
                        expiresAt: usedInvite.expiresTimestamp
                    };
                }
                saveInviteData(inviteData); // Speichere die aktualisierten Invite-Daten

                // Hole die Gesamtnutzung des Einladenden (basierend auf der aktualisierten inviteData)
                if (inviter) {
                    inviterUses = Object.values(inviteData[guildId])
                        .filter(inv => inv.inviterId === inviter.id)
                        .reduce((sum, inv) => sum + inv.uses, 0);
                }

            } else {
                console.log(`[Invite Tracker] ${member.user.tag} ist über einen nicht verfolgten Invite beigetreten oder kein Invite gefunden.`);
            }

            // Sende eine Nachricht in den konfigurierten Log-Kanal
            const logChannelId = trackerConfig[guildId]?.channelId;
            if (logChannelId) {
                const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);

                if (logChannel && logChannel.isTextBased()) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(getTranslatedText(lang, 'invite_tracker.NEW_MEMBER_TITLE')) // Beispiel: Titel übersetzen
                        .setDescription(getTranslatedText(lang, 'invite_tracker.NEW_MEMBER_DESCRIPTION', { userTag: member.user.tag })) // Beispiel: Beschreibung übersetzen
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: getTranslatedText(lang, 'invite_tracker.FIELD_USER'), value: `<@${member.user.id}> (${member.user.id})`, inline: true },
                            { name: getTranslatedText(lang, 'invite_tracker.FIELD_JOINED_VIA'), value: usedInvite ? `\`${inviteCode}\`` : getTranslatedText(lang, 'invite_tracker.UNKNOWN_INVITE'), inline: true },
                            { name: getTranslatedText(lang, 'invite_tracker.FIELD_INVITED_BY'), value: inviter ? `<@${inviter.id}> (${inviter.tag})` : getTranslatedText(lang, 'invite_tracker.UNKNOWN_INVITER'), inline: true }
                        )
                        .setTimestamp();

                    if (inviter) {
                        welcomeEmbed.addFields(
                            { name: getTranslatedText(lang, 'invite_tracker.FIELD_INVITER_USES'), value: `${inviterUses} Mal`, inline: true }
                        );
                    }

                    await logChannel.send({ embeds: [welcomeEmbed] });
                } else {
                    console.warn(`[Invite Tracker] Konfigurierter Log-Kanal (${logChannelId}) existiert nicht oder ist kein Textkanal.`);
                }
            }
        }
        // --- Ende der Invite Tracker Logik ---

        // --- Start der Autorollen Logik (NEU hinzugefügt) ---
        const autoroleConfig = loadAutoroleConfig();
        const guildAutoroleConfig = autoroleConfig[guildId] || {};
        const autoroleId = guildAutoroleConfig.autoroleId;

        if (autoroleId) {
            try {
                const role = member.guild.roles.cache.get(autoroleId);

                if (!role) {
                    console.warn(`[Autorole Event] Konfigurierte Autorolle ${autoroleId} für Gilde ${guildId} nicht gefunden. (Möglicherweise gelöscht)`);
                    // Optional: Rolle aus der Konfiguration entfernen, wenn sie nicht existiert
                    // delete autoroleConfig[guildId].autoroleId;
                    // saveAutoroleConfig(autoroleConfig);
                    return;
                }

                // Prüfe, ob der Bot die Berechtigung zum Verwalten von Rollen hat
                if (!member.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    console.error(`[Autorole Event] Bot hat keine Berechtigung 'ManageRoles' auf Server ${member.guild.name} (${guildId}).`);
                    return;
                }

                // Prüfe die Rollenhierarchie des Bots
                if (member.guild.members.me.roles.highest.position <= role.position) {
                    console.error(`[Autorole Event] Bot kann Rolle ${role.name} (${role.id}) nicht zuweisen, da sie höher ist als seine höchste Rolle auf Server ${member.guild.name} (${guildId}).`);
                    return;
                }
                
                // Füge die Rolle hinzu
                await member.roles.add(role);
                console.log(`[Autorole Event] Rolle '${role.name}' (${role.id}) erfolgreich an neues Mitglied ${member.user.tag} (${member.id}) in Gilde ${member.guild.name} (${guildId}) zugewiesen.`);

            } catch (error) {
                console.error(`[Autorole Event] Fehler beim Zuweisen der Autorolle für ${member.user.tag} in ${member.guild.name}:`, error);
            }
        }
        // --- Ende der Autorollen Logik ---
    },
};