// utils/logUtils.js
const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('./configUtils');
const { getTranslatedText } = require('./languageUtils');
const logger = require('./logger'); // Importiere den neuen Logger

/**
 * Sendet eine Log-Nachricht an den konfigurierten Log-Kanal der Gilde.
 * @param {string} guildId - Die ID der Gilde.
 * @param {string} logType - Der Typ des Log-Ereignisses (z.B. 'message_delete', 'member_join').
 * @param {object} logData - Ein Objekt mit Daten für das Log-Embed.
 * @param {string} logData.logTitle - Der Titel des Log-Embeds.
 * @param {string} logData.logDescription - Die Beschreibung des Log-Embeds.
 * @param {Array<object>} [logData.fields=[]] - Optionale Felder für das Embed.
 * @param {string} [logData.color='Blue'] - Optionale Farbe für das Embed.
 * @param {string} [logData.thumbnailUrl=null] - Optionale Thumbnail-URL.
 */
async function logEvent(guildId, logType, logData) {
    try {
        // Stelle sicher, dass der Client global verfügbar ist
        if (!global.client) {
            logger.error('[LogUtils] Discord Client ist nicht global verfügbar. Kann keine Logs senden.');
            return;
        }

        const guildConfig = await getGuildConfig(guildId);
        const logChannelId = guildConfig.logChannels?.[logType];

        if (!logChannelId) {
            // logger.debug(`[LogUtils] Kein Log-Kanal für Typ '${logType}' in Gilde ${guildId} konfiguriert.`);
            return;
        }

        const guild = await global.client.guilds.fetch(guildId);
        const logChannel = await guild.channels.fetch(logChannelId);

        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[LogUtils] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guildId} ist ungültig oder kein Textkanal.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(logData.logTitle)
            .setDescription(logData.logDescription)
            .setColor(logData.color || 'Blue')
            .setTimestamp();

        if (logData.thumbnailUrl) {
            embed.setThumbnail(logData.thumbnailUrl);
        }

        if (logData.fields && logData.fields.length > 0) {
            embed.addFields(logData.fields);
        }

        logger.debug(`[LogUtils] Versuche Embed an Log-Kanal ${logChannel.id} zu senden.`);
        await logChannel.send({ embeds: [embed] });
        logger.debug(`[LogUtils] Embed erfolgreich an Log-Kanal ${logChannel.id} gesendet.`);

    } catch (error) {
        logger.error(`[LogUtils] Fehler beim Senden des Log-Events für Gilde ${guildId}, Typ ${logType}:`, error);
    }
}

module.exports = {
    logEvent
};