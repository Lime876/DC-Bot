// events/messageUpdate.js
const { Events, EmbedBuilder } = require('discord.js');
const { getLogChannelId } = require('../utils/config.js');
const { getGuildLanguage, getTranslatedText } = require('../utils/languageUtils');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // Ignoriere Nachrichten von Bots oder wenn die Nachricht nicht in einer Gilde ist
        if (oldMessage.author.bot || !oldMessage.guild) {
            // logger.debug(`[Message Update DEBUG] Nachricht ID ${oldMessage.id}: Ignoriert (keine Gilde oder Bot-Nachricht). (PID: ${process.pid})`);
            return;
        }

        // Ignoriere, wenn der Inhalt der Nachricht nicht geändert wurde
        if (oldMessage.content === newMessage.content) {
            // logger.debug(`[Message Update DEBUG] Nachricht ID ${oldMessage.id}: Inhalt nicht geändert. (PID: ${process.pid})`);
            return;
        }

        const guild = newMessage.guild;
        const lang = await getGuildLanguage(guild.id);
        const logChannelId = getLogChannelId(guild.id, 'message_edit'); // Hole den Log-Kanal für message_edit

        if (!logChannelId) {
            // logger.debug(`[Message Update Event] Kein Log-Kanal für 'message_edit' in Gilde ${guild.id} konfiguriert. (PID: ${process.pid})`);
            return; // Kein Log-Kanal konfiguriert
        }

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel || !logChannel.isTextBased()) {
            logger.warn(`[Message Update Event] Konfigurierter Log-Kanal ${logChannelId} für Gilde ${guild.id} ist ungültig oder kein Textkanal. (PID: ${process.pid})`);
            return;
        }

        const authorTag = oldMessage.author.tag;
        const authorId = oldMessage.author.id;
        const channelMention = oldMessage.channel.toString();

        const oldContent = oldMessage.content || getTranslatedText(lang, 'message_edit.NO_CONTENT');
        const newContent = newMessage.content || getTranslatedText(lang, 'message_edit.NO_CONTENT');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF) // Blau für bearbeitete Nachrichten
            .setTitle(getTranslatedText(lang, 'message_edit.LOG_TITLE'))
            .setDescription(getTranslatedText(lang, 'message_edit.LOG_DESCRIPTION', { authorTag: authorTag, authorId: authorId, channelMention: channelMention }))
            .addFields(
                { name: getTranslatedText(lang, 'message_edit.FIELD_OLD_CONTENT'), value: oldContent.substring(0, 1024), inline: false }, // Max. 1024 Zeichen für Feldwert
                { name: getTranslatedText(lang, 'message_edit.FIELD_NEW_CONTENT'), value: newContent.substring(0, 1024), inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Nachricht ID: ${oldMessage.id}` });

        try {
            await logChannel.send({ embeds: [embed] });
            logger.info(`[Message Update Event] Nachricht von ${authorTag} in ${channelMention} bearbeitet. (PID: ${process.pid})`);
        } catch (error) {
            logger.error(`[Message Update Event] Fehler beim Senden des Nachrichten-Update-Logs für ${authorTag}:`, error);
        }
    },
};
