import { Events, EmbedBuilder } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (oldMember.user.bot) return;

    const guild = newMember.guild;
    const lang = await getGuildLanguage(guild.id);
    const logChannelId = getLogChannelId(guild.id, 'member_update');
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel || !logChannel.isTextBased()) {
      logger.warn(`[MemberUpdate] Ungültiger Log-Kanal ${logChannelId} in Gilde ${guild.id}.`);
      return;
    }

    const userTag = newMember.user.tag;
    const userId = newMember.user.id;

    // Rollenänderungen
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size || removedRoles.size) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(getTranslatedText(lang, 'member_update.LOG_TITLE_ROLES_UPDATED'))
        .setDescription(getTranslatedText(lang, 'member_update.LOG_DESCRIPTION_ROLES_UPDATED', { userTag, userId }))
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .addFields(
          {
            name: getTranslatedText(lang, 'member_update.FIELD_ROLES_ADDED'),
            value: addedRoles.size ? addedRoles.map(r => `<@&${r.id}>`).join(', ') : getTranslatedText(lang, 'member_update.NO_ROLES_ADDED'),
            inline: false
          },
          {
            name: getTranslatedText(lang, 'member_update.FIELD_ROLES_REMOVED'),
            value: removedRoles.size ? removedRoles.map(r => `<@&${r.id}>`).join(', ') : getTranslatedText(lang, 'member_update.NO_ROLES_REMOVED'),
            inline: false
          }
        );

      try {
        await logChannel.send({ embeds: [embed] });
        logger.info(`[MemberUpdate] Rollen von ${userTag} aktualisiert in ${guild.name}.`);
      } catch (error) {
        logger.error(`[MemberUpdate] Fehler beim Rollen-Log für ${userTag} (${userId}):`, error);
      }
    }

    // Spitznamenänderung
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor(0x00BFFF)
        .setTitle(getTranslatedText(lang, 'member_update.LOG_TITLE_NICKNAME_UPDATED'))
        .setDescription(getTranslatedText(lang, 'member_update.LOG_DESCRIPTION_NICKNAME_UPDATED', { userTag, userId }))
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: getTranslatedText(lang, 'member_update.FIELD_OLD_NICKNAME'), value: oldMember.nickname || getTranslatedText(lang, 'member_update.NO_OLD_NICKNAME'), inline: true },
          { name: getTranslatedText(lang, 'member_update.FIELD_NEW_NICKNAME'), value: newMember.nickname || getTranslatedText(lang, 'member_update.NO_NEW_NICKNAME'), inline: true }
        )
        .setTimestamp();

      try {
        await logChannel.send({ embeds: [embed] });
        logger.info(`[MemberUpdate] Spitzname von ${userTag} aktualisiert in ${guild.name}.`);
      } catch (error) {
        logger.error(`[MemberUpdate] Fehler beim Spitznamen-Log für ${userTag} (${userId}):`, error);
      }
    }

    // Timeout-Status
    if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
      const isTimedOut = newMember.communicationDisabledUntil !== null;
      const timeoutReason = isTimedOut ? (newMember.communicationDisabledUntilReason || getTranslatedText(lang, 'member_update.NO_REASON_PROVIDED')) : '';
      const timeoutDuration = isTimedOut ? `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:R>` : '';

      const embed = new EmbedBuilder()
        .setColor(isTimedOut ? 0xFFA500 : 0x00FF00)
        .setTitle(isTimedOut ? getTranslatedText(lang, 'member_update.LOG_TITLE_TIMED_OUT') : getTranslatedText(lang, 'member_update.LOG_TITLE_UNTIMED_OUT'))
        .setDescription(getTranslatedText(lang, 'member_update.LOG_DESCRIPTION_TIMEOUT_STATUS', { userTag, userId }))
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: getTranslatedText(lang, 'member_update.FIELD_TIMEOUT_STATUS'), value: isTimedOut ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'), inline: true },
          { name: getTranslatedText(lang, 'member_update.FIELD_TIMEOUT_DURATION'), value: timeoutDuration || getTranslatedText(lang, 'general.NOT_APPLICABLE'), inline: true },
          { name: getTranslatedText(lang, 'member_update.FIELD_TIMEOUT_REASON'), value: timeoutReason || getTranslatedText(lang, 'general.NOT_AVAILABLE'), inline: false }
        )
        .setTimestamp();

      try {
        await logChannel.send({ embeds: [embed] });
        logger.info(`[MemberUpdate] Timeout-Status von ${userTag} geändert in ${guild.name}.`);
      } catch (error) {
        logger.error(`[MemberUpdate] Fehler beim Timeout-Log für ${userTag} (${userId}):`, error);
      }
    }
  }
};
