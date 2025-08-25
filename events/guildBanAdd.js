import { Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

function safeTag(user) {
  return user?.tag ?? `@${user?.username ?? 'Unknown'}`;
}

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    const guild = ban?.guild;
    const user = ban?.user;
    if (!guild || !user) return;

    const lang = await getGuildLanguage(guild.id);
    const logChannelId = getLogChannelId(guild.id, 'member_ban');
    if (!logChannelId) return;

    let logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
      try {
        logChannel = await guild.channels.fetch(logChannelId);
      } catch {
        // Kanal konnte nicht geholt werden
      }
    }

    if (!logChannel || !logChannel.isTextBased()) {
      logger.warn(`[GuildBanAdd] Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
      return;
    }

    let moderator = getTranslatedText(lang, 'guild_ban_add.UNKNOWN_MODERATOR');
    let reason = ban.reason ?? getTranslatedText(lang, 'guild_ban_add.NO_REASON_PROVIDED');

    try {
      const logs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 10,
      });

      const entry = logs.entries
        .filter(e => e.target?.id === user.id)
        .sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))
        .first();

      if (entry?.executor) {
        const recent = Date.now() - (entry.createdTimestamp ?? 0) < 10_000;
        if (recent) {
          const exec = entry.executor;
          moderator = `${safeTag(exec)} (<@${exec.id}>)`;
          if (entry.reason) reason = entry.reason;
        }
      }
    } catch (error) {
      logger.error(`[GuildBanAdd] Fehler beim Abrufen des Audit-Logs für Bann von ${safeTag(user)} (${user.id}):`, error);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF4500)
      .setTitle(getTranslatedText(lang, 'guild_ban_add.LOG_TITLE'))
      .setDescription(getTranslatedText(lang, 'guild_ban_add.LOG_DESCRIPTION', { userTag: safeTag(user), userId: user.id }))
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: getTranslatedText(lang, 'guild_ban_add.FIELD_REASON'), value: reason || '—', inline: false },
        { name: getTranslatedText(lang, 'guild_ban_add.FIELD_MODERATOR'), value: moderator || '—', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'guild_ban_add.FOOTER_USER_ID', { userId: user.id }) });

    try {
      await logChannel.send({ embeds: [embed] });
      logger.info(`[GuildBanAdd] Benutzer ${safeTag(user)} in Gilde ${guild.name} gebannt. Moderator: ${moderator}, Grund: ${reason}. (PID: ${process.pid})`);
    } catch (error) {
      logger.error(`[GuildBanAdd] Fehler beim Senden des Bann-Logs für ${safeTag(user)} (${user.id}):`, error);
    }
  },
};