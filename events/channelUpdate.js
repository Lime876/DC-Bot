// events/channelUpdate.js
const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        const guild = newChannel.guild;
        if (!guild) {
            // Event außerhalb einer Gilde ignoriert (z.B. DM-Kanäle)
            return;
        }

        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'channel_update');

        if (!logChannelId) {
            // logger.debug(`[ChannelUpdate Event] Kein Log-Kanal für 'channel_update' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return;
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[ChannelUpdate Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        let updater = getTranslatedText(lang, 'channel_update.UNKNOWN_UPDATER');
        const changes = [];

        // Versuche, den Aktualisierenden aus dem Audit-Log zu holen
        try {
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelUpdate,
                limit: 1,
            });
            const latestChannelUpdateLog = auditLogs.entries.first();

            if (latestChannelUpdateLog && latestChannelUpdateLog.target.id === newChannel.id && latestChannelUpdateLog.executor) {
                const timeDifference = Date.now() - latestChannelUpdateLog.createdAt.getTime();
                if (timeDifference < 5000) { // Wenn der Eintrag innerhalb der letzten 5 Sekunden erstellt wurde
                    updater = `${latestChannelUpdateLog.executor.tag} (<@${latestChannelUpdateLog.executor.id}>)`;
                }
            }
        } catch (error) {
            logger.error(`[ChannelUpdate Event] Fehler beim Abrufen des Audit-Logs für Kanalaktualisierung von ${newChannel.name}:`, error);
        }

        // Erkennung spezifischer Änderungen
        if (oldChannel.name !== newChannel.name) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_NAME', { oldName: oldChannel.name, newName: newChannel.name }));
        }
        if (oldChannel.topic !== newChannel.topic) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_TOPIC', { oldTopic: oldChannel.topic || 'N/A', newTopic: newChannel.topic || 'N/A' }));
        }
        if (oldChannel.nsfw !== newChannel.nsfw) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_NSFW', { oldValue: oldChannel.nsfw, newValue: newChannel.nsfw }));
        }
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_SLOWMODE', { oldValue: oldChannel.rateLimitPerUser, newValue: newChannel.rateLimitPerUser }));
        }
        if (oldChannel.bitrate && newChannel.bitrate && oldChannel.bitrate !== newChannel.bitrate) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_BITRATE', { oldValue: oldChannel.bitrate / 1000, newValue: newChannel.bitrate / 1000 }));
        }
        if (oldChannel.userLimit !== newChannel.userLimit) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_USER_LIMIT', { oldValue: oldChannel.userLimit || 'Unbegrenzt', newValue: newChannel.userLimit || 'Unbegrenzt' }));
        }
        if (oldChannel.parent !== newChannel.parent) {
            const oldCategoryName = oldChannel.parent ? oldChannel.parent.name : getTranslatedText(lang, 'channel_update.NO_CATEGORY');
            const newCategoryName = newChannel.parent ? newChannel.parent.name : getTranslatedText(lang, 'channel_update.NO_CATEGORY');
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_CATEGORY', { oldCategory: oldCategoryName, newCategory: newCategoryName }));
        }

        // Berechtigungsänderungen sind komplexer und werden oft als "Berechtigungen aktualisiert" geloggt
        // Eine detaillierte Auflistung der Berechtigungsänderungen wäre sehr aufwendig
        if (oldChannel.permissionOverwrites.cache.size !== newChannel.permissionOverwrites.cache.size ||
            oldChannel.permissionOverwrites.cache.some(oldPo => {
                const newPo = newChannel.permissionOverwrites.cache.get(oldPo.id);
                return !newPo || oldPo.deny.bitfield !== newPo.deny.bitfield || oldPo.allow.bitfield !== newPo.allow.bitfield;
            })) {
            changes.push(getTranslatedText(lang, 'channel_update.CHANGE_PERMISSIONS'));
        }

        if (changes.length === 0) {
            // Manchmal wird channelUpdate auch ohne erkennbare Änderungen ausgelöst (z.B. interne Discord-Updates)
            // logger.debug(`[ChannelUpdate Event] Kanal '${newChannel.name}' aktualisiert, aber keine spezifischen Änderungen erkannt. (PID: ${process.pid})`);
            // Wir können hier entscheiden, ob wir trotzdem loggen oder ignorieren. Für jetzt ignorieren wir.
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange für Aktualisierung
            .setTitle(getTranslatedText(lang, 'channel_update.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'channel_update.LOG_DESCRIPTION', { channelName: newChannel.name, channelId: newChannel.id }))
            .addFields(
                { name: getTranslatedText(lang, 'channel_update.FIELD_UPDATED_BY'), value: updater, inline: false },
                { name: getTranslatedText(lang, 'channel_update.FIELD_CHANGES'), value: changes.join('\n') || getTranslatedText(lang, 'channel_update.NO_CHANGES_DETECTED'), inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${newChannel.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[ChannelUpdate Event] Kanal '${newChannel.name}' in Gilde ${guild.name} aktualisiert. Aktualisierender: ${updater}. Änderungen: ${changes.join(', ')}. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[ChannelUpdate Event] Fehler beim Senden des Kanal-Update-Logs für ${newChannel.name}:`, error);
        }
    },
};
