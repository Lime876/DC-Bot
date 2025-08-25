// events/channelDelete.js
import { Events, EmbedBuilder, AuditLogEvent, ChannelType } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return; // Nur Gilden

    const lang = await getGuildLanguage(guild.id);

    // Log-Kanal für dieses Event holen
    const logChannelId = getLogChannelId(guild.id, 'channel_delete');
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel?.isTextBased()) {
      logger.warn(`[ChannelDelete] Ungültiger Log-Kanal ${logChannelId} in Gilde ${guild.id}. (PID: ${process.pid})`);
      return;
    }

    let deleter = getTranslatedText(lang, 'channel_delete.UNKNOWN_DELETER');
    const categoryName = channel.parent?.name ?? getTranslatedText(lang, 'channel_delete.NO_CATEGORY');

    // Audit-Logs prüfen, um den Löschenden zu ermitteln
    try {
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
      const entry = auditLogs.entries.first();

      if (entry && entry.target?.id === channel.id && entry.executor) {
        const isRecent = Date.now() - entry.createdAt.getTime() < 5000;
        if (isRecent) deleter = `${entry.executor.tag} (<@${entry.executor.id}>)`;
      }
    } catch (error) {
      logger.error(`[ChannelDelete] Fehler beim Abrufen des Audit-Logs für ${channel.name ?? 'Unbekannt'} (${channel.id}):`, error);
    }

    // Kanaltyp-Lokalisierung über Keys
    const channelTypeKeyMap = {
      [ChannelType.GuildText]: 'channel_types.TEXT_CHANNEL',
      [ChannelType.GuildVoice]: 'channel_types.VOICE_CHANNEL',
      [ChannelType.GuildCategory]: 'channel_types.CATEGORY',
      [ChannelType.GuildAnnouncement]: 'channel_types.ANNOUNCEMENT_CHANNEL',
      [ChannelType.GuildForum]: 'channel_types.FORUM_CHANNEL',
      [ChannelType.GuildStageVoice]: 'channel_types.STAGE_CHANNEL',
      [ChannelType.GuildDirectory]: 'channel_types.DIRECTORY_CHANNEL',
      [ChannelType.GuildMedia]: 'channel_types.MEDIA_CHANNEL',
      [ChannelType.PrivateThread]: 'channel_types.PRIVATE_THREAD',
      [ChannelType.PublicThread]: 'channel_types.PUBLIC_THREAD',
      [ChannelType.AnnouncementThread]: 'channel_types.ANNOUNCEMENT_THREAD',
    };

    const channelType = getTranslatedText(
      lang,
      channelTypeKeyMap[channel.type] || 'channel_types.UNKNOWN_TYPE',
      { type: channel.type }
    );

    // Embed bauen
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(getTranslatedText(lang, 'channel_delete.LOG_TITLE'))
      .setDescription(
        getTranslatedText(lang, 'channel_delete.LOG_DESCRIPTION', {
          channelName: channel.name ?? '—',
          channelId: channel.id,
        })
      )
      .addFields(
        { name: getTranslatedText(lang, 'channel_delete.FIELD_TYPE'), value: channelType, inline: true },
        { name: getTranslatedText(lang, 'channel_delete.FIELD_CATEGORY'), value: categoryName, inline: true },
        { name: getTranslatedText(lang, 'channel_delete.FIELD_DELETED_BY'), value: deleter, inline: false }
      )
      .setTimestamp()
      .setFooter({
        text: getTranslatedText(lang, 'channel_delete.FOOTER_CHANNEL_ID', { channelId: channel.id }),
      });

    try {
      await logChannel.send({ embeds: [embed] });
      logger.info(
        `[ChannelDelete] Kanal '${channel.name ?? '—'}' (${channelType}) in ${guild.name} gelöscht. Löschender: ${deleter}. (PID: ${process.pid})`
      );
    } catch (error) {
      logger.error(
        `[ChannelDelete] Fehler beim Senden des Logs für ${channel.name ?? 'Unbekannt'} (${channel.id}):`,
        error
      );
    }
  },
};