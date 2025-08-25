// events/messageDelete.js
import { Events, AuditLogEvent } from 'discord.js';
import { getTranslatedText, getGuildLanguage } from '../utils/languageUtils.js';
import { logEvent } from '../utils/logUtils.js';
import logger from '../utils/logger.js';

export default {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (!message.guild) return;

    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        const lang = await getGuildLanguage(message.guild.id);
        await logEvent(message.guild.id, 'message_delete', {
          logTitle: getTranslatedText(lang, 'message_delete.LOG_TITLE'),
          logDescription: getTranslatedText(lang, 'message_delete.LOG_DESCRIPTION_USER_DELETED', {
            authorTag: message.author?.tag ?? getTranslatedText(lang, 'general.UNKNOWN_USER'),
            authorId: message.author?.id ?? getTranslatedText(lang, 'general.UNKNOWN_ID'),
            channelMention: message.channel.toString(),
          }),
          fields: [
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: message.author ? `${message.author.tag} (${message.author.id})` : getTranslatedText(lang, 'general.UNKNOWN'), inline: true },
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
            { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false },
          ],
          color: 'Red',
          footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) },
        });
        return;
      }
    }

    const lang = await getGuildLanguage(message.guild.id);
    let deleter = null;
    let reason = null;

    try {
      const auditLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 10 });
      deleter = auditLogs.entries.find(e => e.target.id === message.author.id && e.extra?.channel?.id === message.channel.id && Date.now() - e.createdTimestamp < 10000 && (e.extra?.count === 1 || e.extra?.count === undefined))?.executor ?? null;
      reason = auditLogs.entries.find(e => e.executor === deleter)?.reason ?? null;
    } catch (e) {
      logger.error(`[MessageDelete] Audit-Log Fehler in Gilde ${message.guild.id}:`, e);
    }

    let logDescKey = 'message_delete.LOG_DESCRIPTION_USER_DELETED';
    const fields = [
      { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_AUTHOR'), value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
      { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CHANNEL'), value: message.channel.name, inline: true },
      { name: getTranslatedText(lang, 'message_delete.LOG_FIELD_CONTENT'), value: message.content || getTranslatedText(lang, 'message_delete.NO_CONTENT'), inline: false },
    ];

    if (deleter && deleter.id !== client.user.id && deleter.id !== message.author.id) {
      logDescKey = 'message_delete.LOG_DESCRIPTION_MOD_DELETED';
      fields.push({ name: getTranslatedText(lang, 'message_delete.LOG_FIELD_DELETER'), value: `${deleter.tag} (\`${deleter.id}\`)`, inline: true });
      if (reason) fields.push({ name: getTranslatedText(lang, 'general.REASON'), value: reason, inline: false });
    } else if (deleter && deleter.id === client.user.id) {
      logDescKey = 'message_delete.LOG_DESCRIPTION_BOT_DELETED';
      if (reason) fields.push({ name: getTranslatedText(lang, 'general.REASON'), value: reason, inline: false });
    }

    await logEvent(message.guild.id, 'message_delete', {
      logTitle: getTranslatedText(lang, 'message_delete.LOG_TITLE'),
      logDescription: getTranslatedText(lang, logDescKey, {
        authorTag: message.author.tag,
        authorId: message.author.id,
        channelMention: message.channel.toString(),
        deleterTag: deleter?.tag ?? getTranslatedText(lang, 'general.UNKNOWN'),
        deleterId: deleter?.id ?? getTranslatedText(lang, 'general.UNKNOWN_ID'),
      }),
      fields,
      color: 'Red',
      footer: { text: getTranslatedText(lang, 'message_delete.FOOTER_MESSAGE_ID', { messageId: message.id }) },
    });

    logger.info(`[MessageDelete] Nachricht ${message.id} von ${message.author.tag} in #${message.channel.name} gelöscht.`);
  },
};