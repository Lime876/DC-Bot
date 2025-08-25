// events/channelCreate.js
import { Events, EmbedBuilder, AuditLogEvent, ChannelType } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
  name: Events.ChannelCreate,
  async execute(channel) {
    const guild = channel.guild;
    if (!guild) return; // Nur Gilden

    const lang = await getGuildLanguage(guild.id);
    const logChannelId = getLogChannelId(guild.id, 'channel_create');
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel?.isTextBased()) {
      logger.warn(`[ChannelCreate] Ungültiger Log-Kanal ${logChannelId} in Gilde ${guild.id}.`);
      return;
    }

    let creator = getTranslatedText(lang, 'channel_create.UNKNOWN_CREATOR');

    // Audit‑Log prüfen
    try {
      const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
      const entry = auditLogs.entries.first();

      if (entry && entry.target.id === channel.id && entry.executor) {
        const isRecent = Date.now() - entry.createdAt.getTime() < 5000;
        if (isRecent) {
          creator = `${entry.executor.tag} (<@${entry.executor.id}>)`;
        }
      }
    } catch (error) {
      logger.error(`[ChannelCreate] Fehler beim Audit-Log für ${channel.name ?? 'Unbekannt'} (${channel.id}):`, error);
    }

    // Kanaltyp‑Lokalisierung
    const channelTypeMap = {
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
      [ChannelType.AnnouncementThread]: 'channel_types.ANNOUNCEMENT_THREAD'
    };

    const channelType = getTranslatedText(lang, channelTypeMap[channel.type] || 'channel_types.UNKNOWN_TYPE', { type: channel.type });
    const categoryName = channel.parent?.name || getTranslatedText(lang, 'channel_create.NO_CATEGORY');

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(getTranslatedText(lang, 'channel_create.LOG_TITLE'))
      .setDescription(getTranslatedText(lang, 'channel_create.LOG_DESCRIPTION', { channelName: channel.name ?? '—', channelId: channel.id }))
      .addFields(
        { name: getTranslatedText(lang, 'channel_create.FIELD_TYPE'), value: channelType, inline: true },
        { name: getTranslatedText(lang, 'channel_create.FIELD_CATEGORY'), value: categoryName, inline: true },
        { name: getTranslatedText(lang, 'channel_create.FIELD_CREATED_BY'), value: creator, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: getTranslatedText(lang, 'channel_create.FOOTER_CHANNEL_ID', { channelId: channel.id }) });

    try {
      await logChannel.send({ embeds: [embed] });
      logger.info(`[ChannelCreate] '${channel.name}' (${channelType}) in ${guild.name} erstellt von ${creator}.`);
    } catch (error) {
      logger.error(`[ChannelCreate] Fehler beim Senden des Logs für ${channel.name ?? 'Unbekannt'} (${channel.id}):`, error);
    }
  }
};