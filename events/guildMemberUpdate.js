// events/guildMemberUpdate.js
const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        // Ignoriere Bots
        if (oldMember.user.bot) return;

        const guild = newMember.guild;
        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'member_update');

        if (!logChannelId) {
            // logger.debug(`[MemberUpdate Event] Kein Log-Kanal für 'member_update' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[MemberUpdate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        const userTag = newMember.user.tag;
        const userId = newMember.user.id;

        // --- 1. Rollenänderungen protokollieren ---
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFFA500) // Orange für Rollenänderungen
                .setTitle(getTranslatedText(lang, 'member_update.LOG_TITLE_ROLES_UPDATED'))
                .setDescription(getTranslatedText(lang, 'member_update.LOG_DESCRIPTION_ROLES_UPDATED', { userTag: userTag, userId: userId }))
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            if (addedRoles.size > 0) {
                embed.addFields({ 
                    name: getTranslatedText(lang, 'member_update.FIELD_ROLES_ADDED'), 
                    value: addedRoles.map(role => `<@&${role.id}>`).join(', '), 
                    inline: false 
                });
            } else {
                embed.addFields({ 
                    name: getTranslatedText(lang, 'member_update.FIELD_ROLES_ADDED'), 
                    value: getTranslatedText(lang, 'member_update.NO_ROLES_ADDED'), 
                    inline: false 
                });
            }

            if (removedRoles.size > 0) {
                embed.addFields({ 
                    name: getTranslatedText(lang, 'member_update.FIELD_ROLES_REMOVED'), 
                    value: removedRoles.map(role => `<@&${role.id}>`).join(', '), 
                    inline: false 
                });
            } else {
                embed.addFields({ 
                    name: getTranslatedText(lang, 'member_update.FIELD_ROLES_REMOVED'), 
                    value: getTranslatedText(lang, 'member_update.NO_ROLES_REMOVED'), 
                    inline: false 
                });
            }

            try {
                await logChannel.send({ embeds: [embed] });
                logger.info(`[MemberUpdate Event] Rollen von ${userTag} aktualisiert in Gilde ${guild.name}. (PID: ${process.pid})`);
            } catch (error) {
                logger.error(`[MemberUpdate Event] Fehler beim Senden des Rollen-Update-Logs für ${userTag}:`, error);
            }
        }

        // --- 2. Spitznamenänderungen protokollieren ---
        if (oldMember.nickname !== newMember.nickname) {
            const oldNickname = oldMember.nickname || getTranslatedText(lang, 'member_update.NO_OLD_NICKNAME');
            const newNickname = newMember.nickname || getTranslatedText(lang, 'member_update.NO_NEW_NICKNAME');

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF) // Helles Blau für Spitznamenänderungen
                .setTitle(getTranslatedText(lang, 'member_update.LOG_TITLE_NICKNAME_UPDATED'))
                .setDescription(getTranslatedText(lang, 'member_update.LOG_DESCRIPTION_NICKNAME_UPDATED', { userTag: userTag, userId: userId }))
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: getTranslatedText(lang, 'member_update.FIELD_OLD_NICKNAME'), value: oldNickname, inline: true },
                    { name: getTranslatedText(lang, 'member_update.FIELD_NEW_NICKNAME'), value: newNickname, inline: true }
                )
                .setTimestamp();

            try {
                await logChannel.send({ embeds: [embed] });
                logger.info(`[MemberUpdate Event] Spitzname von ${userTag} aktualisiert in Gilde ${guild.name}. (PID: ${process.pid})`);
            } catch (error) {
                logger.error(`[MemberUpdate Event] Fehler beim Senden des Spitznamen-Update-Logs für ${userTag}:`, error);
            }
        }
    },
};
