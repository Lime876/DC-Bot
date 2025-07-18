// events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger'); // Importiere den Logger

// Pfad zur Invite-Daten-Datei (muss derselbe sein wie in invitetracker.js)
const inviteDataPath = require('path').join(__dirname, '../data/inviteData.json');
// KORRIGIERTER PFAD FÜR trackerConfigPath:
// 'guildMemberAdd.js' ist in 'events/', muss also nur EINE Ebene hoch, um zum Bot-Root zu kommen,
// und dann in den 'data/' Ordner.
const trackerConfigPath = require('path').join(__dirname, '../data/trackerConfig.json'); // <-- HIER WURDE ES GEÄNDERT!

/**
 * Lädt die Invite-Daten aus der Datei.
 * @returns {object} Die Invite-Daten oder ein leeres Objekt.
 */
const loadInviteData = () => {
    if (require('fs').existsSync(inviteDataPath)) {
        try {
            return JSON.parse(require('fs').readFileSync(inviteDataPath, 'utf8'));
        } catch (e) {
            logger.error(`[InviteTracker Event] Fehler beim Parsen von ${inviteDataPath}:`, e);
            return {};
        }
    }
    return {};
};

/**
 * Speichert die Invite-Daten in der Datei.
 * @param {object} data - Die zu speichernden Invite-Daten.
 */
const saveInviteData = (data) => {
    try {
        const dir = require('path').dirname(inviteDataPath);
        if (!require('fs').existsSync(dir)) {
            require('fs').mkdirSync(dir, { recursive: true });
        }
        require('fs').writeFileSync(inviteDataPath, JSON.stringify(data, null, 2));
    } catch (e) {
        logger.error(`[InviteTracker Event] Fehler beim Schreiben in ${inviteDataPath}:`, e);
    }
};

/**
 * Lädt die Tracker-Konfiguration aus der Datei.
 * @returns {object} Die Konfiguration oder ein leeres Objekt.
 */
const loadTrackerConfig = () => {
    if (require('fs').existsSync(trackerConfigPath)) {
        try {
            return JSON.parse(require('fs').readFileSync(trackerConfigPath, 'utf8'));
        } catch (e) {
            logger.error(`[InviteTracker Event] Fehler beim Parsen von ${trackerConfigPath}:`, e);
            return {};
        }
    }
    return {};
};


module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        if (member.user.bot) return; // Bots ignorieren

        const guild = member.guild;
        const lang = await getGuildLanguage(guild.id);
        // Hier wird die Konfiguration geladen – jetzt vom KORREKTEN Pfad
        const trackerConfig = loadTrackerConfig()[guild.id]; 

        // Prüfen, ob der Invite Tracker für diese Gilde aktiviert ist
        if (!trackerConfig || !trackerConfig.enabled || !trackerConfig.channelId) {
            logger.debug(`[InviteTracker Event] Invite Tracker ist für Gilde ${guild.id} nicht aktiviert oder konfiguriert.`);
            return;
        }

        const logChannel = guild.channels.cache.get(trackerConfig.channelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[InviteTracker Event] Konfigurierter Log-Kanal ${trackerConfig.channelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal.`);
            return;
        }

        try {
            // Invites des Servers vor dem Beitritt des neuen Mitglieds abrufen
            const newInvites = await guild.invites.fetch();
            const oldInvites = global.invites.get(guild.id); // Holen der alten Invites aus dem globalen Cache

            let usedInvite = null;

            // Finde die Einladung, die verwendet wurde
            if (oldInvites) {
                for (const [code, invite] of newInvites) {
                    const oldInvite = oldInvites.get(code);
                    // Wenn eine Einladung neu ist oder ihre Nutzung um 1 gestiegen ist
                    if (!oldInvite || invite.uses > oldInvite.uses) {
                        usedInvite = invite;
                        break;
                    }
                }
            }

            // Aktualisiere den globalen Invite-Cache
            global.invites.set(guild.id, new Map(newInvites.map(invite => [invite.code, invite])));
            
            // Lade aktuelle Invite-Daten
            let inviteData = loadInviteData();
            if (!inviteData[guild.id]) {
                inviteData[guild.id] = {};
            }

            let inviter = null;
            let inviteCode = getTranslatedText(lang, 'invite_tracker_event.UNKNOWN_INVITE');
            let inviteUses = 0;

            if (usedInvite) {
                inviter = usedInvite.inviter;
                inviteCode = usedInvite.code;
                inviteUses = usedInvite.uses;

                // Speichere oder aktualisiere die Daten des Einladenden
                if (inviter) {
                    if (!inviteData[guild.id][usedInvite.code]) {
                        inviteData[guild.id][usedInvite.code] = {
                            inviterId: inviter.id,
                            uses: 0,
                            code: usedInvite.code,
                            maxUses: usedInvite.maxUses,
                            expiresAt: usedInvite.expiresTimestamp // Speichere den Timestamp
                        };
                    }
                    inviteData[guild.id][usedInvite.code].uses = usedInvite.uses;
                    saveInviteData(inviteData);
                }
            }

            const inviterTag = inviter ? (inviter.tag || inviter.username) : getTranslatedText(lang, 'invite_tracker_event.UNKNOWN_INVITER');
            const inviterId = inviter ? inviter.id : getTranslatedText(lang, 'general.UNKNOWN_ID');

            const embed = new EmbedBuilder()
                .setColor(0x00FF00) // Grün für Beitritt
                .setTitle(getTranslatedText(lang, 'invite_tracker_event.NEW_MEMBER_TITLE'))
                .setDescription(getTranslatedText(lang, 'invite_tracker_event.NEW_MEMBER_DESCRIPTION', { userTag: member.user.tag }))
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: getTranslatedText(lang, 'invite_tracker_event.FIELD_USER'), value: `${member.user.tag} (<@${member.user.id}>)`, inline: false },
                    { name: getTranslatedText(lang, 'invite_tracker_event.FIELD_JOINED_VIA'), value: `${inviteCode}`, inline: true },
                    { name: getTranslatedText(lang, 'invite_tracker_event.FIELD_INVITED_BY'), value: `${inviterTag} (<@${inviterId}>)`, inline: true }
                )
                .setTimestamp();

            if (usedInvite) {
                embed.addFields(
                    { name: getTranslatedText(lang, 'invite_tracker_event.FIELD_INVITE_USES'), value: `${inviteUses}`, inline: true }
                );
            }

            await logChannel.send({ embeds: [embed] });
            logger.info(`[InviteTracker Event] Neues Mitglied ${member.user.tag} ist beigetreten (Einladung: ${inviteCode}, Eingeladen von: ${inviterTag}).`);

        } catch (error) {
            logger.error(`[InviteTracker Event] Fehler beim Verfolgen des neuen Mitglieds ${member.user.tag}:`, error);
        }
    },
};
