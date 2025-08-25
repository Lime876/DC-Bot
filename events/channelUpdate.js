// events/channelUpdate.js
import { Events, EmbedBuilder, AuditLogEvent, ChannelType } from 'discord.js';
import { getLogChannelId } from '../utils/config.js';
import { getGuildLanguage, getTranslatedText } from '../utils/languageUtils.js';
import logger from '../utils/logger.js';

export default {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel) {
    const guild = newChannel.guild;
    if (!guild) return;

    const lang = await getGuildLanguage(guild.id);

    // Ziel-Logkanal holen
    const logChannelId = getLogChannelId(guild.id, 'channel_update');
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel?.isTextBased()) {
      logger.warn(`[ChannelUpdate] Konfigurierter Log-Kanal ${logChannelId} in Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
      return;
    }

    let updater = getTranslatedText(lang, 'channel_update.UNKNOWN_UPDATER');
    const changes = [];

    // Audit-Logs prüfen, um den Aktualisierenden zu ermitteln
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelUpdate,
        limit: 1,
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === newChannel.id && entry.executor) {
        const isRecent = Date.now() - entry.createdAt.getTime() < 5000;
        if (isRecent) updater = `${entry.executor.tag} (<@${entry.executor.id}>)`;
      }
    } catch (error) {
      logger.error(`[ChannelUpdate] Fehler beim Abrufen des Audit-Logs für ${newChannel.name ?? '—'} (${newChannel.id}):`, error);
      // Weiter ohne Updater-Info
    }

    // Hilfsfunktionen für sichere Feldzugriffe
    const has = (obj, prop) => prop in obj && obj[prop] !== undefined && obj[prop] !== null;

    // Name
    if (oldChannel.name !== newChannel.name) {
      changes.push(
        getTranslatedText(lang, 'channel_update.CHANGE_NAME', {
          oldName: oldChannel.name ?? '—',
          newName: newChannel.name ?? '—',
        })
      );
    }

    // Topic (nur Text-/Forum-/Announcement-ähnliche Channels)
    if (has(oldChannel, 'topic') || has(newChannel, 'topic')) {
      const oldTopic = oldChannel.topic ?? null;
      const newTopic = newChannel.topic ?? null;
      if (oldTopic !== newTopic) {
        changes.push(
          getTranslatedText(lang, 'channel_update.CHANGE_TOPIC', {
            oldTopic: oldTopic ?? getTranslatedText(lang, 'general.NOT_AVAILABLE'),
            newTopic: newTopic ?? getTranslatedText(lang, 'general.NOT_AVAILABLE'),
          })
        );
      }
    }

    // NSFW (Text/Medien/Forum)
    if (has(oldChannel, 'nsfw') || has(newChannel, 'nsfw')) {
      const oldNsfw = !!oldChannel.nsfw;
      const newNsfw = !!newChannel.nsfw;
      if (oldNsfw !== newNsfw) {
        changes.push(
          getTranslatedText(lang, 'channel_update.CHANGE_NSFW', {
            oldValue: oldNsfw ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'),
            newValue: newNsfw ? getTranslatedText(lang, 'general.YES') : getTranslatedText(lang, 'general.NO'),
          })
        );
      }
    }

    // Slowmode (rateLimitPerUser) nur bei Text-/Forum-/Announcement-Kanälen
    if (has(oldChannel, 'rateLimitPerUser') || has(newChannel, 'rateLimitPerUser')) {
      const oldSlow = oldChannel.rateLimitPerUser ?? 0;
      const newSlow = newChannel.rateLimitPerUser ?? 0;
      if (oldSlow !== newSlow) {
        changes.push(
          getTranslatedText(lang, 'channel_update.CHANGE_SLOWMODE', {
            oldValue: oldSlow,
            newValue: newSlow,
          })
        );
      }
    }

    // Bitrate (nur Voice)
    if (oldChannel.type === ChannelType.GuildVoice && newChannel.type === ChannelType.GuildVoice) {
      if (oldChannel.bitrate !== newChannel.bitrate) {
        changes.push(
          getTranslatedText(lang, 'channel_update.CHANGE_BITRATE', {
            oldValue: Math.round((oldChannel.bitrate ?? 0) / 1000),
            newValue: Math.round((newChannel.bitrate ?? 0) / 1000),
          })
        );
      }
      // User-Limit (nur Voice)
      if (oldChannel.userLimit !== newChannel.userLimit) {
        changes.push(
          getTranslatedText(lang, 'channel_update.CHANGE_USER_LIMIT', {
            oldValue: oldChannel.userLimit || getTranslatedText(lang, 'channel_update.UNLIMITED'),
            newValue: newChannel.userLimit || getTranslatedText(lang, 'channel_update.UNLIMITED'),
          })
        );
      }
    }

    // Kategorie/Parent
    const oldParentId = oldChannel.parentId ?? oldChannel.parent?.id ?? null;
    const newParentId = newChannel.parentId ?? newChannel.parent?.id ?? null;
    if (oldParentId !== newParentId) {
      const oldCategoryName = oldChannel.parent?.name ?? getTranslatedText(lang, 'channel_update.NO_CATEGORY');
      const newCategoryName = newChannel.parent?.name ?? getTranslatedText(lang, 'channel_update.NO_CATEGORY');
      changes.push(
        getTranslatedText(lang, 'channel_update.CHANGE_CATEGORY', {
          oldCategory: oldCategoryName,
          newCategory: newCategoryName,
        })
      );
    }

    // Berechtigungsänderungen (Overwrites) – einfacher Vergleich von allow/deny Bitfields je Overwrite
    try {
      const oldPerms = oldChannel.permissionOverwrites?.cache ?? oldChannel.permissionOverwrites ?? new Map();
      const newPerms = newChannel.permissionOverwrites?.cache ?? newChannel.permissionOverwrites ?? new Map();

      const serialize = (po) => {
        const id = po.id;
        // v14: allow/deny sind PermissionsBitField (BigInt bitfield)
        const allow = po.allow?.bitfield?.toString() ?? '0';
        const deny = po.deny?.bitfield?.toString() ?? '0';
        const type = po.type; // 0 role / 1 member
        return `${id}:${type}:${allow}|${deny}`;
      };

      const oldSet = new Set([...oldPerms.values()].map(serialize));
      const newSet = new Set([...newPerms.values()].map(serialize));

      const permsChanged =
        oldSet.size !== newSet.size ||
        [...oldSet].some((k) => !newSet.has(k)) ||
        [...newSet].some((k) => !oldSet.has(k));

      if (permsChanged) {
        changes.push(getTranslatedText(lang, 'channel_update.CHANGE_PERMISSIONS'));
      }
    } catch (e) {
      // Im Zweifel nicht blockieren, nur loggen
      logger.warn(`[ChannelUpdate] Konnte Permission-Overwrites nicht vergleichen für ${newChannel.name ?? '—'} (${newChannel.id}).`);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(getTranslatedText(lang, 'channel_update.LOG_TITLE'))
      .setDescription(
        getTranslatedText(lang, 'channel_update.LOG_DESCRIPTION', {
          channelName: newChannel.name ?? '—',
          channelId: newChannel.id,
        })
      )
      .addFields(
        { name: getTranslatedText(lang, 'channel_update.FIELD_UPDATED_BY'), value: updater, inline: false },
        { name: getTranslatedText(lang, 'channel_update.FIELD_CHANGES'), value: changes.join('\n'), inline: false }
      )
      .setTimestamp()
      .setFooter({
        text: getTranslatedText(lang, 'channel_update.FOOTER_CHANNEL_ID', { channelId: newChannel.id }),
      });

    try {
      await logChannel.send({ embeds: [embed] });
      logger.info(
        `[ChannelUpdate] Kanal '${newChannel.name ?? '—'}' in ${guild.name} aktualisiert. Aktualisierender: ${updater}. Änderungen: ${changes.join(', ')}. (PID: ${process.pid})`
      );
    } catch (error) {
      logger.error(`[ChannelUpdate] Fehler beim Senden des Logs für ${newChannel.name ?? '—'} (${newChannel.id}):`, error);
    }
  },
};