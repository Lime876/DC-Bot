// events/guildMemberRemove.js
import { Events, EmbedBuilder } from 'discord.js';
import { getLogChannelId } from '../utils/config.js'; // Korrigiere den Importnamen
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // Import für __dirname

// Resolve __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verwende __dirname für einen zuverlässigeren Pfad
const REJOIN_ROLES_PATH = path.resolve(__dirname, '../data/rejoinRoles.json');
let rejoinRoles = new Map();

/**
 * Lädt die Rejoin-Rollen-Konfiguration aus der Datei.
 * @returns {Promise<void>}
 */
async function loadRejoinRoles() {
    try {
        const data = await fs.readFile(REJOIN_ROLES_PATH, 'utf8');
        rejoinRoles = new Map(Object.entries(JSON.parse(data)));
        logger.debug('[RejoinRoles] Rejoin-Rollen-Konfiguration geladen.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.warn('[RejoinRoles] rejoinRoles.json nicht gefunden, erstelle leere Konfiguration.');
            rejoinRoles = new Map();
            await saveRejoinRoles();
        } else {
            logger.error('[RejoinRoles] Fehler beim Laden der Rejoin-Rollen-Konfiguration:', error);
            rejoinRoles = new Map();
        }
    }
}

/**
 * Speichert die Rejoin-Rollen-Konfiguration in der Datei.
 * @param {Map<string, object>} configs - Die zu speichernde Konfiguration.
 * @returns {Promise<void>}
 */
async function saveRejoinRoles(configs = rejoinRoles) {
    try {
        const dir = path.dirname(REJOIN_ROLES_PATH);
        await fs.mkdir(dir, {
            recursive: true
        }).catch(e => {
            if (e.code !== 'EEXIST') throw e;
        });
        await fs.writeFile(REJOIN_ROLES_PATH, JSON.stringify(Object.fromEntries(configs), null, 2), 'utf8');
        logger.debug('[RejoinRoles] Rejoin-Rollen-Konfiguration gespeichert.');
    } catch (e) {
        logger.error(`[RejoinRoles] Fehler beim Schreiben in ${REJOIN_ROLES_PATH}:`, e);
    }
}

await loadRejoinRoles();

export default {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;
        const lang = await getGuildLanguage(guild.id);

        // --- Austritts-Log senden ---
        try {
            // Verwende den korrigierten Funktionsnamen getLogChannelId
            const logChannelId = getLogChannelId(guild.id, 'member_leave');
            if (logChannelId) {
                let logChannel = guild.channels.cache.get(logChannelId);
                if (!logChannel) {
                    try {
                        logChannel = await guild.channels.fetch(logChannelId);
                    } catch {}
                }
                if (logChannel && logChannel.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(getTranslatedText(lang, 'member_remove.LOG_TITLE'))
                        .setDescription(getTranslatedText(lang, 'member_remove.LOG_DESCRIPTION', {
                            userTag: member.user.tag,
                            userId: member.user.id
                        }))
                        .setThumbnail(member.user.displayAvatarURL({
                            dynamic: true
                        }))
                        .addFields({
                            name: getTranslatedText(lang, 'member_remove.FIELD_USER_ID'),
                            value: member.user.id,
                            inline: true
                        }, {
                            name: getTranslatedText(lang, 'member_remove.FIELD_JOIN_DATE'),
                            value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
                            inline: true
                        })
                        .setTimestamp()
                        .setFooter({
                            text: getTranslatedText(lang, 'member_remove.FOOTER_GUILD_ID', {
                                guildId: guild.id
                            })
                        });

                    await logChannel.send({
                        embeds: [embed]
                    }).catch(err => logger.error(`[GuildMemberRemove Event] Fehler beim Senden des Austritts-Logs für ${member.user.tag}:`, err));
                    logger.info(`[GuildMemberRemove Event] Mitglied ${member.user.tag} hat Gilde ${guild.name} verlassen.`);
                } else {
                    logger.warn(`[GuildMemberRemove Event] Log-Kanal ungültig für Gilde ${guild.id}.`);
                }
            }
        } catch (error) {
            logger.error(`[GuildMemberRemove Event] Fehler in Austritts-Log-Logik für ${member.user.tag}:`, error);
        }

        // --- Rejoin Roles speichern ---
        try {
            const rolesToSave = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.id);
            rejoinRoles.set(member.user.id, {
                guildId: guild.id,
                roles: rolesToSave,
                timestamp: Date.now()
            });
            await saveRejoinRoles();
            logger.debug(`[RejoinRoles] Rollen für ${member.user.tag} gespeichert: ${rolesToSave.length} Rollen.`);
        } catch (error) {
            logger.error(`[RejoinRoles] Fehler beim Speichern der Rollen für ${member.user.tag}:`, error);
            const generalLogChannelId = getLogChannelId(guild.id, 'error'); // Verwende den korrigierten Funktionsnamen
            if (generalLogChannelId) {
                const generalLogChannel = guild.channels.cache.get(generalLogChannelId);
                if (generalLogChannel && generalLogChannel.isTextBased()) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle(getTranslatedText(lang, 'rejoin_roles.ERROR_TITLE'))
                        .setDescription(getTranslatedText(lang, 'rejoin_roles.ERROR_SAVING_ROLES', {
                            userTag: member.user.tag,
                            errorMessage: error.message
                        }))
                        .setTimestamp();
                    await generalLogChannel.send({
                        embeds: [errorEmbed]
                    }).catch(err => logger.error(`[RejoinRoles] Fehler beim Senden des Fehler-Logs:`, err));
                }
            }
        }
    },
};
